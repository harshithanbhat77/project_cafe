"""Owner-only: manage who can sign in to the dashboard."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User
from ..schemas import UserIn, UserOut, UserUpdate
from ..security import hash_password, require_owner
from .helpers import commit_or_conflict, get_or_404

router = APIRouter(prefix="/api/admin", tags=["admin: users"], dependencies=[Depends(require_owner)])

DUPLICATE_EMAIL = "Someone with that email already has an account"


@router.get("/users", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db)):
    return db.scalars(select(User).order_by(User.id)).all()


@router.post("/users", response_model=UserOut)
def create_user(data: UserIn, db: Session = Depends(get_db)):
    user = User(name=data.name, email=data.email, role=data.role, password_hash=hash_password(data.password))
    db.add(user)
    commit_or_conflict(db, DUPLICATE_EMAIL)
    return user


@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    data: UserUpdate,
    owner: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    user = get_or_404(db, User, user_id)
    changes = data.changes()
    # Stops the owner locking themselves out. Another owner can still change them.
    if user.id == owner.id and ("role" in changes or "active" in changes):
        raise HTTPException(409, "You can't change your own role or deactivate yourself")
    if "password" in changes:
        user.password_hash = hash_password(changes.pop("password"))
    for field, value in changes.items():
        setattr(user, field, value)
    db.commit()
    return user
