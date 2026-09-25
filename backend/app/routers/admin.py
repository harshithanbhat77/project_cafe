"""Admin (restaurant staff) endpoints.

Every route on `router` requires a valid admin token via the router-level dependency,
so a new endpoint can't accidentally be left public. Only login lives on `auth_router`.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..db import get_db
from ..limits import LOGIN_LIMIT, limiter
from ..models import (
    CafeTable,
    Category,
    CustomerSession,
    MenuItem,
    Order,
    OrderStatus,
    new_table_token,
    with_order_details,
)
from ..schemas import (
    AdminOrderOut,
    CategoryIn,
    CategoryOut,
    CategoryUpdate,
    LoginIn,
    MenuItemIn,
    MenuItemOut,
    MenuItemUpdate,
    StatusIn,
    TableIn,
    TableOut,
    TableUpdate,
    Token,
)
from ..security import authenticate, current_admin, make_admin_token

auth_router = APIRouter(prefix="/api/admin/auth", tags=["admin"])
router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(current_admin)])

# Allowed order status changes. Anything else is rejected with 409.
TRANSITIONS: dict[OrderStatus, set[OrderStatus]] = {
    OrderStatus.PLACED: {OrderStatus.ACCEPTED, OrderStatus.CANCELLED},
    OrderStatus.ACCEPTED: {OrderStatus.PREPARING, OrderStatus.CANCELLED},
    OrderStatus.PREPARING: {OrderStatus.READY},
    OrderStatus.READY: {OrderStatus.COMPLETED},
    OrderStatus.COMPLETED: set(),
    OrderStatus.CANCELLED: set(),
}


# ---------- Auth ----------


@auth_router.post("/login", response_model=Token)
@limiter.limit(LOGIN_LIMIT)
def login(request: Request, data: LoginIn, db: Session = Depends(get_db)):
    user = authenticate(db, data.email, data.password)
    if user is None:
        raise HTTPException(401, "Invalid email or password")
    return Token(access_token=make_admin_token(user))


# ---------- Orders ----------


@router.get("/orders", response_model=list[AdminOrderOut])
def list_orders(
    status: OrderStatus | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    query = with_order_details(select(Order)).order_by(Order.created_at.desc(), Order.id.desc()).limit(limit)
    if status is not None:
        query = query.where(Order.status == status)
    return [AdminOrderOut.from_order(order) for order in db.scalars(query).all()]


@router.patch("/orders/{order_id}/status", response_model=AdminOrderOut)
def update_order_status(order_id: int, data: StatusIn, db: Session = Depends(get_db)):
    # Lock the row so two staff clicking at the same time can't both move it.
    order = db.scalar(select(Order).where(Order.id == order_id).with_for_update())
    if order is None:
        raise HTTPException(404, "Order not found")
    if data.status not in TRANSITIONS[order.status]:
        raise HTTPException(409, f"Cannot move {order.status.value} to {data.status.value}")
    order.status = data.status
    db.commit()
    return AdminOrderOut.from_order(db.scalar(with_order_details(select(Order)).where(Order.id == order_id)))


# ---------- Categories ----------


@router.get("/categories", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    return db.scalars(select(Category).order_by(Category.id)).all()


@router.post("/categories", response_model=CategoryOut)
def create_category(data: CategoryIn, db: Session = Depends(get_db)):
    category = Category(**data.model_dump())
    db.add(category)
    _commit_or_conflict(db, "A category with that name already exists")
    return category


@router.patch("/categories/{category_id}", response_model=CategoryOut)
def update_category(category_id: int, data: CategoryUpdate, db: Session = Depends(get_db)):
    category = _get_or_404(db, Category, category_id)
    for field, value in data.changes().items():
        setattr(category, field, value)
    _commit_or_conflict(db, "A category with that name already exists")
    return category


# ---------- Menu items ----------


@router.get("/menu", response_model=list[MenuItemOut])
def list_menu_items(db: Session = Depends(get_db)):
    return db.scalars(select(MenuItem).order_by(MenuItem.id)).all()


@router.post("/menu", response_model=MenuItemOut)
def create_menu_item(data: MenuItemIn, db: Session = Depends(get_db)):
    _require_category(db, data.category_id)
    item = MenuItem(**data.model_dump())
    db.add(item)
    db.commit()
    return item


@router.patch("/menu/{item_id}", response_model=MenuItemOut)
def update_menu_item(item_id: int, data: MenuItemUpdate, db: Session = Depends(get_db)):
    item = _get_or_404(db, MenuItem, item_id)
    changes = data.changes()
    if "category_id" in changes:
        _require_category(db, changes["category_id"])
    for field, value in changes.items():
        setattr(item, field, value)
    db.commit()
    return item


# ---------- Tables ----------


@router.get("/tables", response_model=list[TableOut])
def list_tables(db: Session = Depends(get_db)):
    return db.scalars(select(CafeTable).order_by(CafeTable.id)).all()


@router.post("/tables", response_model=TableOut)
def create_table(data: TableIn, db: Session = Depends(get_db)):
    table = CafeTable(**data.model_dump())
    db.add(table)
    db.commit()
    return table


@router.patch("/tables/{table_id}", response_model=TableOut)
def update_table(table_id: int, data: TableUpdate, db: Session = Depends(get_db)):
    table = _get_or_404(db, CafeTable, table_id)
    for field, value in data.changes().items():
        setattr(table, field, value)
    db.commit()
    return table


@router.post("/tables/{table_id}/clear")
def clear_table(table_id: int, db: Session = Depends(get_db)):
    """End every guest session at this table, e.g. when guests leave.
    The next guests scan the QR code and enter their details again."""
    _get_or_404(db, CafeTable, table_id)
    ended = _end_sessions(db, table_id)
    db.commit()
    return {"ended_sessions": ended}


@router.post("/tables/{table_id}/rotate-token", response_model=TableOut)
def rotate_table_token(table_id: int, db: Session = Depends(get_db)):
    """Issue a new QR token (the old printed QR stops working) and end all sessions."""
    table = _get_or_404(db, CafeTable, table_id)
    table.qr_token = new_table_token()
    _end_sessions(db, table_id)
    db.commit()
    return table


# ---------- Helpers ----------


def _get_or_404(db: Session, model, object_id: int):
    obj = db.get(model, object_id)
    if obj is None:
        raise HTTPException(404, f"{model.__name__} not found")
    return obj


def _require_category(db: Session, category_id: int) -> None:
    if db.get(Category, category_id) is None:
        raise HTTPException(422, "Category does not exist")


def _end_sessions(db: Session, table_id: int) -> int:
    result = db.execute(
        update(CustomerSession)
        .where(CustomerSession.table_id == table_id, CustomerSession.active)
        .values(active=False)
    )
    return result.rowcount


def _commit_or_conflict(db: Session, message: str) -> None:
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, message)
