"""Guest endpoints. Everything is scoped to one table (by its QR token) and, for
orders, to the guest's own session: a guest can never see or touch another guest's order."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload

from ..config import settings
from ..db import get_db
from ..limits import ORDER_LIMIT, SESSION_LIMIT, guest_session, ip_and_table, limiter
from ..models import (
    Category,
    CustomerSession,
    MenuItem,
    Order,
    OrderItem,
    OrderStatus,
    with_order_details,
)
from ..schemas import (
    CustomerSessionIn,
    CustomerSessionOut,
    OrderIn,
    OrderOut,
    PublicCategory,
    PublicMenu,
    PublicMenuItem,
    PublicTable,
)
from ..security import current_customer_session, get_active_table, new_session_token

router = APIRouter(prefix="/api/public/tables/{table_token}", tags=["guest"])

# Stops one session from flooding the kitchen: new orders are refused while this many
# are still waiting for staff to accept them.
MAX_WAITING_ORDERS_PER_SESSION = 3


@router.get("", response_model=PublicMenu)
def get_menu(table_token: str, db: Session = Depends(get_db)):
    table = get_active_table(db, table_token)
    categories = db.scalars(
        select(Category).where(Category.active).order_by(Category.id).options(selectinload(Category.items))
    ).all()
    public_categories = []
    for category in categories:
        items = [PublicMenuItem.model_validate(item) for item in category.items if item.active]
        if items:
            public_categories.append(
                PublicCategory(id=category.id, name=category.name, description=category.description, items=items)
            )
    return PublicMenu(table=PublicTable(name=table.name), categories=public_categories)


@router.post("/session", response_model=CustomerSessionOut)
@limiter.limit(SESSION_LIMIT, key_func=ip_and_table)
def start_session(request: Request, table_token: str, data: CustomerSessionIn, db: Session = Depends(get_db)):
    table = get_active_table(db, table_token)
    session = CustomerSession(
        session_token=new_session_token(),
        table_id=table.id,
        customer_name=data.name,
        customer_phone=data.phone,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.session_ttl_minutes),
    )
    db.add(session)
    db.commit()
    return CustomerSessionOut(
        session_token=session.session_token,
        expires_at=session.expires_at,
        table=PublicTable(name=table.name),
    )


@router.get("/orders", response_model=list[OrderOut])
def my_orders(session: CustomerSession = Depends(current_customer_session), db: Session = Depends(get_db)):
    orders = db.scalars(
        with_order_details(select(Order))
        .where(Order.customer_session_id == session.id)
        .order_by(Order.id.desc())
    ).all()
    return [OrderOut.from_order(order) for order in orders]


@router.post("/orders", response_model=OrderOut)
@limiter.limit(ORDER_LIMIT, key_func=guest_session)
def place_order(
    request: Request,
    data: OrderIn,
    session: CustomerSession = Depends(current_customer_session),
    db: Session = Depends(get_db),
):
    # A retry of an order this session already placed (double tap, flaky network)
    # returns the original order instead of creating a second one.
    existing = _find_order(db, session.id, data.idempotency_key)
    if existing:
        return OrderOut.from_order(existing)

    waiting = db.scalar(
        select(func.count())
        .select_from(Order)
        .where(Order.customer_session_id == session.id, Order.status == OrderStatus.PLACED)
    )
    if waiting >= MAX_WAITING_ORDERS_PER_SESSION:
        raise HTTPException(409, "You have orders waiting for the cafe to accept. Please wait a moment.")

    ids = [line.item_id for line in data.items]
    if len(ids) != len(set(ids)):
        raise HTTPException(422, "Duplicate items are not allowed")
    menu_items = db.scalars(
        select(MenuItem).where(MenuItem.id.in_(ids)).options(joinedload(MenuItem.category))
    ).all()
    by_id = {item.id: item for item in menu_items}

    total = Decimal("0")
    lines = []
    for line in data.items:
        item = by_id.get(line.item_id)
        if item is None or not item.active or not item.category.active:
            raise HTTPException(409, "One or more items are no longer on the menu. Please refresh.")
        if not item.available:
            raise HTTPException(409, f"{item.name} is sold out")
        # Prices always come from the database, never from the request.
        line_total = item.price * line.quantity
        total += line_total
        lines.append(
            OrderItem(
                menu_item_id=item.id,
                item_name_snapshot=item.name,
                unit_price_snapshot=item.price,
                quantity=line.quantity,
                line_total=line_total,
            )
        )

    order = Order(
        table_id=session.table_id,
        customer_session_id=session.id,
        customer_name=session.customer_name,
        customer_phone=session.customer_phone,
        status=OrderStatus.PLACED,
        subtotal=total,
        total=total,
        idempotency_key=data.idempotency_key,
        items=lines,
    )
    db.add(order)
    try:
        db.commit()
    except IntegrityError:
        # Two identical requests raced; the other one won. Return its order.
        db.rollback()
        existing = _find_order(db, session.id, data.idempotency_key)
        if existing is None:
            raise
        return OrderOut.from_order(existing)
    return OrderOut.from_order(_find_order(db, session.id, data.idempotency_key))


def _find_order(db: Session, session_id: int, idempotency_key: str) -> Order | None:
    return db.scalar(
        with_order_details(select(Order)).where(
            Order.customer_session_id == session_id,
            Order.idempotency_key == idempotency_key,
        )
    )
