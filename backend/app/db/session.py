from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from ..core.config import settings

# Async engine (for FastAPI endpoints)
async_engine = None
AsyncSessionLocal = None

# Sync engine (for scripts/migrations)
sync_engine = None
SyncSessionLocal = None


def init_async_engine():
    global async_engine, AsyncSessionLocal
    if settings.ASYNC_DATABASE_URL:
        async_engine = create_async_engine(
            settings.ASYNC_DATABASE_URL,
            echo=False,
            pool_size=30,
            max_overflow=20,
            pool_pre_ping=True,
            connect_args={"statement_cache_size": 0},
        )
        AsyncSessionLocal = async_sessionmaker(
            async_engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )


def init_sync_engine():
    global sync_engine, SyncSessionLocal
    if settings.SYNC_DATABASE_URL:
        sync_engine = create_engine(
            settings.SYNC_DATABASE_URL,
            echo=False,
            pool_size=20,
            max_overflow=10,
            pool_pre_ping=True,
        )
        SyncSessionLocal = sessionmaker(
            bind=sync_engine,
            autocommit=False,
            autoflush=False,
        )


async def get_db():
    """FastAPI dependency for async DB sessions."""
    if AsyncSessionLocal is None:
        init_async_engine()

    if AsyncSessionLocal is None:
        raise RuntimeError("Database not configured. Set DATABASE_URL in .env")

    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


def get_sync_db():
    """Get sync DB session for scripts."""
    if SyncSessionLocal is None:
        init_sync_engine()

    if SyncSessionLocal is None:
        raise RuntimeError("Database not configured. Set DATABASE_URL in .env")

    session = SyncSessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
