import logging

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db
from .limits import limiter
from .routers import admin, public

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="CafeFlow API",
    version="1.1.0",
    # Don't publish the API map in production.
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None,
    openapi_url=None if settings.is_production else "/openapi.json",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["Authorization", "Content-Type", "X-Session-Token"],
)


@app.middleware("http")
async def security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response


@app.get("/health")
def health(db: Session = Depends(get_db)):
    """For uptime checks: fails if the database is unreachable."""
    db.execute(text("SELECT 1"))
    return {"status": "ok"}


app.include_router(public.router)
app.include_router(admin.auth_router)
app.include_router(admin.router)
