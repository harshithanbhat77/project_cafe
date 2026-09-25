"""Guests can only order at their own table and only see their own orders."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.models import CustomerSession, Order, OrderStatus
from app.routers.public import MAX_WAITING_ORDERS_PER_SESSION
from conftest import place_order, start_session


def test_menu_hides_inactive_items_and_shows_sold_out(client, tables, menu):
    r = client.get(f"/api/public/tables/{tables['t1'].qr_token}")
    assert r.status_code == 200
    body = r.json()
    assert body["table"] == {"name": "Table 1"}  # QR token is not echoed back
    names = {i["name"]: i["available"] for c in body["categories"] for i in c["items"]}
    assert names == {"Toast": True, "Pasta": True, "Soup": False}


def test_unknown_or_inactive_table_is_404(client, db, tables):
    assert client.get("/api/public/tables/not-a-real-token").status_code == 404
    tables["t1"].active = False
    db.commit()
    assert client.get(f"/api/public/tables/{tables['t1'].qr_token}").status_code == 404


def test_session_rejects_bad_name_or_phone(client, tables):
    url = f"/api/public/tables/{tables['t1'].qr_token}/session"
    assert client.post(url, json={"name": "A", "phone": "9876543210"}).status_code == 422
    assert client.post(url, json={"name": "Aanya", "phone": "call me"}).status_code == 422


def test_order_uses_database_prices(client, tables, menu):
    session = start_session(client, tables["t1"])
    r = place_order(client, tables["t1"], session, [{"item_id": menu["toast"].id, "quantity": 2}, {"item_id": menu["pasta"].id, "quantity": 1}])
    assert r.status_code == 200, r.text
    order = r.json()
    assert order["total"] == 800.5
    assert order["table_name"] == "Table 1"
    assert order["reference"].startswith("CF-")
    assert "customer_phone" not in order and "customer_name" not in order


def test_cannot_order_at_another_table_with_my_session(client, tables, menu):
    session = start_session(client, tables["t1"])
    r = place_order(client, tables["t2"], session, [{"item_id": menu["toast"].id, "quantity": 1}])
    assert r.status_code == 401


def test_order_without_session_is_rejected(client, tables, menu):
    r = client.post(
        f"/api/public/tables/{tables['t1'].qr_token}/orders",
        json={"items": [{"item_id": menu["toast"].id, "quantity": 1}], "idempotency_key": "key-00000001"},
    )
    assert r.status_code == 401
    assert place_order(client, tables["t1"], "made-up-session-token-value", [{"item_id": menu["toast"].id, "quantity": 1}]).status_code == 401


def test_expired_session_is_rejected(client, db, tables, menu):
    token = start_session(client, tables["t1"])
    session = db.scalar(select(CustomerSession).where(CustomerSession.session_token == token))
    session.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    db.commit()
    assert place_order(client, tables["t1"], token, [{"item_id": menu["toast"].id, "quantity": 1}]).status_code == 401


def test_cleared_table_ends_sessions(client, tables, menu, owner_headers):
    token = start_session(client, tables["t1"])
    r = client.post(f"/api/admin/tables/{tables['t1'].id}/clear", headers=owner_headers)
    assert r.json() == {"ended_sessions": 1}
    assert place_order(client, tables["t1"], token, [{"item_id": menu["toast"].id, "quantity": 1}]).status_code == 401


def test_rotated_token_locks_out_old_link_and_sessions(client, tables, menu, owner_headers):
    old_token = tables["t1"].qr_token
    session = start_session(client, tables["t1"])
    r = client.post(f"/api/admin/tables/{tables['t1'].id}/rotate-token", headers=owner_headers)
    new_token = r.json()["qr_token"]
    assert new_token != old_token
    assert client.get(f"/api/public/tables/{old_token}").status_code == 404
    # The old session doesn't work even with the new token.
    r = client.post(
        f"/api/public/tables/{new_token}/orders",
        json={"items": [{"item_id": menu["toast"].id, "quantity": 1}], "idempotency_key": "key-00000001"},
        headers={"X-Session-Token": session},
    )
    assert r.status_code == 401


def test_guest_only_sees_their_own_orders(client, tables, menu):
    alice = start_session(client, tables["t1"], name="Alice")
    bob = start_session(client, tables["t1"], name="Bob")
    place_order(client, tables["t1"], alice, [{"item_id": menu["toast"].id, "quantity": 1}], key="alice-key-1")
    place_order(client, tables["t1"], bob, [{"item_id": menu["pasta"].id, "quantity": 1}], key="bob-key-001")

    r = client.get(f"/api/public/tables/{tables['t1'].qr_token}/orders", headers={"X-Session-Token": alice})
    assert r.status_code == 200
    assert [[i["name"] for i in o["items"]] for o in r.json()] == [["Toast"]]


def test_old_lookup_by_reference_is_gone(client, tables, menu):
    session = start_session(client, tables["t1"])
    reference = place_order(client, tables["t1"], session, [{"item_id": menu["toast"].id, "quantity": 1}]).json()["reference"]
    assert client.get(f"/api/public/orders/{reference}").status_code == 404


def test_retry_with_same_key_returns_same_order(client, db, tables, menu):
    session = start_session(client, tables["t1"])
    first = place_order(client, tables["t1"], session, [{"item_id": menu["toast"].id, "quantity": 1}])
    second = place_order(client, tables["t1"], session, [{"item_id": menu["toast"].id, "quantity": 1}])
    assert first.json()["id"] == second.json()["id"]
    assert len(db.scalars(select(Order)).all()) == 1


def test_reusing_another_guests_key_does_not_leak_their_order(client, tables, menu):
    alice = start_session(client, tables["t1"], name="Alice")
    mallory = start_session(client, tables["t2"], name="Mallory")
    alice_order = place_order(client, tables["t1"], alice, [{"item_id": menu["pasta"].id, "quantity": 3}], key="shared-key-1").json()
    r = place_order(client, tables["t2"], mallory, [{"item_id": menu["toast"].id, "quantity": 1}], key="shared-key-1")
    assert r.status_code == 200
    assert r.json()["id"] != alice_order["id"]
    assert r.json()["table_name"] == "Table 2"


def test_sold_out_hidden_and_unknown_items_are_rejected(client, tables, menu):
    session = start_session(client, tables["t1"])
    for name in ("sold_out", "hidden", "in_hidden_category"):
        r = place_order(client, tables["t1"], session, [{"item_id": menu[name].id, "quantity": 1}], key=f"key-{name}")
        assert r.status_code == 409, name
    r = place_order(client, tables["t1"], session, [{"item_id": 99999, "quantity": 1}], key="key-unknown")
    assert r.status_code == 409


def test_bad_quantities_and_duplicates_are_rejected(client, tables, menu):
    session = start_session(client, tables["t1"])
    toast = menu["toast"].id
    assert place_order(client, tables["t1"], session, [{"item_id": toast, "quantity": 0}]).status_code == 422
    assert place_order(client, tables["t1"], session, [{"item_id": toast, "quantity": 51}]).status_code == 422
    assert place_order(client, tables["t1"], session, [{"item_id": toast, "quantity": 1}] * 2).status_code == 422


def test_waiting_orders_are_capped_per_session(client, db, tables, menu):
    session = start_session(client, tables["t1"])
    line = [{"item_id": menu["toast"].id, "quantity": 1}]
    for n in range(MAX_WAITING_ORDERS_PER_SESSION):
        assert place_order(client, tables["t1"], session, line, key=f"key-000000{n}").status_code == 200
    assert place_order(client, tables["t1"], session, line, key="key-overflow").status_code == 409

    # Once staff accept one, the guest can order again.
    order = db.scalars(select(Order)).first()
    order.status = OrderStatus.ACCEPTED
    db.commit()
    assert place_order(client, tables["t1"], session, line, key="key-after-accept").status_code == 200
