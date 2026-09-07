from alembic import op
import sqlalchemy as sa
revision='0002'; down_revision='0001'
def upgrade():
    op.create_table('customer_sessions',sa.Column('id',sa.Integer,primary_key=True),sa.Column('session_token',sa.String(96),unique=True,nullable=False),sa.Column('table_id',sa.Integer,sa.ForeignKey('cafe_tables.id'),nullable=False),sa.Column('customer_name',sa.String(100),nullable=False),sa.Column('customer_phone',sa.String(32),nullable=False),sa.Column('active',sa.Boolean,nullable=False),sa.Column('created_at',sa.DateTime(timezone=True)))
    op.add_column('orders',sa.Column('customer_session_id',sa.Integer,sa.ForeignKey('customer_sessions.id'),nullable=True))
    op.add_column('orders',sa.Column('customer_name',sa.String(100),nullable=True))
    op.add_column('orders',sa.Column('customer_phone',sa.String(32),nullable=True))
def downgrade():
    op.drop_column('orders','customer_phone'); op.drop_column('orders','customer_name'); op.drop_column('orders','customer_session_id'); op.drop_table('customer_sessions')
