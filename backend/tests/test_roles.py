"""Staff run day-to-day service; only the owner changes the menu, tables and accounts."""

import re

import pytest
from fastapi.routing import APIRoute

from app.main import app
from app.security import require_owner
from conftest import ADMIN_PASSWORD, place_order, start_session

# Every owner-only endpoint. Staff must get 403 on all of them, whatever the body.
OWNER_ONLY_ENDPOINTS = [
    ("post", "/api/admin/categories"),
    ("patch", "/api/admin/categories/1"),
    ("post", "/api/admin/menu"),
    ("patch", "/api/admin/menu/1"),
    ("post", "/api/admin/tables"),
    ("patch", "/api/admin/tables/1"),
    ("post", "/api/admin/tables/1/rotate-token"),
    ("get", "/api/admin/users"),
    ("post", "/api/admin/users"),
    ("patch", "/api/admin/users/1"),
]


@pytest.mark.parametrize("method,path", OWNER_ONLY_ENDPOINTS)
def test_staff_cannot_use_owner_endpoints(client, menu, tables, staff_headers, method, path):
    kwargs = {"headers": staff_headers}
    if method != "get":
        kwargs["json"] = {}
    assert getattr(client, method)(path, **kwargs).status_code == 403


def test_owner_only_list_matches_the_app():
    """Keeps OWNER_ONLY_ENDPOINTS complete: a new owner-only route must be added to it."""

    def is_owner_only(route: APIRoute) -> bool:
        deps = list(route.dependant.dependencies)
        while deps:
            dep = deps.pop()
            if dep.call is require_owner:
                return True
            deps.extend(dep.dependencies)
        return False

    in_app = {
        (method.lower(), re.sub(r"\{\w+\}", "1", route.path))
        for route in app.routes
        if isinstance(route, APIRoute) and is_owner_only(route)
        for method in route.methods
    }
    assert in_app == set(OWNER_ONLY_ENDPOINTS)


def test_staff_can_run_service(client, db, tables, menu, staff_headers):
    session = start_session(client, tables["t1"])
    order_id = place_order(client, tables["t1"], session, [{"item_id": menu["toast"].id, "quantity": 1}]).json()["id"]

    assert client.get("/api/admin/orders", headers=staff_headers).status_code == 200
    r = client.patch(f"/api/admin/orders/{order_id}/status", json={"status": "ACCEPTED"}, headers=staff_headers)
    assert r.status_code == 200

    r = client.post(f"/api/admin/menu/{menu['toast'].id}/availability", json={"available": False}, headers=staff_headers)
    assert r.status_code == 200 and r.json()["available"] is False

    r = client.post(f"/api/admin/tables/{tables['t1'].id}/clear", headers=staff_headers)
    assert r.json() == {"ended_sessions": 1}

    for path in ("/api/admin/menu", "/api/admin/categories", "/api/admin/tables"):
        assert client.get(path, headers=staff_headers).status_code == 200


def test_me_returns_role(client, owner_headers, staff_headers):
    assert client.get("/api/admin/me", headers=owner_headers).json()["role"] == "OWNER"
    me = client.get("/api/admin/me", headers=staff_headers).json()
    assert me["role"] == "STAFF" and me["email"] == "sam@test.local"
    assert "password_hash" not in me


def test_owner_adds_staff_who_can_sign_in(client, owner_headers):
    r = client.post(
        "/api/admin/users",
        json={"name": "Priya", "email": " Priya@Test.local ", "role": "STAFF", "password": "priya-password-1"},
        headers=owner_headers,
    )
    assert r.status_code == 200, r.text
    assert r.json()["email"] == "priya@test.local"
    login = client.post("/api/admin/auth/login", json={"email": "priya@test.local", "password": "priya-password-1"})
    assert login.status_code == 200


def test_new_user_validation(client, owner, owner_headers):
    base = {"name": "Priya", "email": "priya@test.local", "password": "priya-password-1"}
    assert client.post("/api/admin/users", json={**base, "password": "short"}, headers=owner_headers).status_code == 422
    assert client.post("/api/admin/users", json={**base, "email": "not-an-email"}, headers=owner_headers).status_code == 422
    assert client.post("/api/admin/users", json={**base, "role": "ADMIN"}, headers=owner_headers).status_code == 422
    r = client.post("/api/admin/users", json={**base, "email": owner.email}, headers=owner_headers)
    assert r.status_code == 409


def test_owner_cannot_lock_themselves_out(client, owner, owner_headers):
    url = f"/api/admin/users/{owner.id}"
    assert client.patch(url, json={"active": False}, headers=owner_headers).status_code == 409
    assert client.patch(url, json={"role": "STAFF"}, headers=owner_headers).status_code == 409
    assert client.patch(url, json={"name": "The Owner"}, headers=owner_headers).status_code == 200


def test_deactivating_staff_signs_them_out(client, staff, staff_headers, owner_headers):
    assert client.get("/api/admin/orders", headers=staff_headers).status_code == 200
    client.patch(f"/api/admin/users/{staff.id}", json={"active": False}, headers=owner_headers)
    assert client.get("/api/admin/orders", headers=staff_headers).status_code == 401


def test_role_change_applies_to_existing_login(client, staff, staff_headers, owner_headers):
    assert client.get("/api/admin/users", headers=staff_headers).status_code == 403
    client.patch(f"/api/admin/users/{staff.id}", json={"role": "OWNER"}, headers=owner_headers)
    assert client.get("/api/admin/users", headers=staff_headers).status_code == 200


def test_owner_resets_staff_password(client, staff, owner_headers):
    r = client.patch(f"/api/admin/users/{staff.id}", json={"password": "brand-new-password"}, headers=owner_headers)
    assert r.status_code == 200
    old = client.post("/api/admin/auth/login", json={"email": staff.email, "password": ADMIN_PASSWORD})
    new = client.post("/api/admin/auth/login", json={"email": staff.email, "password": "brand-new-password"})
    assert old.status_code == 401 and new.status_code == 200
    assert client.patch(f"/api/admin/users/{staff.id}", json={"password": None}, headers=owner_headers).status_code == 422
