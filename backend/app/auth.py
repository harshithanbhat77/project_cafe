from datetime import datetime,timedelta,timezone
from fastapi import Depends,HTTPException
from fastapi.security import HTTPBearer,HTTPAuthorizationCredentials
from jose import jwt,JWTError
from pwdlib import PasswordHash
from sqlalchemy import select
from sqlalchemy.orm import Session
from .config import settings
from .db import get_db
from .models import User
hash_password=PasswordHash.recommended(); bearer=HTTPBearer()
def verify_password(raw,hashed): return hash_password.verify(raw,hashed)
def make_token(user): return jwt.encode({"sub":str(user.id),"role":user.role.value,"exp":datetime.now(timezone.utc)+timedelta(minutes=settings.access_token_minutes)},settings.jwt_secret,algorithm="HS256")
def current_admin(creds:HTTPAuthorizationCredentials=Depends(bearer),db:Session=Depends(get_db)):
    try: p=jwt.decode(creds.credentials,settings.jwt_secret,algorithms=["HS256"]); u=db.scalar(select(User).where(User.id==int(p["sub"])))
    except (JWTError,KeyError,ValueError): u=None
    if not u or not u.active or u.role.value!="ADMIN": raise HTTPException(401,"Authentication required")
    return u
