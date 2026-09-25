"""Split the single ADMIN role into OWNER and STAFF.

Revision ID: 0002
"""

from alembic import op

revision = "0002"
down_revision = "0001"


def upgrade():
    # Existing admins could do everything, so they become owners.
    op.execute("UPDATE users SET role = 'OWNER' WHERE role = 'ADMIN'")


def downgrade():
    # The old code only knows ADMIN (full access). Staff are deactivated rather than
    # silently promoted to full admins.
    op.execute("UPDATE users SET active = false WHERE role = 'STAFF'")
    op.execute("UPDATE users SET role = 'ADMIN' WHERE role IN ('OWNER', 'STAFF')")
