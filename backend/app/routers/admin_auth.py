from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..db import get_db
from ..limits import LOGIN_LIMIT, limiter
from ..models import User
from ..schemas import LoginIn, Token, UserOut
from ..security import authenticate, current_user, make_admin_token

router = APIRouter(prefix="/api/admin", tags=["admin: auth"])


@router.post("/auth/login", response_model=Token)
@limiter.limit(LOGIN_LIMIT)
def login(request: Request, data: LoginIn, db: Session = Depends(get_db)):
    user = authenticate(db, data.email, data.password)
    if user is None:
        raise HTTPException(401, "Invalid email or password")
    return Token(access_token=make_admin_token(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    """Who is signed in, and their role (the dashboard hides owner-only screens for staff)."""
    return user
