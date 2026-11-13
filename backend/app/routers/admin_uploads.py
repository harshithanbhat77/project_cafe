"""Owner: upload a menu photo or logo. Images are checked, resized and re-saved as WebP,
which also strips location and camera data from phone photos."""

import secrets
import warnings
from io import BytesIO
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

from ..config import settings
from ..schemas import UploadOut
from ..security import OWNER_ONLY, current_user

router = APIRouter(prefix="/api/admin", tags=["admin: uploads"], dependencies=[Depends(current_user)])

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_SIDE = 1600  # pixels; plenty for a phone screen, and keeps files small
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
# Refuse "decompression bombs": tiny files that expand to huge images in memory.
MAX_PIXELS = 40_000_000


@router.post("/uploads", response_model=UploadOut, dependencies=OWNER_ONLY)
def upload_image(file: UploadFile):
    data = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "That image is too large. The limit is 5 MB.")

    not_an_image = HTTPException(422, "Upload a JPG, PNG or WebP image.")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            image = Image.open(BytesIO(data))
            if image.format not in ALLOWED_FORMATS:
                raise not_an_image
            if image.width * image.height > MAX_PIXELS:
                raise not_an_image
            image.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombWarning, Image.DecompressionBombError):
        raise not_an_image

    image = ImageOps.exif_transpose(image)  # keep phone photos the right way up
    image.thumbnail((MAX_SIDE, MAX_SIDE))
    if image.mode not in ("RGB", "RGBA"):
        image = image.convert("RGBA" if "transparency" in image.info or image.mode in ("LA", "PA") else "RGB")

    name = f"{secrets.token_urlsafe(16)}.webp"
    folder = Path(settings.upload_dir)
    folder.mkdir(parents=True, exist_ok=True)
    image.save(folder / name, "WEBP", quality=82, method=4)
    return UploadOut(url=f"/api/uploads/{name}")
