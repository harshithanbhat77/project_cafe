"""Order notes, service charge / tax on the bill, and the owner's daily summary."""

from datetime import datetime, timezone
from decimal import Decimal

import pytest
from sqlalchemy import select

from app.config import settings
from app.models import Order, OrderStatus
from app.pricing import percent_of
from conftest import place_order, start_session


@pytest.fixture
def charges(monkeypatch):
    monkeypatch.setattr(settings, "service_charge_percent", Decimal("10"))
    monkeypatch.setattr(settings, "tax_percent", Decimal("5"))


def test_rounding_is_half_up():
    assert percent_of(Decimal("0.10"), Decimal("5")) == Decimal("0.01")  # 0.005 → 0.01, not 0.00
    assert percent_of(Decimal("100"), Decimal("0")) == Decimal("0.00")


def test_bill_adds_service_then_tax(client, tables, menu, charges):
    session = start_session(client, tables["t1"])
    r = place_order(client, tables["t1"], session, [{"item_id": menu["toast"].id, "quantity": 1}, {"item_id": menu["pasta"].id, "quantity": 1}])
    order = r.json()
    # 240.00 + 320.50 = 560.50; service 10% = 56.05; tax 5% of 616.55 = 30.8275 → 30.83
    assert (order["subtotal"], order["service_charge"], order["tax"], order["total"]) == (560.5, 56.05, 30.83, 647.38)


def test_bill_is_frozen_when_rates_change(client, db, tables, menu, charges, monkeypatch):
    session = start_session(client, tables["t1"])
    order_id = place_order(client, tables["t1"], session, [{"item_id": menu["toast"].id, "quantity": 1}]).json()["id"]
    monkeypatch.setattr(settings, "tax_percent", Decimal("18"))
    orders = client.get(f"/api/public/tables/{tables['t1'].qr_token}/orders", headers={"X-Session-Token": session}).json()
    assert [o["total"] for o in orders if o["id"] == order_id] == [277.2]  # 240 + 24 + 13.20


def test_no_charges_by_default(client, tables, menu):
    session = start_session(client, tables["t1"])
    order = place_order(client, tables["t1"], session, [{"item_id": menu["toast"].id, "quantity": 2}]).json()
    assert (order["service_charge"], order["tax"], order["total"]) == (0, 0, 480)


def test_menu_shows_rates(client, tables, charges):
    body = client.get(f"/api/public/tables/{tables['t1'].qr_token}").json()
    assert body["charges"] == {"service_charge_percent": 10.0, "tax_percent": 5.0, "tax_label": "GST"}


def test_notes_reach_staff(client, tables, menu, owner_headers):
    session = start_session(client, tables["t1"])
    line = [{"item_id": menu["toast"].id, "quantity": 1}]
    order = place_order(client, tables["t1"], session, line, notes="  No onions please  ").json()
    assert order["notes"] == "No onions please"
    admin_view = client.get("/api/admin/orders", headers=owner_headers).json()
    assert admin_view[0]["notes"] == "No onions please"

    assert place_order(client, tables["t1"], session, line, key="key-blank-note", notes="   ").json()["notes"] is None
    assert place_order(client, tables["t1"], session, line, key="key-long-note", notes="x" * 301).status_code == 422


def _order_at(db, when_utc: datetime, status: OrderStatus):
    order = db.scalars(select(Order).order_by(Order.id.desc())).first()
    order.created_at = when_utc
    order.status = status
    db.commit()


def test_daily_summary(client, db, tables, menu, owner_headers):
    session = start_session(client, tables["t1"])
    toast, pasta = menu["toast"].id, menu["pasta"].id
    # 2026-09-24 20:00 UTC is 01:30 on the 25th in India, so it counts for the 25th.
    place_order(client, tables["t1"], session, [{"item_id": toast, "quantity": 2}], key="key-order-1")
    _order_at(db, datetime(2026, 9, 24, 20, 0, tzinfo=timezone.utc), OrderStatus.COMPLETED)
    place_order(client, tables["t1"], session, [{"item_id": pasta, "quantity": 1}], key="key-order-2")
    _order_at(db, datetime(2026, 9, 25, 10, 0, tzinfo=timezone.utc), OrderStatus.ACCEPTED)
    place_order(client, tables["t1"], session, [{"item_id": pasta, "quantity": 5}], key="key-order-3")
    _order_at(db, datetime(2026, 9, 25, 11, 0, tzinfo=timezone.utc), OrderStatus.CANCELLED)
    # 2026-09-25 19:00 UTC is 00:30 on the 26th in India: not counted.
    place_order(client, tables["t1"], session, [{"item_id": toast, "quantity": 1}], key="key-order-4")
    _order_at(db, datetime(2026, 9, 25, 19, 0, tzinfo=timezone.utc), OrderStatus.COMPLETED)

    r = client.get("/api/admin/summary?day=2026-09-25", headers=owner_headers)
    assert r.status_code == 200
    assert r.json() == {
        "day": "2026-09-25",
        "orders": 2,
        "cancelled": 1,
        "revenue": 800.5,  # 480 + 320.50; the cancelled order is excluded
        "top_items": [{"name": "Toast", "quantity": 2}, {"name": "Pasta", "quantity": 1}],
    }


def test_summary_for_a_quiet_day(client, owner_headers):
    r = client.get("/api/admin/summary?day=2020-01-01", headers=owner_headers)
    assert r.json() == {"day": "2020-01-01", "orders": 0, "cancelled": 0, "revenue": 0, "top_items": []}
    assert client.get("/api/admin/summary", headers=owner_headers).status_code == 200


def test_unknown_timezone_is_rejected():
    from pydantic import ValidationError

    from app.config import Settings

    with pytest.raises(ValidationError):
        Settings(jwt_secret="a" * 64, timezone="Mars/Olympus", _env_file=None)
