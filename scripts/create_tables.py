#!/usr/bin/env python3
"""
Creates all database tables in PostgreSQL (Supabase).

Usage:
    python scripts/create_tables.py
"""

import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from backend.app.db.base import Base
from backend.app.db.models import (
    UserModel, NNCCModel, MedidoresCruzadosModel,
    CalidadMonoBaseModel, CalidadMonoInspeccionesModel,
    CalidadTriBaseModel, CalidadTriInspeccionesModel,
    LecturasModel, TelecomunicacionesModel, CorteReposicionModel,
)
from backend.app.core.config import settings
from sqlalchemy import create_engine, text


def create_tables():
    if not settings.DATABASE_URL:
        print("ERROR: DATABASE_URL not set in .env")
        sys.exit(1)

    db_url = settings.DATABASE_URL
    # Ensure we use sync driver
    if "+asyncpg" in db_url:
        db_url = db_url.replace("postgresql+asyncpg://", "postgresql://")

    print(f"Connecting to database...")
    engine = create_engine(db_url, echo=False)

    print("Creating tables...")
    Base.metadata.create_all(bind=engine)

    # List created tables
    with engine.connect() as conn:
        result = conn.execute(text(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
        ))
        tables = [row[0] for row in result]
        print(f"\nTables in database ({len(tables)}):")
        for t in tables:
            result2 = conn.execute(text(f"SELECT COUNT(*) FROM {t}"))
            count = result2.scalar()
            print(f"  - {t}: {count} rows")

    print("\nDone!")
    engine.dispose()


if __name__ == "__main__":
    create_tables()
