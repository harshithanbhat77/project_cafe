"""Restaurant settings: name, branding and bill rates, editable by the owner."""

from decimal import Decimal

from app.config import settings
from app.restaurant import get_restaurant
from conftest import place_order, start_session


def test_first_use_takes_env_defaults(client, owner_headers, monkeypatch):
    monkeypatch.setattr(settings, "service_charge_percent", Decimal("7.5"))
    monkeypatch.setattr(settings, "currency", "usd")
    body = client.get("/api/admin/settings", headers=owner_headers).json()
    assert body == {
        "name": "CafeFlow",
        "logo_url": None,
        "accent_color": "#b4532a",
        "currency": "USD",
        "service_charge_percent": 7.5,
        "tax_percent": 0.0,
        "tax_label": "GST",
    }


def test_staff_can_read_but_not_change(client, staff_headers):
    assert client.get("/api/admin/settings", headers=staff_headers).status_code == 200
    assert client.patch("/api/admin/settings", json={"name": "X"}, headers=staff_headers).status_code == 403


def test_owner_changes_brand_and_guests_see_it(client, tables, owner_headers):
    r = client.patch(
        "/api/admin/settings",
        json={"name": "  Blue Door Café ", "accent_color": "#1D4ED8", "currency": "eur", "logo_url": "https://example.com/l.png"},
        headers=owner_headers,
    )
    assert r.status_code == 200, r.text
    expected = {"name": "Blue Door Café", "logo_url": "https://example.com/l.png", "accent_color": "#1d4ed8", "currency": "EUR"}
    assert client.get("/api/public/brand").json() == expected
    assert client.get(f"/api/public/tables/{tables['t1'].qr_token}").json()["restaurant"] == expected

    # The logo can be removed again.
    r = client.patch("/api/admin/settings", json={"logo_url": None}, headers=owner_headers)
    assert r.json()["logo_url"] is None


def test_new_rates_apply_to_new_orders(client, tables, menu, owner_headers):
    r = client.patch(
        "/api/admin/settings",
        json={"service_charge_percent": "10", "tax_percent": "5", "tax_label": "VAT"},
        headers=owner_headers,
    )
    assert r.status_code == 200
    body = client.get(f"/api/public/tables/{tables['t1'].qr_token}").json()
    assert body["charges"] == {"service_charge_percent": 10.0, "tax_percent": 5.0, "tax_label": "VAT"}

    session = start_session(client, tables["t1"])
    order = place_order(client, tables["t1"], session, [{"item_id": menu["toast"].id, "quantity": 1}]).json()
    assert (order["service_charge"], order["tax"], order["total"]) == (24, 13.2, 277.2)


def test_invalid_settings_are_rejected(client, owner_headers):
    bad = [
        {"name": "   "},
        {"name": None},
        {"accent_color": "red"},
        {"accent_color": "#12345"},
        {"currency": "RUPEE"},
        {"service_charge_percent": "-1"},
        {"tax_percent": "101"},
        {"tax_percent": "5.555"},
        {"logo_url": "http://insecure.example.com/logo.png"},
        {"logo_url": "/api/uploads/../../etc/passwd"},
    ]
    for body in bad:
        assert client.patch("/api/admin/settings", json=body, headers=owner_headers).status_code == 422, body


def test_settings_row_is_created_once(db):
    assert get_restaurant(db) is get_restaurant(db)
    assert get_restaurant(db).id == 1
