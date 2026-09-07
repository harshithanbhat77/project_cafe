from alembic import context
from sqlalchemy import engine_from_config,pool
from app.db import Base
from app.models import *
from app.config import settings
config=context.config;config.set_main_option("sqlalchemy.url",settings.database_url);target_metadata=Base.metadata
def run_migrations_online():
    with engine_from_config(config.get_section(config.config_ini_section),prefix="sqlalchemy.",poolclass=pool.NullPool).connect() as c: context.configure(connection=c,target_metadata=target_metadata);context.run_migrations()
if context.is_offline_mode(): context.configure(url=settings.database_url,target_metadata=target_metadata,literal_binds=True);context.run_migrations()
else: run_migrations_online()
