"""Restaurant settings: name, logo, accent color, currency and bill rates.

The single row is created by the app on first use, from the .env defaults.

Revision ID: 0004
"""

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"


def upgrade():
    op.create_table(
        "restaurant_settings",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("logo_url", sa.String(500), nullable=True),
        sa.Column("accent_color", sa.String(7), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("service_charge_percent", sa.Numeric(5, 2), nullable=False),
        sa.Column("tax_percent", sa.Numeric(5, 2), nullable=False),
        sa.Column("tax_label", sa.String(20), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("id = 1", name="ck_restaurant_settings_single_row"),
    )


def downgrade():
    op.drop_table("restaurant_settings")
