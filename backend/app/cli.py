"""Admin tasks, run inside the api container:

    docker compose exec api python -m app.cli create-admin --email owner@example.com
    docker compose exec api python -m app.cli seed-demo        # development only
"""

import argparse
import getpass
import sys
from decimal import Decimal

from sqlalchemy import select

from .config import settings
from .db import SessionLocal
from .models import CafeTable, Category, MenuItem, User
from .security import MIN_PASSWORD_LENGTH, hash_password


def create_admin(email: str, name: str) -> None:
    email = email.strip().lower()
    password = getpass.getpass(f"Password for {email} (min {MIN_PASSWORD_LENGTH} chars): ")
    if len(password) < MIN_PASSWORD_LENGTH:
        sys.exit(f"Password must be at least {MIN_PASSWORD_LENGTH} characters.")
    if password != getpass.getpass("Repeat password: "):
        sys.exit("Passwords do not match.")

    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email))
        if user:
            user.password_hash = hash_password(password)
            user.active = True
            print(f"Updated password for {email}.")
        else:
            db.add(User(name=name, email=email, password_hash=hash_password(password)))
            print(f"Created admin {email}.")
        db.commit()


def seed_demo() -> None:
    if settings.is_production:
        sys.exit("Refusing to seed demo data in production.")
    with SessionLocal() as db:
        if db.scalar(select(CafeTable).where(CafeTable.qr_token == "demo-table-7-token")):
            print("Demo data already present.")
            return
        category = Category(name="All-day favourites", description="Comfort food, made fresh.")
        db.add(category)
        db.flush()
        db.add(CafeTable(name="Table 7", qr_token="demo-table-7-token"))
        db.add_all(
            [
                MenuItem(
                    category_id=category.id,
                    name="Miso mushroom toast",
                    description="Sourdough, miso butter, herbs",
                    price=Decimal("240"),
                    image_url="https://images.unsplash.com/photo-1547592180-85f173990554?w=800",
                ),
                MenuItem(
                    category_id=category.id,
                    name="Smoky tomato pasta",
                    description="Roasted tomato, chilli, parmesan",
                    price=Decimal("320"),
                    image_url="https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=800",
                ),
                MenuItem(
                    category_id=category.id,
                    name="House cold brew",
                    description="Slow-steeped, bright and smooth",
                    price=Decimal("160"),
                    image_url="https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=800",
                ),
            ]
        )
        db.commit()
        print("Demo data created. Guest link: /order/demo-table-7-token")


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    commands = parser.add_subparsers(dest="command", required=True)
    admin = commands.add_parser("create-admin", help="Create an admin, or reset their password")
    admin.add_argument("--email", required=True)
    admin.add_argument("--name", default="Admin")
    commands.add_parser("seed-demo", help="Add a demo table and menu (development only)")

    args = parser.parse_args()
    if args.command == "create-admin":
        create_admin(args.email, args.name)
    elif args.command == "seed-demo":
        seed_demo()


if __name__ == "__main__":
    main()
