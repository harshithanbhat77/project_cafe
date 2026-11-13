"""Guests asking for a waiter or the bill, and staff dealing with it."""

from datetime import datetime, timedelta, timezone

from app.models import CustomerSession
from conftest import start_session


def ask(client, table, session, kind="WAITER"):
    return client.post(
        f"/api/public/tables/{table.qr_token}/requests", json={"kind": kind}, headers={"X-Session-Token": session}
    )


def mine(client, table, session):
    return client.get(f"/api/public/tables/{table.qr_token}/requests", headers={"X-Session-Token": session}).json()


def test_guest_calls_waiter_and_staff_resolve_it(client, tables, staff_headers):
    session = start_session(client, tables["t1"], name="Aanya")
    r = ask(client, tables["t1"], session, "BILL")
    assert r.status_code == 200 and r.json()["kind"] == "BILL"

    staff_view = client.get("/api/admin/requests", headers=staff_headers).json()
    assert [(x["kind"], x["table_name"], x["customer_name"]) for x in staff_view] == [("BILL", "Table 1", "Aanya")]
    assert [x["kind"] for x in mine(client, tables["t1"], session)] == ["BILL"]

    request_id = staff_view[0]["id"]
    assert client.post(f"/api/admin/requests/{request_id}/resolve", headers=staff_headers).status_code == 204
    # Resolving again is harmless.
    assert client.post(f"/api/admin/requests/{request_id}/resolve", headers=staff_headers).status_code == 204
    assert client.get("/api/admin/requests", headers=staff_headers).json() == []
    assert mine(client, tables["t1"], session) == []


def test_asking_twice_does_not_duplicate(client, tables, staff_headers):
    session = start_session(client, tables["t1"])
    first = ask(client, tables["t1"], session).json()
    assert ask(client, tables["t1"], session).json()["id"] == first["id"]
    ask(client, tables["t1"], session, "BILL")
    kinds = sorted(x["kind"] for x in client.get("/api/admin/requests", headers=staff_headers).json())
    assert kinds == ["BILL", "WAITER"]


def test_guests_only_see_their_own_requests(client, tables):
    alice = start_session(client, tables["t1"], name="Alice")
    bob = start_session(client, tables["t1"], name="Bob")
    ask(client, tables["t1"], alice)
    assert mine(client, tables["t1"], bob) == []
    # A session can't be used at another table.
    assert ask(client, tables["t2"], alice).status_code == 401


def test_requests_need_a_session_and_a_valid_kind(client, tables):
    url = f"/api/public/tables/{tables['t1'].qr_token}/requests"
    assert client.post(url, json={"kind": "WAITER"}).status_code == 401
    session = start_session(client, tables["t1"])
    assert ask(client, tables["t1"], session, "DANCE").status_code == 422


def test_clearing_the_table_closes_its_requests(client, tables, staff_headers):
    at_t1 = start_session(client, tables["t1"])
    at_t2 = start_session(client, tables["t2"])
    ask(client, tables["t1"], at_t1)
    ask(client, tables["t2"], at_t2)
    client.post(f"/api/admin/tables/{tables['t1'].id}/clear", headers=staff_headers)
    assert [x["table_name"] for x in client.get("/api/admin/requests", headers=staff_headers).json()] == ["Table 2"]


def test_requests_from_expired_sessions_are_hidden(client, db, tables, staff_headers):
    session = start_session(client, tables["t1"])
    ask(client, tables["t1"], session)
    row = db.query(CustomerSession).filter_by(session_token=session).one()
    row.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    db.commit()
    assert client.get("/api/admin/requests", headers=staff_headers).json() == []


def test_staff_must_sign_in(client):
    assert client.get("/api/admin/requests").status_code == 401
    assert client.post("/api/admin/requests/1/resolve").status_code == 401
