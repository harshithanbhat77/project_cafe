"""Who is calling? Admin logins (JWT) and guest table sessions."""

import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, Header, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pwdlib import PasswordHash
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db
from .models import CafeTable, CustomerSession, Role, User

JWT_ALGORITHM = "HS256"
MIN_PASSWORD_LENGTH = 12

password_hasher = PasswordHash.recommended()
# Checked against when the email doesn't exist, so a login for an unknown email takes
# as long as one with a wrong password and can't be used to discover admin emails.
_DUMMY_HASH = password_hasher.hash(secrets.token_urlsafe(16))


def hash_password(raw: str) -> str:
    return password_hasher.hash(raw)


def authenticate(db: Session, email: str, password: str) -> User | None:
    user = db.scalar(select(User).where(User.email == email.strip().lower()))
    if user is None:
        password_hasher.verify(password, _DUMMY_HASH)
        return None
    if not password_hasher.verify(password, user.password_hash) or not user.active:
        return None
    return user


# ---------- Staff and owner logins ----------


def make_admin_token(user: User) -> str:
    issued = datetime.now(timezone.utc)
    claims = {
        "sub": str(user.id),
        "iat": issued,
        "exp": issued + timedelta(minutes=settings.access_token_minutes),
    }
    return jwt.encode(claims, settings.jwt_secret, algorithm=JWT_ALGORITHM)


_bearer = HTTPBearer(auto_error=False)


def current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    """Require a valid staff or owner token. The user (and their role) is re-loaded from
    the database on every request, so deactivating someone locks them out immediately
    and a role change applies straight away."""
    not_authenticated = HTTPException(401, "Authentication required", headers={"WWW-Authenticate": "Bearer"})
    if creds is None:
        raise not_authenticated
    try:
        claims = jwt.decode(
            creds.credentials,
            settings.jwt_secret,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["exp", "iat", "sub"]},
        )
        user = db.get(User, int(claims["sub"]))
    except (jwt.PyJWTError, ValueError):
        raise not_authenticated
    if user is None or not user.active:
        raise not_authenticated
    return user


def require_owner(user: User = Depends(current_user)) -> User:
    if user.role != Role.OWNER:
        raise HTTPException(403, "Only the owner can do this")
    return user


# Add to a route as `dependencies=OWNER_ONLY` to restrict it to the owner.
OWNER_ONLY = [Depends(require_owner)]


# ---------- Guests ----------


def get_active_table(db: Session, table_token: str) -> CafeTable:
    table = db.scalar(select(CafeTable).where(CafeTable.qr_token == table_token, CafeTable.active))
    if table is None:
        raise HTTPException(404, "This table is unavailable")
    return table


def current_customer_session(
    table_token: str,
    x_session_token: str | None = Header(default=None, max_length=96),
    db: Session = Depends(get_db),
) -> CustomerSession:
    """Require a live guest session that belongs to the table in the URL.

    A session only works while all of these hold:
      - the table's *current* QR token is in the URL (rotating the token locks out old links)
      - the table is active
      - the session is active (staff can end it with "Clear table")
      - the session hasn't expired
      - the session was created at this table
    """
    table = get_active_table(db, table_token)
    session = None
    if x_session_token:
        session = db.scalar(
            select(CustomerSession).where(
                CustomerSession.session_token == x_session_token,
                CustomerSession.table_id == table.id,
                CustomerSession.active,
                CustomerSession.expires_at > datetime.now(timezone.utc),
            )
        )
    if session is None:
        raise HTTPException(401, "Your session has ended. Please scan the table QR code again.")
    return session


def new_session_token() -> str:
    return secrets.token_urlsafe(32)
