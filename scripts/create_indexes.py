#!/usr/bin/env python3
"""
Creates additional database indexes for query performance.

Usage:
    python scripts/create_indexes.py
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from backend.app.core.config import settings
from sqlalchemy import create_engine, text


INDEXES = [
    # NNCC
    "CREATE INDEX IF NOT EXISTS ix_nncc_resultado ON nncc (resultado_inspeccion)",
    "CREATE INDEX IF NOT EXISTS ix_nncc_multa ON nncc (multa)",
    "CREATE INDEX IF NOT EXISTS ix_nncc_mes_anio ON nncc (mes, anio)",

    # Lecturas
    "CREATE INDEX IF NOT EXISTS ix_lecturas_hallazgo ON lecturas (hallazgo)",
    "CREATE INDEX IF NOT EXISTS ix_lecturas_estado_plazo ON lecturas (estado_plazo)",
    "CREATE INDEX IF NOT EXISTS ix_lecturas_comuna ON lecturas (comuna)",
    "CREATE INDEX IF NOT EXISTS ix_lecturas_fecha_ingreso ON lecturas (fecha_ingreso)",
    "CREATE INDEX IF NOT EXISTS ix_lecturas_mes_anio ON lecturas (mes, anio)",

    # Telecomunicaciones
    "CREATE INDEX IF NOT EXISTS ix_teleco_empresa ON telecomunicaciones (empresa)",
    "CREATE INDEX IF NOT EXISTS ix_teleco_resultado ON telecomunicaciones (resultado)",
    "CREATE INDEX IF NOT EXISTS ix_teleco_comuna ON telecomunicaciones (comuna)",
    "CREATE INDEX IF NOT EXISTS ix_teleco_fecha ON telecomunicaciones (fecha_inspeccion)",
    "CREATE INDEX IF NOT EXISTS ix_teleco_mes_anio ON telecomunicaciones (mes, anio)",

    # Corte y Reposicion
    "CREATE INDEX IF NOT EXISTS ix_corte_situacion ON corte_reposicion (situacion_encontrada)",
    "CREATE INDEX IF NOT EXISTS ix_corte_centro ON corte_reposicion (centro_operativo)",
    "CREATE INDEX IF NOT EXISTS ix_corte_comuna ON corte_reposicion (comuna)",
    "CREATE INDEX IF NOT EXISTS ix_corte_inspector ON corte_reposicion (inspector)",
    "CREATE INDEX IF NOT EXISTS ix_corte_fecha ON corte_reposicion (fecha_inspeccion)",
    "CREATE INDEX IF NOT EXISTS ix_corte_mes_anio ON corte_reposicion (mes, anio)",

    # Medidores Cruzados
    "CREATE INDEX IF NOT EXISTS ix_mc_resultado ON medidores_cruzados (resultado_inspeccion)",
    "CREATE INDEX IF NOT EXISTS ix_mc_etapa ON medidores_cruzados (etapa_caso)",
    "CREATE INDEX IF NOT EXISTS ix_mc_mes ON medidores_cruzados (mes)",

    # Calidad - Mono Base
    "CREATE INDEX IF NOT EXISTS ix_cal_mono_base_contratista ON calidad_mono_base (contratista)",
    "CREATE INDEX IF NOT EXISTS ix_cal_mono_base_resultado ON calidad_mono_base (tipo_resultado)",
    "CREATE INDEX IF NOT EXISTS ix_cal_mono_base_mes_anio ON calidad_mono_base (mes, anio)",

    # Calidad - Tri Base
    "CREATE INDEX IF NOT EXISTS ix_cal_tri_base_contratista ON calidad_tri_base (contratista)",
    "CREATE INDEX IF NOT EXISTS ix_cal_tri_base_resultado ON calidad_tri_base (tipo_resultado)",
    "CREATE INDEX IF NOT EXISTS ix_cal_tri_base_mes_anio ON calidad_tri_base (mes, anio)",

    # Calidad - Inspecciones
    "CREATE INDEX IF NOT EXISTS ix_cal_mono_insp_contratista ON calidad_mono_inspecciones (contratista)",
    "CREATE INDEX IF NOT EXISTS ix_cal_tri_insp_contratista ON calidad_tri_inspecciones (contratista)",
]


def create_indexes():
    if not settings.DATABASE_URL:
        print("ERROR: DATABASE_URL not set in .env")
        sys.exit(1)

    engine = create_engine(settings.DATABASE_URL)

    with engine.connect() as conn:
        for idx_sql in INDEXES:
            idx_name = idx_sql.split("IF NOT EXISTS ")[1].split(" ON")[0]
            try:
                conn.execute(text(idx_sql))
                print(f"  OK: {idx_name}")
            except Exception as e:
                print(f"  SKIP: {idx_name} ({e})")
        conn.commit()

    print(f"\nDone. {len(INDEXES)} indexes processed.")
    engine.dispose()


if __name__ == "__main__":
    create_indexes()
