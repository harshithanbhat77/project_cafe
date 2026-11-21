"""Staff: see and clear guests' requests for a waiter or the bill."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from ..db import get_db
from ..models import CustomerSession, ServiceRequest, User
from ..schemas import AdminServiceRequestOut
from ..security import current_user
from .helpers import get_or_404

router = APIRouter(prefix="/api/admin", tags=["admin: service requests"], dependencies=[Depends(current_user)])


@router.get("/requests", response_model=list[AdminServiceRequestOut])
def open_requests(db: Session = Depends(get_db)):
    """Open requests from guests who are still at their table, oldest first."""
    requests = db.scalars(
        select(ServiceRequest)
        .join(CustomerSession)
        .where(
            ServiceRequest.resolved_at.is_(None),
            CustomerSession.active,
            CustomerSession.expires_at > datetime.now(timezone.utc),
        )
        .options(joinedload(ServiceRequest.table), joinedload(ServiceRequest.customer_session))
        .order_by(ServiceRequest.created_at, ServiceRequest.id)
    ).all()
    return [AdminServiceRequestOut.from_request(r) for r in requests]


@router.post("/requests/{request_id}/resolve", status_code=204)
def resolve_request(request_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Mark a request as dealt with. Doing it twice is harmless."""
    service_request = get_or_404(db, ServiceRequest, request_id)
    if service_request.resolved_at is None:
        service_request.resolved_at = datetime.now(timezone.utc)
        service_request.resolved_by_id = user.id
        db.commit()
