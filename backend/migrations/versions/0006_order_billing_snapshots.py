"""Snapshot billing labels and rates on new orders.

Revision ID: 0006
"""

import sqlalchemy as sa
from alembic import op

revision = "0006"
down_revision = "0005"


def upgrade():
    op.add_column("orders", sa.Column("service_charge_percent", sa.Numeric(5, 2), nullable=True))
    op.add_column("orders", sa.Column("tax_percent", sa.Numeric(5, 2), nullable=True))
    op.add_column("orders", sa.Column("tax_label_snapshot", sa.String(20), nullable=True))
    op.create_index("ix_service_requests_created_at", "service_requests", ["created_at"])


def downgrade():
    op.drop_index("ix_service_requests_created_at", table_name="service_requests")
    op.drop_column("orders", "tax_label_snapshot")
    op.drop_column("orders", "tax_percent")
    op.drop_column("orders", "service_charge_percent")
