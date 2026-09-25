from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session


def get_or_404(db: Session, model, object_id: int):
    obj = db.get(model, object_id)
    if obj is None:
        raise HTTPException(404, f"{model.__name__} not found")
    return obj


def commit_or_conflict(db: Session, message: str) -> None:
    """Commit, turning a unique-constraint violation (e.g. duplicate name) into a 409."""
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, message)
