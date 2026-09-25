from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..models import Order, OrderItem, OrderStatus, with_order_details
from ..schemas import AdminOrderOut, StatusIn, SummaryOut, TopItem
from ..security import OWNER_ONLY, current_user

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


@router.get("/summary", response_model=SummaryOut, dependencies=OWNER_ONLY)
def daily_summary(day: date | None = None, db: Session = Depends(get_db)):
    """Owner: order count, revenue and best sellers for one day (default: today, in the
    restaurant's time zone)."""
    tz = ZoneInfo(settings.timezone)
    day = day or datetime.now(tz).date()
    start = datetime.combine(day, time.min, tz).astimezone(timezone.utc)
    end = datetime.combine(day + timedelta(days=1), time.min, tz).astimezone(timezone.utc)
    in_day = (Order.created_at >= start, Order.created_at < end)
    not_cancelled = Order.status != OrderStatus.CANCELLED

    orders, revenue = db.execute(
        select(func.count(), func.coalesce(func.sum(Order.total), 0)).where(*in_day, not_cancelled)
    ).one()
    cancelled = db.scalar(select(func.count()).select_from(Order).where(*in_day, Order.status == OrderStatus.CANCELLED))
    quantity = func.sum(OrderItem.quantity).label("quantity")
    top_items = db.execute(
        select(OrderItem.item_name_snapshot, quantity)
        .join(Order)
        .where(*in_day, not_cancelled)
        .group_by(OrderItem.item_name_snapshot)
        .order_by(quantity.desc(), OrderItem.item_name_snapshot)
        .limit(5)
    ).all()
    return SummaryOut(
        day=day,
        orders=orders,
        cancelled=cancelled,
        revenue=Decimal(revenue),
        top_items=[TopItem(name=name, quantity=qty) for name, qty in top_items],
    )
