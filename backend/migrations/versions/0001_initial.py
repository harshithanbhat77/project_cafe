"""Initial schema.

Revision ID: 0001
"""

import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None


def upgrade():
    op.create_table(
        "users",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("active", sa.Boolean, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "cafe_tables",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("qr_token", sa.String(96), nullable=False),
        sa.Column("active", sa.Boolean, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_cafe_tables_qr_token", "cafe_tables", ["qr_token"], unique=True)

    op.create_table(
        "categories",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(80), nullable=False, unique=True),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("active", sa.Boolean, nullable=False),
    )

    op.create_table(
        "menu_items",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("category_id", sa.Integer, sa.ForeignKey("categories.id"), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("price", sa.Numeric(10, 2), nullable=False),
        sa.Column("image_url", sa.String(500), nullable=True),
        sa.Column("available", sa.Boolean, nullable=False),
        sa.Column("active", sa.Boolean, nullable=False),
        sa.CheckConstraint("price >= 0", name="ck_menu_items_price_non_negative"),
    )

    op.create_table(
        "customer_sessions",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("session_token", sa.String(96), nullable=False),
        sa.Column("table_id", sa.Integer, sa.ForeignKey("cafe_tables.id"), nullable=False),
        sa.Column("customer_name", sa.String(100), nullable=False),
        sa.Column("customer_phone", sa.String(32), nullable=False),
        sa.Column("active", sa.Boolean, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_customer_sessions_session_token", "customer_sessions", ["session_token"], unique=True)
    op.create_index("ix_customer_sessions_table_id", "customer_sessions", ["table_id"])

    op.create_table(
        "orders",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("table_id", sa.Integer, sa.ForeignKey("cafe_tables.id"), nullable=False),
        sa.Column("customer_session_id", sa.Integer, sa.ForeignKey("customer_sessions.id"), nullable=False),
        sa.Column("customer_name", sa.String(100), nullable=False),
        sa.Column("customer_phone", sa.String(32), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("subtotal", sa.Numeric(10, 2), nullable=False),
        sa.Column("total", sa.Numeric(10, 2), nullable=False),
        sa.Column("idempotency_key", sa.String(120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("customer_session_id", "idempotency_key", name="uq_orders_session_idempotency"),
    )
    op.create_index("ix_orders_customer_session_id", "orders", ["customer_session_id"])
    op.create_index("ix_orders_status", "orders", ["status"])
    op.create_index("ix_orders_created_at", "orders", ["created_at"])

    op.create_table(
        "order_items",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("order_id", sa.Integer, sa.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("menu_item_id", sa.Integer, sa.ForeignKey("menu_items.id"), nullable=False),
        sa.Column("item_name_snapshot", sa.String(120), nullable=False),
        sa.Column("unit_price_snapshot", sa.Numeric(10, 2), nullable=False),
        sa.Column("quantity", sa.Integer, nullable=False),
        sa.Column("line_total", sa.Numeric(10, 2), nullable=False),
        sa.CheckConstraint("quantity > 0", name="ck_order_items_quantity_positive"),
    )
    op.create_index("ix_order_items_order_id", "order_items", ["order_id"])


def downgrade():
    for table in ("order_items", "orders", "customer_sessions", "menu_items", "categories", "cafe_tables", "users"):
        op.drop_table(table)
