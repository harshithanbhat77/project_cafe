"""Only admins can see all orders and change orders, the menu and tables."""

from datetime import datetime, timedelta, timezone

import jwt
import pytest

from app.config import settings
from app.limits import limiter
from app.models import OrderStatus
from app.routers.admin_orders import TRANSITIONS
from conftest import ADMIN_PASSWORD, place_order, start_session

ADMIN_ENDPOINTS = [
    ("get", "/api/admin/me"),
    ("get", "/api/admin/orders"),
    ("patch", "/api/admin/orders/1/status"),
    ("get", "/api/admin/menu"),
    ("post", "/api/admin/menu"),
    ("patch", "/api/admin/menu/1"),
    ("post", "/api/admin/menu/1/availability"),
    ("get", "/api/admin/categories"),
    ("post", "/api/admin/categories"),
    ("get", "/api/admin/tables"),
    ("post", "/api/admin/tables"),
    ("post", "/api/admin/tables/1/clear"),
    ("post", "/api/admin/tables/1/rotate-token"),
    ("get", "/api/admin/users"),
    ("post", "/api/admin/users"),
    ("patch", "/api/admin/users/1"),
]


def _token(sub: str, secret: str = settings.jwt_secret, minutes: int = 5) -> dict:
    now = datetime.now(timezone.utc)
    token = jwt.encode({"sub": sub, "iat": now, "exp": now + timedelta(minutes=minutes)}, secret, algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.parametrize("method,path", ADMIN_ENDPOINTS)
def test_admin_endpoints_require_login(client, method, path):
    assert getattr(client, method)(path).status_code == 401


def test_bad_tokens_are_rejected(client, owner):
    sub = str(owner.id)
    assert client.get("/api/admin/orders", headers=_token(sub, secret="x" * 40)).status_code == 401
    assert client.get("/api/admin/orders", headers=_token(sub, minutes=-1)).status_code == 401
    assert client.get("/api/admin/orders", headers=_token("99999")).status_code == 401
    assert client.get("/api/admin/orders", headers={"Authorization": "Bearer nonsense"}).status_code == 401
    unsigned = jwt.encode({"sub": sub}, key=None, algorithm="none")
    assert client.get("/api/admin/orders", headers={"Authorization": f"Bearer {unsigned}"}).status_code == 401


def test_deactivated_user_is_locked_out(client, db, owner, owner_headers):
    assert client.get("/api/admin/orders", headers=owner_headers).status_code == 200
    owner.active = False
    db.commit()
    assert client.get("/api/admin/orders", headers=owner_headers).status_code == 401


def test_login(client, owner):
    ok = client.post("/api/admin/auth/login", json={"email": " Owner@Test.local ", "password": ADMIN_PASSWORD})
    assert ok.status_code == 200
    headers = {"Authorization": f"Bearer {ok.json()['access_token']}"}
    assert client.get("/api/admin/orders", headers=headers).status_code == 200

    wrong_password = client.post("/api/admin/auth/login", json={"email": owner.email, "password": "nope"})
    unknown_email = client.post("/api/admin/auth/login", json={"email": "who@test.local", "password": "nope"})
    assert wrong_password.status_code == unknown_email.status_code == 401
    assert wrong_password.json() == unknown_email.json()


def test_login_is_rate_limited(client, owner):
    limiter.enabled = True
    codes = [
        client.post("/api/admin/auth/login", json={"email": owner.email, "password": "wrong"}).status_code
        for _ in range(6)
    ]
    assert codes == [401] * 5 + [429]


def test_admin_sees_all_orders_with_customer_details(client, tables, menu, owner_headers):
    alice = start_session(client, tables["t1"], name="Alice", phone="9876543210")
    bob = start_session(client, tables["t2"], name="Bob", phone="9123456780")
    place_order(client, tables["t1"], alice, [{"item_id": menu["toast"].id, "quantity": 1}], key="alice-key-1")
    place_order(client, tables["t2"], bob, [{"item_id": menu["pasta"].id, "quantity": 1}], key="bob-key-001")

    orders = client.get("/api/admin/orders", headers=owner_headers).json()
    assert {(o["customer_name"], o["customer_phone"], o["table_name"]) for o in orders} == {
        ("Alice", "9876543210", "Table 1"),
        ("Bob", "9123456780", "Table 2"),
    }
    placed = client.get("/api/admin/orders?status=PLACED&limit=1", headers=owner_headers).json()
    assert len(placed) == 1


def test_status_transitions(client, tables, menu, owner_headers):
    session = start_session(client, tables["t1"])
    order_id = place_order(client, tables["t1"], session, [{"item_id": menu["toast"].id, "quantity": 1}]).json()["id"]
    url = f"/api/admin/orders/{order_id}/status"

    assert client.patch(url, json={"status": "READY"}, headers=owner_headers).status_code == 409
    for status in ("ACCEPTED", "PREPARING", "READY", "COMPLETED"):
        r = client.patch(url, json={"status": status}, headers=owner_headers)
        assert r.status_code == 200 and r.json()["status"] == status
    assert client.patch(url, json={"status": "CANCELLED"}, headers=owner_headers).status_code == 409
    assert client.patch("/api/admin/orders/99999/status", json={"status": "ACCEPTED"}, headers=owner_headers).status_code == 404


def test_transitions_never_go_backwards():
    assert TRANSITIONS[OrderStatus.COMPLETED] == set()
    assert TRANSITIONS[OrderStatus.CANCELLED] == set()
    assert OrderStatus.PLACED not in {s for targets in TRANSITIONS.values() for s in targets}


def test_mark_item_sold_out_with_partial_update(client, menu, owner_headers):
    toast = menu["toast"]
    r = client.patch(f"/api/admin/menu/{toast.id}", json={"available": False}, headers=owner_headers)
    assert r.status_code == 200
    assert r.json()["available"] is False
    assert r.json()["name"] == "Toast" and r.json()["price"] == 240.0


def test_menu_item_validation(client, menu, owner_headers):
    url = f"/api/admin/menu/{menu['toast'].id}"
    assert client.patch(url, json={"price": -1}, headers=owner_headers).status_code == 422
    assert client.patch(url, json={"price": "1.234"}, headers=owner_headers).status_code == 422
    assert client.patch(url, json={"name": None}, headers=owner_headers).status_code == 422
    assert client.patch(url, json={"image_url": "javascript:alert(1)"}, headers=owner_headers).status_code == 422
    assert client.patch(url, json={"category_id": 99999}, headers=owner_headers).status_code == 422
    assert client.patch(url, json={"image_url": None}, headers=owner_headers).status_code == 200
    assert client.patch("/api/admin/menu/99999", json={"available": True}, headers=owner_headers).status_code == 404


def test_create_category_and_item(client, owner_headers):
    category = client.post("/api/admin/categories", json={"name": "Drinks"}, headers=owner_headers)
    assert category.status_code == 200
    assert client.post("/api/admin/categories", json={"name": "Drinks"}, headers=owner_headers).status_code == 409
    item = client.post(
        "/api/admin/menu",
        json={"category_id": category.json()["id"], "name": "Cold brew", "price": "160.00"},
        headers=owner_headers,
    )
    assert item.status_code == 200
    assert item.json()["price"] == 160.0


def test_create_and_update_table(client, owner_headers):
    r = client.post("/api/admin/tables", json={"name": "Patio 1"}, headers=owner_headers)
    assert r.status_code == 200 and len(r.json()["qr_token"]) >= 32
    table_id = r.json()["id"]
    r = client.patch(f"/api/admin/tables/{table_id}", json={"active": False}, headers=owner_headers)
    assert r.json()["active"] is False and r.json()["name"] == "Patio 1"
