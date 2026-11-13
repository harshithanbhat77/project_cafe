"""Dietary tags on menu items, and guest requests for a waiter or the bill.

Revision ID: 0005
"""

import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"


def upgrade():
    op.add_column("menu_items", sa.Column("diet", sa.String(20), nullable=True))
    # Existing items aren't spicy or bestsellers: fill with false, then drop the default.
    for column in ("spicy", "bestseller"):
        op.add_column("menu_items", sa.Column(column, sa.Boolean, nullable=False, server_default=sa.false()))
        op.alter_column("menu_items", column, server_default=None)

    op.create_table(
        "service_requests",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("table_id", sa.Integer, sa.ForeignKey("cafe_tables.id"), nullable=False),
        sa.Column("customer_session_id", sa.Integer, sa.ForeignKey("customer_sessions.id"), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_by_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
    )
    op.create_index("ix_service_requests_table_id", "service_requests", ["table_id"])
    op.create_index("ix_service_requests_customer_session_id", "service_requests", ["customer_session_id"])
    op.create_index("ix_service_requests_resolved_at", "service_requests", ["resolved_at"])


def downgrade():
    op.drop_table("service_requests")
    for column in ("bestseller", "spicy", "diet"):
        op.drop_column("menu_items", column)
