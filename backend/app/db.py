from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.config import settings

if settings.db_null_pool:
    # Serverless: open a connection per request through the provider's pooler (PgBouncer).
    # prepare_threshold=None: PgBouncer transaction pooling can't keep server-side prepared statements.
    engine = create_engine(settings.database_url, poolclass=NullPool, connect_args={"prepare_threshold": None})
else:
    engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
