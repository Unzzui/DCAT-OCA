#!/usr/bin/env python3
"""
Script para crear las tablas del modulo de Lecturas.
Crea: ipal_inspecciones, lecturas_preventivas, ordenes_genericas,
      refacturaciones, lecturas_grabar, inspecciones_correos

Uso:
    python backend/scripts/create_lectura_tables.py
"""

import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine, text

# Get database URL from environment
DATABASE_URL = os.environ.get('DATABASE_URL', os.environ.get('SYNC_DATABASE_URL', ''))

if not DATABASE_URL:
    # Try to load from .env file
    env_path = Path(__file__).parent.parent / '.env'
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                if line.startswith('DATABASE_URL=') or line.startswith('SYNC_DATABASE_URL='):
                    DATABASE_URL = line.split('=', 1)[1].strip().strip('"').strip("'")
                    break

if not DATABASE_URL:
    print("ERROR: DATABASE_URL not set. Please set it in environment or .env file.")
    sys.exit(1)

# Ensure it's a sync URL (not async)
if DATABASE_URL.startswith('postgresql+asyncpg://'):
    DATABASE_URL = DATABASE_URL.replace('postgresql+asyncpg://', 'postgresql://')


# SQL statements to create tables
CREATE_TABLES_SQL = """
-- Inspecciones de Seguridad (IPAL)
CREATE TABLE IF NOT EXISTS ipal_inspecciones (
    id SERIAL PRIMARY KEY,
    fecha DATE,
    comuna VARCHAR(100),
    nombre_lector VARCHAR(200),
    empresa VARCHAR(100),
    inspector VARCHAR(100),
    estado VARCHAR(50),
    hora_llamada VARCHAR(50),
    nro_ipal VARCHAR(50),
    observacion TEXT,
    codigo_hallazgo VARCHAR(100),
    observacion_inspector TEXT,
    direccion TEXT,
    mes INTEGER,
    anio INTEGER
);

CREATE INDEX IF NOT EXISTS ix_ipal_fecha ON ipal_inspecciones (fecha);
CREATE INDEX IF NOT EXISTS ix_ipal_comuna ON ipal_inspecciones (comuna);
CREATE INDEX IF NOT EXISTS ix_ipal_empresa ON ipal_inspecciones (empresa);
CREATE INDEX IF NOT EXISTS ix_ipal_inspector ON ipal_inspecciones (inspector);
CREATE INDEX IF NOT EXISTS ix_ipal_fecha_empresa ON ipal_inspecciones (fecha, empresa);

-- Lecturas Preventivas
CREATE TABLE IF NOT EXISTS lecturas_preventivas (
    id SERIAL PRIMARY KEY,
    numero_cliente VARCHAR(50),
    sector INTEGER,
    zona INTEGER,
    grupo INTEGER,
    ruta VARCHAR(20),
    tipo_operacion VARCHAR(50),
    tarifa VARCHAR(20),
    direccion TEXT,
    consumo_prom_diario NUMERIC,
    periodo_lectura INTEGER,
    medidor VARCHAR(50),
    marca_medidor VARCHAR(50),
    constante INTEGER,
    lectura_anterior NUMERIC,
    lectura_actual NUMERIC,
    consumo_anterior NUMERIC,
    consumo_actual NUMERIC,
    irregularidad_1 VARCHAR(100),
    irregularidad_2 VARCHAR(100),
    irregularidad_3 VARCHAR(100),
    irregularidad_4 VARCHAR(100),
    verificacion_lectura VARCHAR(100),
    codigo_lector INTEGER,
    insitu VARCHAR(5),
    facturado VARCHAR(5),
    rf VARCHAR(5),
    mes INTEGER,
    anio INTEGER
);

CREATE INDEX IF NOT EXISTS ix_preventivas_cliente ON lecturas_preventivas (numero_cliente);
CREATE INDEX IF NOT EXISTS ix_preventivas_sector ON lecturas_preventivas (sector);
CREATE INDEX IF NOT EXISTS ix_preventivas_zona ON lecturas_preventivas (zona);
CREATE INDEX IF NOT EXISTS ix_preventivas_sector_zona ON lecturas_preventivas (sector, zona);

-- Ordenes Genericas
CREATE TABLE IF NOT EXISTS ordenes_genericas (
    id SERIAL PRIMARY KEY,
    numero_incidencia VARCHAR(50),
    asignado_a VARCHAR(100),
    fecha DATE,
    lectura_activa NUMERIC,
    mes INTEGER,
    anio INTEGER
);

CREATE INDEX IF NOT EXISTS ix_ordenes_asignado ON ordenes_genericas (asignado_a);
CREATE INDEX IF NOT EXISTS ix_ordenes_fecha ON ordenes_genericas (fecha);

-- Refacturaciones
CREATE TABLE IF NOT EXISTS refacturaciones (
    id SERIAL PRIMARY KEY,
    cliente VARCHAR(50),
    ruta VARCHAR(20),
    medidor VARCHAR(50),
    lectura_normal NUMERIC,
    fecha_normal DATE,
    lectura_erronea NUMERIC,
    fecha_erronea DATE,
    lectura_verificada NUMERIC,
    fecha_verificada DATE,
    constante INTEGER,
    facturado INTEGER,
    kwh_cobrar NUMERIC,
    kwh_rebajar NUMERIC,
    modif_lectura VARCHAR(100),
    orden VARCHAR(50),
    comuna VARCHAR(100),
    leido_por VARCHAR(100),
    mes INTEGER,
    anio INTEGER
);

CREATE INDEX IF NOT EXISTS ix_refas_cliente ON refacturaciones (cliente);
CREATE INDEX IF NOT EXISTS ix_refas_comuna ON refacturaciones (comuna);
CREATE INDEX IF NOT EXISTS ix_refas_leido_por ON refacturaciones (leido_por);
CREATE INDEX IF NOT EXISTS ix_refas_comuna_leido ON refacturaciones (comuna, leido_por);

-- Lecturas a Grabar
CREATE TABLE IF NOT EXISTS lecturas_grabar (
    id SERIAL PRIMARY KEY,
    cliente VARCHAR(50),
    leido_por VARCHAR(100),
    ruta VARCHAR(20),
    tarifa VARCHAR(20),
    medidor_activo VARCHAR(50),
    medidor_reactivo VARCHAR(50),
    fecha_lectura DATE,
    centro_operativo VARCHAR(100),
    lec_activa NUMERIC,
    lec_reactiva NUMERIC,
    hora_max_hp VARCHAR(50),
    fecha_max_hp DATE,
    dem_hp_encontrada NUMERIC,
    dem_hp_dejada NUMERIC,
    dem_fp_encontrada NUMERIC,
    dem_fp_dejada NUMERIC,
    observacion TEXT,
    fecha_envio DATE,
    mes INTEGER,
    anio INTEGER
);

CREATE INDEX IF NOT EXISTS ix_grabar_cliente ON lecturas_grabar (cliente);
CREATE INDEX IF NOT EXISTS ix_grabar_leido_por ON lecturas_grabar (leido_por);
CREATE INDEX IF NOT EXISTS ix_grabar_fecha ON lecturas_grabar (fecha_lectura);

-- Inspecciones desde Correos (ENEL y Colina)
CREATE TABLE IF NOT EXISTS inspecciones_correos (
    id SERIAL PRIMARY KEY,
    fuente VARCHAR(20),
    fecha_recepcion DATE,
    cliente VARCHAR(50),
    quien_envio VARCHAR(200),
    reclamo TEXT,
    fecha_terreno DATE,
    respuesta TEXT,
    fecha_respuesta DATE,
    inspector VARCHAR(100),
    comuna VARCHAR(100),
    tarifa VARCHAR(20),
    gestion VARCHAR(50),
    sector NUMERIC,
    fecha_inspeccion DATE,
    dias_respuesta INTEGER,
    mes INTEGER,
    anio INTEGER
);

CREATE INDEX IF NOT EXISTS ix_correos_fuente ON inspecciones_correos (fuente);
CREATE INDEX IF NOT EXISTS ix_correos_fecha_recepcion ON inspecciones_correos (fecha_recepcion);
CREATE INDEX IF NOT EXISTS ix_correos_cliente ON inspecciones_correos (cliente);
CREATE INDEX IF NOT EXISTS ix_correos_inspector ON inspecciones_correos (inspector);
CREATE INDEX IF NOT EXISTS ix_correos_comuna ON inspecciones_correos (comuna);
CREATE INDEX IF NOT EXISTS ix_correos_fuente_fecha ON inspecciones_correos (fuente, fecha_recepcion);
"""


def main():
    print("Connecting to database...")
    engine = create_engine(DATABASE_URL)

    print("Creating Lectura module tables...")

    with engine.connect() as conn:
        # Execute each statement separately
        statements = [s.strip() for s in CREATE_TABLES_SQL.split(';') if s.strip()]

        for i, stmt in enumerate(statements, 1):
            try:
                conn.execute(text(stmt))
                print(f"  Executed statement {i}/{len(statements)}")
            except Exception as e:
                print(f"  Warning on statement {i}: {e}")

        conn.commit()

    print("\n=== Tables created successfully ===")
    print("\nCreated tables:")
    print("  - ipal_inspecciones")
    print("  - lecturas_preventivas")
    print("  - ordenes_genericas")
    print("  - refacturaciones")
    print("  - lecturas_grabar")
    print("  - inspecciones_correos")
    print("\nYou can now load data using:")
    print("  python backend/scripts/load_lectura_data.py")


if __name__ == '__main__':
    main()
