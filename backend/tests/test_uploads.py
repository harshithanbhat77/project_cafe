"""Owner uploads of menu photos and logos."""

from io import BytesIO
from pathlib import Path

from PIL import Image

from app.config import settings
from app.routers import admin_uploads


def image_bytes(fmt="PNG", size=(40, 30), mode="RGB", **save_args) -> bytes:
    buffer = BytesIO()
    Image.new(mode, size, "orange").save(buffer, fmt, **save_args)
    return buffer.getvalue()


def upload(client, headers, data: bytes, filename="photo.png", content_type="image/png"):
    return client.post("/api/admin/uploads", files={"file": (filename, data, content_type)}, headers=headers)


def test_upload_is_saved_as_webp_and_served(client, owner_headers):
    r = upload(client, owner_headers, image_bytes("JPEG"), "photo.jpg", "image/jpeg")
    assert r.status_code == 200, r.text
    url = r.json()["url"]
    assert url.startswith("/api/uploads/") and url.endswith(".webp")

    saved = Path(settings.upload_dir) / url.rsplit("/", 1)[1]
    with Image.open(saved) as image:
        assert image.format == "WEBP" and image.size == (40, 30)

    served = client.get(url)
    assert served.status_code == 200
    assert served.headers["content-type"] == "image/webp"
    assert "immutable" in served.headers["cache-control"]


def test_large_images_are_shrunk(client, owner_headers):
    url = upload(client, owner_headers, image_bytes(size=(3200, 1000))).json()["url"]
    with Image.open(Path(settings.upload_dir) / url.rsplit("/", 1)[1]) as image:
        assert image.size == (1600, 500)


def test_uploaded_image_can_be_used_on_the_menu(client, menu, owner_headers):
    url = upload(client, owner_headers, image_bytes()).json()["url"]
    r = client.patch(f"/api/admin/menu/{menu['toast'].id}", json={"image_url": url}, headers=owner_headers)
    assert r.status_code == 200 and r.json()["image_url"] == url


def test_non_images_are_rejected(client, owner_headers):
    assert upload(client, owner_headers, b"<svg onload=alert(1)>", "x.svg", "image/svg+xml").status_code == 422
    assert upload(client, owner_headers, b"%PDF-1.4 not an image", "x.png", "image/png").status_code == 422
    assert upload(client, owner_headers, image_bytes("GIF", mode="P"), "x.gif", "image/gif").status_code == 422


def test_oversized_files_are_rejected(client, owner_headers, monkeypatch):
    monkeypatch.setattr(admin_uploads, "MAX_UPLOAD_BYTES", 100)
    assert upload(client, owner_headers, image_bytes(size=(200, 200))).status_code == 413


def test_huge_dimensions_are_rejected(client, owner_headers, monkeypatch):
    monkeypatch.setattr(admin_uploads, "MAX_PIXELS", 1000)
    assert upload(client, owner_headers, image_bytes(size=(100, 100))).status_code == 422


def test_uploads_need_an_owner(client, staff_headers):
    assert upload(client, {}, image_bytes()).status_code == 401
    assert upload(client, staff_headers, image_bytes()).status_code == 403
