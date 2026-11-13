import logging
import mimetypes
from pathlib import Path

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db
from .limits import limiter
from .routers import (
    admin_auth,
    admin_menu,
    admin_orders,
    admin_requests,
    admin_tables,
    admin_uploads,
    admin_users,
    public,
    restaurant,
)

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
app.include_router(admin_auth.router)
app.include_router(admin_orders.router)
app.include_router(admin_menu.router)
app.include_router(admin_tables.router)
app.include_router(admin_users.router)
app.include_router(admin_uploads.router)
app.include_router(admin_requests.router)
app.include_router(restaurant.public_router)
app.include_router(restaurant.admin_router)


class UploadedFiles(StaticFiles):
    """Uploaded images never change (each upload gets a new random name), so browsers can cache them forever."""

    def file_response(self, *args, **kwargs):
        response = super().file_response(*args, **kwargs)
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response


# Slim Linux images don't always know .webp; without this it would be served as text/plain,
# which browsers refuse to show as an image because of the nosniff header.
mimetypes.add_type("image/webp", ".webp")
Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
app.mount("/api/uploads", UploadedFiles(directory=settings.upload_dir), name="uploads")
