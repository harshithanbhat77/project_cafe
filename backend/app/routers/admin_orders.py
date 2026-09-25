from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Order, OrderStatus, with_order_details
from ..schemas import AdminOrderOut, StatusIn
from ..security import current_user

router = APIRouter(prefix="/api/admin", tags=["admin: orders"], dependencies=[Depends(current_user)])

# Allowed order status changes. Anything else is rejected with 409.
TRANSITIONS: dict[OrderStatus, set[OrderStatus]] = {
    OrderStatus.PLACED: {OrderStatus.ACCEPTED, OrderStatus.CANCELLED},
    OrderStatus.ACCEPTED: {OrderStatus.PREPARING, OrderStatus.CANCELLED},
    OrderStatus.PREPARING: {OrderStatus.READY},
    OrderStatus.READY: {OrderStatus.COMPLETED},
    OrderStatus.COMPLETED: set(),
    OrderStatus.CANCELLED: set(),
}


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
