"""
Async SQL query helpers using SQLAlchemy AsyncSession.
Provides execute_query() and execute_scalar() for direct SQL access.
"""

from typing import Any, Optional
from sqlalchemy import text
from ..db import session as db_session


async def execute_query(query: str, params: Optional[dict] = None) -> list[dict]:
    """Execute an async SQL query and return a list of dicts."""
    if db_session.AsyncSessionLocal is None:
        db_session.init_async_engine()
    if db_session.AsyncSessionLocal is None:
        raise RuntimeError("Database not configured. Set DATABASE_URL in .env")

    async with db_session.AsyncSessionLocal() as session:
        result = await session.execute(text(query), params or {})
        rows = result.mappings().all()
        return [dict(row) for row in rows]


async def execute_scalar(query: str, params: Optional[dict] = None) -> Any:
    """Execute a query that returns a single scalar value (COUNT, etc.)."""
    if db_session.AsyncSessionLocal is None:
        db_session.init_async_engine()
    if db_session.AsyncSessionLocal is None:
        raise RuntimeError("Database not configured. Set DATABASE_URL in .env")

    async with db_session.AsyncSessionLocal() as session:
        result = await session.execute(text(query), params or {})
        return result.scalar()
