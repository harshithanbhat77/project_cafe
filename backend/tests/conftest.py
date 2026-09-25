"""Test setup: an in-memory SQLite database per test, no external services needed."""

import os

# Must be set before the app (and its settings) are imported.
os.environ.setdefault("JWT_SECRET", "test-secret-that-is-at-least-32-characters-long")
os.environ.setdefault("DATABASE_URL", "sqlite://")

from decimal import Decimal  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.db import Base, get_db  # noqa: E402
from app.limits import limiter  # noqa: E402
from app.main import app  # noqa: E402
from app.models import CafeTable, Category, MenuItem, Role, User  # noqa: E402
from app.security import hash_password, make_admin_token  # noqa: E402

ADMIN_PASSWORD = "correct-horse-battery"


@pytest.fixture
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine, autoflush=False)

    def override_get_db():
        with TestSession() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    with TestSession() as session:
        yield session
    app.dependency_overrides.clear()
    engine.dispose()


@pytest.fixture
def client(db):
    limiter.enabled = False
    limiter.reset()
    yield TestClient(app)
    limiter.enabled = True


@pytest.fixture
def owner(db) -> User:
    user = User(name="Owner", email="owner@test.local", role=Role.OWNER, password_hash=hash_password(ADMIN_PASSWORD))
    db.add(user)
    db.commit()
    return user


@pytest.fixture
def owner_headers(owner) -> dict:
    return {"Authorization": f"Bearer {make_admin_token(owner)}"}


@pytest.fixture
def staff(db) -> User:
    user = User(name="Sam", email="sam@test.local", role=Role.STAFF, password_hash=hash_password(ADMIN_PASSWORD))
    db.add(user)
    db.commit()
    return user


@pytest.fixture
def staff_headers(staff) -> dict:
    return {"Authorization": f"Bearer {make_admin_token(staff)}"}


@pytest.fixture
def menu(db) -> dict:
    """One active category with a normal item, a sold-out item and a hidden item,
    plus an item in a hidden category."""
    food = Category(name="Food")
    hidden_category = Category(name="Old menu", active=False)
    db.add_all([food, hidden_category])
    db.flush()
    items = {
        "toast": MenuItem(category_id=food.id, name="Toast", price=Decimal("240.00")),
        "pasta": MenuItem(category_id=food.id, name="Pasta", price=Decimal("320.50")),
        "sold_out": MenuItem(category_id=food.id, name="Soup", price=Decimal("100"), available=False),
        "hidden": MenuItem(category_id=food.id, name="Retired", price=Decimal("100"), active=False),
        "in_hidden_category": MenuItem(category_id=hidden_category.id, name="Old dish", price=Decimal("100")),
    }
    db.add_all(items.values())
    db.commit()
    return items


@pytest.fixture
def tables(db) -> dict:
    t1 = CafeTable(name="Table 1")
    t2 = CafeTable(name="Table 2")
    db.add_all([t1, t2])
    db.commit()
    return {"t1": t1, "t2": t2}


def start_session(client: TestClient, table: CafeTable, name="Aanya", phone="+91 98765 43210") -> str:
    r = client.post(f"/api/public/tables/{table.qr_token}/session", json={"name": name, "phone": phone})
    assert r.status_code == 200, r.text
    return r.json()["session_token"]


def place_order(client: TestClient, table: CafeTable, session_token: str, items: list[dict], key="key-00000001"):
    return client.post(
        f"/api/public/tables/{table.qr_token}/orders",
        json={"items": items, "idempotency_key": key},
        headers={"X-Session-Token": session_token},
    )
