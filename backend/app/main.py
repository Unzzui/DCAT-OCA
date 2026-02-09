import asyncio
import re
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from .core.config import settings
from .api.v1.router import api_router
from .db import session as db_session


class NormalizePathMiddleware(BaseHTTPMiddleware):
    """Collapse double slashes in request paths (e.g. //api/v1 -> /api/v1)."""
    async def dispatch(self, request: Request, call_next):
        if "//" in request.scope["path"]:
            request.scope["path"] = re.sub(r"/+", "/", request.scope["path"])
        return await call_next(request)


async def _run_migrations():
    """Run pending database migrations."""
    if not db_session.AsyncSessionLocal:
        return

    try:
        async with db_session.AsyncSessionLocal() as session:
            from sqlalchemy import text

            # Check if allowed_modules column exists
            result = await session.execute(text("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'users' AND column_name = 'allowed_modules'
            """))
            column_exists = result.fetchone() is not None

            if not column_exists:
                print("Adding allowed_modules column to users table...", flush=True)
                # Add the column with default value (all modules)
                await session.execute(text("""
                    ALTER TABLE users
                    ADD COLUMN allowed_modules JSON
                    DEFAULT '["dashboard", "nuevas-conexiones", "lecturas", "telecomunicaciones", "corte-reposicion", "control-perdidas"]'::json
                """))
                await session.commit()
                print("Migration complete: allowed_modules column added", flush=True)
            else:
                # Ensure existing users with NULL have all modules
                await session.execute(text("""
                    UPDATE users
                    SET allowed_modules = '["dashboard", "nuevas-conexiones", "lecturas", "telecomunicaciones", "corte-reposicion", "control-perdidas"]'::json
                    WHERE allowed_modules IS NULL
                """))
                await session.commit()
                print("Database schema is up to date", flush=True)
    except Exception as e:
        print(f"Migration check failed: {e}", flush=True)


async def _warmup_cache():
    """Pre-warm the stats cache in background so first user request is fast."""
    try:
        from .api.v1.dashboard import _compute_dashboard_summary
        await _compute_dashboard_summary()
        print("Cache warmup complete")
    except Exception as e:
        print(f"Cache warmup failed (non-critical): {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    import sys
    print("=" * 50, flush=True)
    print("Starting DCAT-OCA API server...", flush=True)
    print(f"Python version: {sys.version}", flush=True)
    print(f"DATABASE_URL configured: {bool(settings.DATABASE_URL)}", flush=True)

    try:
        if settings.DATABASE_URL:
            db_session.init_async_engine()
            print("Database engine created", flush=True)
            # Run migrations
            await _run_migrations()
            # Pre-warm cache in background
            asyncio.create_task(_warmup_cache())
        else:
            print("No DATABASE_URL configured, using in-memory data", flush=True)
    except Exception as e:
        print(f"WARNING: Database init error (continuing anyway): {e}", flush=True)

    print("Server ready to accept connections on 0.0.0.0:8000", flush=True)
    print("=" * 50, flush=True)

    yield

    # Shutdown
    print("Shutting down server...", flush=True)
    if db_session.async_engine:
        await db_session.async_engine.dispose()
        print("Database connection closed", flush=True)


app = FastAPI(
    title=settings.APP_NAME,
    description="API para el Dashboard de Control y Analisis Tecnico - OCA Global",
    version="1.0.0",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)

# Normalize double slashes in paths
app.add_middleware(NormalizePathMiddleware)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/")
async def root():
    return {
        "message": "DCAT-OCA API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
