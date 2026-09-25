from fastapi import APIRouter, Depends
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import CafeTable, CustomerSession, new_table_token
from ..schemas import TableIn, TableOut, TableUpdate
from ..security import OWNER_ONLY, current_user
from .helpers import get_or_404

router = APIRouter(prefix="/api/admin", tags=["admin: tables"], dependencies=[Depends(current_user)])


@router.get("/tables", response_model=list[TableOut])
def list_tables(db: Session = Depends(get_db)):
    return db.scalars(select(CafeTable).order_by(CafeTable.id)).all()


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
    result = db.execute(
        update(CustomerSession)
        .where(CustomerSession.table_id == table_id, CustomerSession.active)
        .values(active=False)
    )
    return result.rowcount
