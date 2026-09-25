"""Order notes, service charge and tax.

Revision ID: 0003
"""

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"


def upgrade():
    op.add_column("orders", sa.Column("notes", sa.Text, nullable=True))
    # Existing orders had no charges: fill them with 0, then drop the default so new rows must set them.
    for column in ("service_charge", "tax"):
        op.add_column("orders", sa.Column(column, sa.Numeric(10, 2), nullable=False, server_default="0"))
        op.alter_column("orders", column, server_default=None)


def downgrade():
    for column in ("tax", "service_charge", "notes"):
        op.drop_column("orders", column)
