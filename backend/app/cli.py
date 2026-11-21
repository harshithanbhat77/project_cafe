"""Admin tasks, run inside the api container:

    docker compose exec api python -m app.cli create-user --email owner@example.com            # owner
    docker compose exec api python -m app.cli create-user --email sam@example.com --role staff
    docker compose exec api python -m app.cli seed-demo        # development only
"""

import argparse
import getpass
import sys
from decimal import Decimal

from sqlalchemy import select

from .config import settings
from .db import SessionLocal
from .models import CafeTable, Category, Diet, MenuItem, Role, User
from .security import MIN_PASSWORD_LENGTH, hash_password


def create_user(email: str, name: str, role: Role) -> None:
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
            user.role = role
            user.active = True
            print(f"Updated {email}: password reset, role {role.value}.")
        else:
            db.add(User(name=name, email=email, role=role, password_hash=hash_password(password)))
            print(f"Created {role.value.lower()} {email}.")
        db.commit()


def _photo(photo_id: str) -> str:
    return f"https://images.unsplash.com/photo-{photo_id}?w=800&q=80"


# (name, description, price, photo, diet, spicy, bestseller) per category.
DEMO_MENU: dict[str, tuple[str, list[tuple]]] = {
    "Breakfast": (
        "Served all day.",
        [
            ("Avocado egg toast", "Sourdough, smashed avocado, fried egg, chilli flakes", "260", "1525351484163-7529414344d8", Diet.EGG, False, True),
            ("Berry French toast", "Brioche, mixed berries, banana, maple syrup", "290", "1484723091739-30a097e8f929", Diet.EGG, False, False),
            ("Buttermilk pancakes", "Stack of three, honey butter, fresh mint", "270", "1567620905732-2d1ec7ab7445", Diet.EGG, False, False),
        ],
    ),
    "Small plates": (
        "Good for sharing.",
        [
            ("Punjabi samosa", "Two crisp pastries, spiced potato and peas, mint chutney", "140", "1601050690597-df0568f70950", Diet.VEG, True, True),
            ("Rainbow Buddha bowl", "Chickpeas, roast sweet potato, avocado, greens, tahini", "340", "1512621776951-a57141f2eefd", Diet.VEGAN, False, False),
            ("Chilli chicken skewers", "Charred chicken, smoky chilli glaze, garlic dip", "380", "1555939594-58d7cb561ad1", Diet.NON_VEG, True, False),
        ],
    ),
    "Mains": (
        "Freshly made to order.",
        [
            ("Pesto farfalle", "Basil pesto, cherry tomatoes, parmesan", "360", "1473093295043-cdd812d0e601", Diet.VEG, False, False),
            ("Classic smash burger", "Double patty, cheddar, pickles, house sauce, fries", "420", "1568901346375-23c9450c58cd", Diet.NON_VEG, False, True),
            ("Butter chicken & rice", "Creamy tomato curry, basmati rice, naan", "440", "1585937421612-70a008356fbe", Diet.NON_VEG, False, False),
            ("Paneer tikka pizza", "Tandoori paneer, peppers, red onion, mozzarella", "450", "1565299624946-b28f40a0ae38", Diet.VEG, True, False),
            ("Salmon poke bowl", "Seared salmon, rice, egg, corn, pickled cabbage", "520", "1546069901-ba9599a7e63c", Diet.NON_VEG, False, False),
        ],
    ),
    "Coffee & drinks": (
        "",
        [
            ("Cappuccino", "Double shot, velvety foam", "180", "1509042239860-f550ce710b93", Diet.VEG, False, True),
            ("House cold brew", "Slow-steeped for 18 hours, splash of milk", "200", "1517701604599-bb29b565090c", Diet.VEG, False, False),
            ("Masala chai", "Assam tea, ginger, cardamom, whole milk", "120", "1571934811356-5cc061b6821f", Diet.VEG, False, False),
            ("Iced lemon tea", "Black tea, fresh lime, a little sugar", "150", "1556679343-c7306c1976bc", Diet.VEGAN, False, False),
        ],
    ),
    "Desserts": (
        "",
        [
            ("Triple chocolate cake", "Dark chocolate sponge, ganache, cocoa cream", "260", "1578985545062-69928b1d9587", Diet.EGG, False, True),
            ("Strawberry panna cotta", "Vanilla cream, fresh strawberries", "240", "1488477181946-6428a0291777", Diet.VEG, False, False),
            ("Brownie sundae", "Warm brownie, vanilla ice cream, fudge sauce", "280", "1563805042-7684c019e1cb", Diet.EGG, False, False),
        ],
    ),
}
DEMO_TABLES = ["Table 1", "Table 2", "Table 3", "Table 4", "Table 5", "Table 6", "Patio 1", "Patio 2"]


def seed_demo() -> None:
    """Add a demo menu and tables. Safe to run again: anything that already exists is skipped."""
    if settings.is_production:
        sys.exit("Refusing to seed demo data in production.")
    with SessionLocal() as db:
        if not db.scalar(select(CafeTable).where(CafeTable.qr_token == "demo-table-7-token")):
            db.add(CafeTable(name="Table 7", qr_token="demo-table-7-token"))
        existing_tables = set(db.scalars(select(CafeTable.name)).all())
        db.add_all(CafeTable(name=name) for name in DEMO_TABLES if name not in existing_tables)

        for category_name, (description, items) in DEMO_MENU.items():
            if db.scalar(select(Category).where(Category.name == category_name)):
                continue
            category = Category(name=category_name, description=description)
            db.add(category)
            db.flush()
            db.add_all(
                MenuItem(
                    category_id=category.id,
                    name=name,
                    description=item_description,
                    price=Decimal(price),
                    image_url=_photo(photo),
                    diet=diet,
                    spicy=spicy,
                    bestseller=bestseller,
                )
                for name, item_description, price, photo, diet, spicy, bestseller in items
            )
        db.commit()
        print("Demo data ready. Guest link: /order/demo-table-7-token")


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    commands = parser.add_subparsers(dest="command", required=True)
    user = commands.add_parser("create-user", help="Create a dashboard login, or reset its password and role")
    user.add_argument("--email", required=True)
    user.add_argument("--name", default="Owner")
    user.add_argument("--role", choices=["owner", "staff"], default="owner")
    commands.add_parser("seed-demo", help="Add demo tables and a demo menu (development only)")

    args = parser.parse_args()
    if args.command == "create-user":
        create_user(args.email, args.name, Role(args.role.upper()))
    elif args.command == "seed-demo":
        seed_demo()


if __name__ == "__main__":
    main()
