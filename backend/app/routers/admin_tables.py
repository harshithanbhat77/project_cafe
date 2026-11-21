from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import CafeTable, CustomerSession, Order, OrderStatus, ServiceRequest, new_table_token
from ..schemas import TableIn, TableOut, TableStatusOut, TableUpdate
from ..security import OWNER_ONLY, current_user
from .helpers import get_or_404

router = APIRouter(prefix="/api/admin", tags=["admin: tables"], dependencies=[Depends(current_user)])


OPEN_ORDER_STATUSES = (OrderStatus.PLACED, OrderStatus.ACCEPTED, OrderStatus.PREPARING, OrderStatus.READY)


@router.get("/tables", response_model=list[TableStatusOut])
def list_tables(db: Session = Depends(get_db)):
    """Every table, with how many guests are seated, their open orders and open requests."""
    live = (
        CustomerSession.active,
        CustomerSession.expires_at > datetime.now(timezone.utc),
    )
    guests = dict(
        db.execute(select(CustomerSession.table_id, func.count()).where(*live).group_by(CustomerSession.table_id)).all()
    )
    open_orders = dict(
        db.execute(
            select(Order.table_id, func.count())
            .where(Order.status.in_(OPEN_ORDER_STATUSES))
            .group_by(Order.table_id)
        ).all()
    )
    requests: dict[int, list] = {}
    for table_id, kind in db.execute(
        select(ServiceRequest.table_id, ServiceRequest.kind)
        .join(CustomerSession)
        .where(ServiceRequest.resolved_at.is_(None), *live)
        .distinct()
        .order_by(ServiceRequest.table_id, ServiceRequest.kind)
    ):
        requests.setdefault(table_id, []).append(kind)

    return [
        TableStatusOut(
            **TableOut.model_validate(table).model_dump(),
            guests=guests.get(table.id, 0),
            open_orders=open_orders.get(table.id, 0),
            open_requests=requests.get(table.id, []),
        )
        for table in db.scalars(select(CafeTable).order_by(CafeTable.id))
    ]


@router.post("/tables/{table_id}/clear")
def clear_table(table_id: int, db: Session = Depends(get_db)):
    """Staff and owner: end every guest session at this table, e.g. when guests leave.
    The next guests scan the QR code and enter their details again."""
    get_or_404(db, CafeTable, table_id)
    ended = _end_sessions(db, table_id)
    db.commit()
    return {"ended_sessions": ended}


@router.post("/tables", response_model=TableOut, dependencies=OWNER_ONLY)
def create_table(data: TableIn, db: Session = Depends(get_db)):
    table = CafeTable(**data.model_dump())
    db.add(table)
    db.commit()
    return table


@router.patch("/tables/{table_id}", response_model=TableOut, dependencies=OWNER_ONLY)
def update_table(table_id: int, data: TableUpdate, db: Session = Depends(get_db)):
    table = get_or_404(db, CafeTable, table_id)
    for field, value in data.changes().items():
        setattr(table, field, value)
    db.commit()
    return table


@router.post("/tables/{table_id}/rotate-token", response_model=TableOut, dependencies=OWNER_ONLY)
def rotate_table_token(table_id: int, db: Session = Depends(get_db)):
    """Issue a new QR token (the old printed QR stops working) and end all sessions."""
    table = get_or_404(db, CafeTable, table_id)
    table.qr_token = new_table_token()
    _end_sessions(db, table_id)
    db.commit()
    return table


def _end_sessions(db: Session, table_id: int) -> int:
    """End the table's guest sessions and close any requests they left open."""
    db.execute(
        update(ServiceRequest)
        .where(ServiceRequest.table_id == table_id, ServiceRequest.resolved_at.is_(None))
        .values(resolved_at=datetime.now(timezone.utc))
    )
    result = db.execute(
        update(CustomerSession)
        .where(CustomerSession.table_id == table_id, CustomerSession.active)
        .values(active=False)
    )
    return result.rowcount
