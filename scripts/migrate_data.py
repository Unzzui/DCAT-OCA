#!/usr/bin/env python3
"""
Migrates data from CSV/Parquet files to PostgreSQL (Supabase).
Applies proper column mapping so DB columns match the SQLAlchemy models.

Usage:
    python scripts/migrate_data.py
    python scripts/migrate_data.py --table nncc
    python scripts/migrate_data.py --table corte_reposicion --chunk 5000
"""

import sys
import os
import argparse

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

import pandas as pd
import numpy as np
from sqlalchemy import create_engine, text
from backend.app.core.config import settings
from backend.app.core.security import get_password_hash


DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
PARQUET_DIR = os.path.join(DATA_DIR, "parquet")


def read_data_file(base_name, encoding='utf-8'):
    """Read data preferring parquet over CSV."""
    parquet_path = os.path.join(PARQUET_DIR, f"{base_name}.parquet")
    csv_path = os.path.join(DATA_DIR, f"{base_name}.csv")

    if os.path.exists(parquet_path):
        print(f"  Reading parquet: {base_name}.parquet")
        return pd.read_parquet(parquet_path)
    elif os.path.exists(csv_path):
        print(f"  Reading CSV: {base_name}.csv")
        return pd.read_csv(csv_path, encoding=encoding, low_memory=False)
    else:
        print(f"  WARNING: File not found: {base_name}")
        return pd.DataFrame()


def _keep_cols(df, known_cols):
    """Keep only known columns, drop the rest."""
    return df[[c for c in known_cols if c in df.columns]]


def _parse_dates(df, cols):
    """Parse date columns to datetime."""
    for col in cols:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], format='mixed', errors='coerce')
    return df


def _add_mes_anio(df, date_col='fecha_inspeccion'):
    """Add mes/anio computed columns from a date column."""
    if date_col in df.columns:
        df['mes'] = df[date_col].dt.month
        df['anio'] = df[date_col].dt.year
    return df


def _to_str(df, col):
    """Convert column to string, handling NaN."""
    if col in df.columns:
        df[col] = df[col].fillna('').astype(str).str.strip()
        df[col] = df[col].replace({'': None, 'nan': None, 'None': None})
    return df


# ---------------------------------------------------------------------------


def migrate_users(engine):
    """Seed default users."""
    print("\n=== Migrating users ===")

    from datetime import datetime

    users = [
        {"email": "admin@ocaglobal.com", "full_name": "Administrador", "role": "admin", "password": "admin123"},
        {"email": "editor@ocaglobal.com", "full_name": "Editor", "role": "editor", "password": "editor123"},
        {"email": "viewer@ocaglobal.com", "full_name": "Visualizador", "role": "viewer", "password": "viewer123"},
        {"email": "diego.bravob@ocaglobal.com", "full_name": "Diego Bravo", "role": "admin", "password": "diego123"},
    ]

    with engine.connect() as conn:
        existing = conn.execute(text("SELECT COUNT(*) FROM users")).scalar()
        if existing > 0:
            print(f"  Users table already has {existing} rows, skipping.")
            return

    rows = []
    for u in users:
        rows.append({
            "email": u["email"],
            "full_name": u["full_name"],
            "hashed_password": get_password_hash(u["password"]),
            "role": u["role"],
            "is_active": True,
        })

    df = pd.DataFrame(rows)
    df.to_sql("users", engine, if_exists="append", index=False)
    print(f"  Inserted {len(df)} users")


def migrate_nncc(engine):
    """Migrate NNCC data."""
    print("\n=== Migrating NNCC ===")

    df = read_data_file("2025-05 INFORME NNCC (2024-2029) DIC 2025")
    if df.empty:
        print("  No data found")
        return

    column_mapping = {
        "VTA": "vta", "Cliente": "cliente", "Nombre cliente": "nombre_cliente",
        "Dirección": "direccion", "Comuna": "comuna", "TARIFA": "tarifa",
        "ZONA": "zona", "BASE": "base", "N° MEDIDOR": "n_medidor",
        "ESTADO EFECTIVIDAD OCA": "estado_efectividad",
        "RESULTADO FINAL DE INSPCCION": "resultado_inspeccion",
        "MULTA SI/NO": "multa", "OBSERVACIONES DE MULTA": "observaciones_multa",
        "FECHA INSPECCIÓN": "fecha_inspeccion", "Inspector3": "inspector",
        "ESTADO CONTRATISTA": "estado_contratista",
        "RESULTADO FINAL DE REVISIÓN DE NORMALIZACIÓN": "resultado_normalizacion",
        "CUMPLE NORMA CODIGO COLORES": "cumple_norma_cc",
        "CLIENTE CONFORME": "cliente_conforme",
        "ESTADO DEL EMPALME": "estado_empalme",
        "TIPO INSPECCIÓN": "tipo_inspeccion", "VOLTAJE": "voltaje",
    }
    rename_dict = {k: v for k, v in column_mapping.items() if k in df.columns}
    df = df.rename(columns=rename_dict)

    df = _parse_dates(df, ['fecha_inspeccion'])
    df = _add_mes_anio(df, 'fecha_inspeccion')

    if "inspector" in df.columns:
        df["inspector"] = df["inspector"].fillna("").str.strip().str.title()

    if 'cliente' in df.columns:
        df['cliente'] = df['cliente'].astype(str).str.replace('.0', '', regex=False)

    known_cols = [
        'vta', 'cliente', 'nombre_cliente', 'direccion', 'comuna', 'tarifa',
        'zona', 'base', 'n_medidor', 'estado_efectividad', 'resultado_inspeccion',
        'multa', 'observaciones_multa', 'fecha_inspeccion', 'inspector',
        'estado_contratista', 'resultado_normalizacion', 'cumple_norma_cc',
        'cliente_conforme', 'estado_empalme', 'tipo_inspeccion', 'voltaje',
        'mes', 'anio',
    ]
    df = _keep_cols(df, known_cols)

    df.to_sql("nncc", engine, if_exists="replace", index=False, chunksize=5000)
    print(f"  Inserted {len(df)} rows")


def migrate_medidores_cruzados(engine):
    """Migrate Medidores Cruzados data."""
    print("\n=== Migrating Medidores Cruzados ===")

    df = read_data_file("informe_medidores_cruzados", encoding='utf-8-sig')
    if df.empty:
        print("  No data found")
        return

    df.columns = df.columns.str.strip()
    column_mapping = {
        "MES": "mes", "MES ": "mes",
        "FECHA CORREO": "fecha_correo", "NUM CLIENTE": "num_cliente",
        "ENCARGADO ENEL": "encargado_enel", "AREA": "area",
        "ETAPA DEL CASO": "etapa_caso", "FECHA ASIGNACION": "fecha_asignacion",
        "FECHA DE ANALISIS": "fecha_analisis", "FECHA INSPECCIÓN": "fecha_inspeccion",
        "DIRECCIÓN": "direccion", "COMUNA": "comuna",
        "MEDIDOR SISTEMA": "medidor_sistema", "ZONA": "zona", "EETT": "eett",
        "OBSERVACION INSPECTOR": "observacion_inspector",
        "ESTADO MEDIDOR": "estado_medidor", "INSPECTOR": "inspector",
        "RESULTADO FINAL DE LA INSPECCION": "resultado_inspeccion",
        "EEPP OCA": "eepp_oca",
    }
    rename_dict = {k: v for k, v in column_mapping.items() if k in df.columns}
    df = df.rename(columns=rename_dict)

    df = _parse_dates(df, ["fecha_correo", "fecha_asignacion", "fecha_analisis", "fecha_inspeccion"])

    known_cols = [
        'mes', 'fecha_correo', 'num_cliente', 'encargado_enel', 'area',
        'etapa_caso', 'fecha_asignacion', 'fecha_analisis', 'fecha_inspeccion',
        'direccion', 'comuna', 'medidor_sistema', 'zona', 'eett',
        'observacion_inspector', 'estado_medidor', 'inspector',
        'resultado_inspeccion', 'eepp_oca',
    ]
    df = _keep_cols(df, known_cols)

    df.to_sql("medidores_cruzados", engine, if_exists="replace", index=False, chunksize=5000)
    print(f"  Inserted {len(df)} rows")


def migrate_lecturas(engine):
    """Migrate Lecturas data with proper column mapping."""
    print("\n=== Migrating Lecturas ===")

    sources = [
        ("informe_lectura_ORDENES_ORDENES", "ORDENES"),
        ("informe_lectura_SEC_SEC", "SEC"),
        ("informe_lectura_VIRTUAL_VIRTUAL VISIT", "VISITA VIRTUAL"),
        ("informe_lectura_VIRTUAL_VISITA VIRTUAL", "VISITA VIRTUAL"),
    ]

    all_dfs = []
    for file_name, origen in sources:
        df = read_data_file(file_name)
        if not df.empty:
            df['origen'] = origen
            all_dfs.append(df)

    if not all_dfs:
        print("  No data found")
        return

    combined = pd.concat(all_dfs, ignore_index=True)
    # First normalize column names
    combined.columns = combined.columns.str.strip().str.lower().str.replace(' ', '_')
    combined = combined.loc[:, ~combined.columns.duplicated()]

    # Column mapping: raw CSV name -> model name
    col_map = {
        "observaciones_del_caso": "observaciones_caso",
        "ruta_de_lectura": "ruta_lectura",
        "fecha_de_recepcion_y_salida_a_terreno": "fecha_recepcion_terreno",
        "fecha_de_vencimiento": "fecha_vencimiento",
        "fecha_insp": "fecha_inspeccion",
        "estado": "estado_plazo",
        "fecha_de_respuesta": "fecha_respuesta",
        "gestión": "gestion",
        "sector_original": "sector_original",
    }
    rename_dict = {k: v for k, v in col_map.items() if k in combined.columns}
    combined = combined.rename(columns=rename_dict)

    # If 'sector' is numeric, try to derive text sector
    if 'sector' in combined.columns:
        # sector might be numeric in some sources - convert to string
        combined['sector'] = combined['sector'].fillna('').astype(str).str.strip()
        combined['sector'] = combined['sector'].replace({'': None, 'nan': None})

    # Parse dates
    for col in ['fecha_ingreso', 'fecha_inspeccion', 'fecha_respuesta', 'fecha_recepcion_terreno', 'fecha_vencimiento']:
        if col in combined.columns:
            combined[col] = pd.to_datetime(combined[col], format='mixed', errors='coerce')

    # Compute mes/anio from fecha_ingreso
    if 'fecha_ingreso' in combined.columns:
        combined['mes'] = combined['fecha_ingreso'].dt.month
        combined['anio'] = combined['fecha_ingreso'].dt.year

    # Compute dias_respuesta
    if 'fecha_respuesta' in combined.columns and 'fecha_ingreso' in combined.columns:
        combined['dias_respuesta'] = (combined['fecha_respuesta'] - combined['fecha_ingreso']).dt.days

    # Compute inspeccionado flag
    if 'fecha_inspeccion' in combined.columns:
        combined['inspeccionado'] = combined['fecha_inspeccion'].notna()

    # Convert string columns
    for col in ['cliente', 'orden', 'medidor', 'cantidad', 'caso']:
        if col in combined.columns:
            combined[col] = combined[col].fillna('').astype(str).str.replace('.0', '', regex=False)
            combined[col] = combined[col].replace({'': None, 'nan': None})

    known_cols = [
        'cantidad', 'caso', 'fono_contacto', 'orden', 'cliente',
        'fecha_ingreso', 'observaciones_caso', 'task', 'submotivo',
        'canal_entrada', 'sector_original', 'zona', 'ruta', 'ruta_lectura',
        'medidor', 'marca', 'constante', 'tarifa', 'nombre', 'direccion',
        'comuna', 'sector', 'inspector', 'tipo_medida',
        'fecha_recepcion_terreno', 'fecha_vencimiento', 'observacion',
        'fecha_inspeccion', 'lectura', 'hallazgo', 'baremo',
        'estado_general', 'estado_plazo', 'fecha_respuesta',
        'rol_responsable', 'gestion', 'origen', 'dias_respuesta',
        'inspeccionado', 'mes', 'anio',
    ]
    combined = _keep_cols(combined, known_cols)

    combined.to_sql("lecturas", engine, if_exists="replace", index=False, chunksize=5000)
    print(f"  Inserted {len(combined)} rows")


def migrate_teleco(engine):
    """Migrate Telecomunicaciones data with proper column mapping."""
    print("\n=== Migrating Telecomunicaciones ===")

    df = read_data_file("informe_teleco", encoding='utf-8-sig')
    if df.empty:
        print("  No data found")
        return

    df.columns = df.columns.str.strip().str.lower().str.replace(' ', '_')
    df = df.loc[:, ~df.columns.duplicated()]

    # Map raw column names -> model column names
    col_map = {
        "pago_erick": "pago",
        "family_case_number": "family_case",
        "número_de_caso": "numero_caso",
        "estado_del_caso": "estado_caso",
        "cantidad_de_postes": "cantidad_postes",
        "nombre_de_empresa_/_cliente": "empresa",
        "fecha_1ra._inspección": "fecha_primera_inspeccion",
        "fecha_que_se_asignó": "fecha_asignacion",
        "fecha_de_inspección": "fecha_inspeccion",
        "tiene_plano?": "tiene_plano",
        "x": "coord_x",
        "y": "coord_y",
        "resultado_(erick)": "resultado",
        "observación_terreno": "observacion",
        "e._de_p.": "etapa",
    }
    rename_dict = {k: v for k, v in col_map.items() if k in df.columns}
    df = df.rename(columns=rename_dict)

    # Parse dates
    for col in ['fecha_primera_inspeccion', 'fecha_asignacion', 'fecha_inspeccion']:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], format='mixed', errors='coerce')

    # Compute mes/anio
    df = _add_mes_anio(df, 'fecha_inspeccion')

    # Compute empresa_corta (shortened company name)
    if 'empresa' in df.columns:
        df['empresa_corta'] = df['empresa'].fillna('').str.strip()
        # Shorten known long names
        df['empresa_corta'] = df['empresa_corta'].str.split('/').str[0].str.strip()
        df['empresa_corta'] = df['empresa_corta'].str.split(' - ').str[0].str.strip()

    # Normalize tiene_plano
    if 'tiene_plano' in df.columns:
        df['tiene_plano_norm'] = df['tiene_plano'].fillna('').str.strip().str.upper()
        df['tiene_plano_norm'] = df['tiene_plano_norm'].replace({'': None})

    # Compute estado_simple
    if 'resultado' in df.columns:
        df['estado_simple'] = df['resultado'].fillna('').str.strip().str.upper()
        df['estado_simple'] = df['estado_simple'].replace({'': None})

    # cantidad_postes to integer
    if 'cantidad_postes' in df.columns:
        df['cantidad_postes'] = pd.to_numeric(df['cantidad_postes'], errors='coerce')

    # coord_x, coord_y to float
    for col in ['coord_x', 'coord_y']:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')

    # Compute dias_inspeccion
    if 'fecha_inspeccion' in df.columns and 'fecha_asignacion' in df.columns:
        df['dias_inspeccion'] = (df['fecha_inspeccion'] - df['fecha_asignacion']).dt.days

    # Compute mes_periodo
    if 'fecha_inspeccion' in df.columns:
        df['mes_periodo'] = df['fecha_inspeccion'].dt.strftime('%Y-%m')

    known_cols = [
        'pago', 'family_case', 'estado_caso', 'cantidad_postes', 'empresa',
        'comuna', 'fecha_primera_inspeccion', 'fecha_asignacion',
        'fecha_inspeccion', 'tiene_plano', 'coord_x', 'coord_y',
        'resultado', 'observacion', 'inspector', 'etapa', 'numero_caso',
        'empresa_corta', 'tiene_plano_norm', 'estado_simple',
        'dias_inspeccion', 'mes_periodo', 'mes', 'anio',
    ]
    df = _keep_cols(df, known_cols)

    df.to_sql("telecomunicaciones", engine, if_exists="replace", index=False, chunksize=5000)
    print(f"  Inserted {len(df)} rows")


def migrate_corte(engine, chunk_size=5000):
    """Migrate Corte y Reposicion data with proper column mapping."""
    print("\n=== Migrating Corte y Reposicion ===")

    df = read_data_file("informe_corte")
    if df.empty:
        print("  No data found")
        return

    df.columns = df.columns.str.strip().str.lower().str.replace(' ', '_')
    df = df.loc[:, ~df.columns.duplicated()]

    # Map raw -> model
    col_map = {
        "n": "numero",
        "asignado": "fecha_asignado",
        "vence": "fecha_vence",
        "mes": "mes_texto",
        "cen_operativo": "centro_operativo",
        "nro_suministro": "suministro",
        "nombre": "nombre_cliente",
        "nro_aparato": "nro_medidor",
        "nombre_del_inspector": "inspector",
        "fecha_de_ejecución": "fecha_ejecucion",
        "si_no_fue_cortado_¿es_factible_cortar?": "es_factible_cortar",
        "si_la_anterior_es_si:_¿dónde?": "donde_factible",
        "numero_de_medidor": "numero_medidor",
        "si_fue_cortado___¿ejecución_de_corte?": "ejecucion_corte",
        "¿hay_evidencia_de_corte?": "evidencia_corte",
        "detalle_de_la_situacion_encontrada_o_del_reclamo": "detalle",
        "situación_dejada": "situacion_dejada",
        "nombre_encargado": "encargado",
        "empresa_colaboradora.1": "empresa_oca",
        "giro_propiedad": "giro",
        "tipo_de_orden": "tipo_orden",
    }
    rename_dict = {k: v for k, v in col_map.items() if k in df.columns}
    df = df.rename(columns=rename_dict)

    # Parse dates
    for col in ['fecha_asignado', 'fecha_vence', 'fecha_inspeccion', 'fecha_ejecucion']:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], format='mixed', errors='coerce')

    # Compute mes/anio from fecha_inspeccion
    df = _add_mes_anio(df, 'fecha_inspeccion')

    # suministro to string
    if 'suministro' in df.columns:
        df['suministro'] = df['suministro'].fillna('').astype(str).str.replace('.0', '', regex=False)
        df['suministro'] = df['suministro'].replace({'': None, 'nan': None})

    known_cols = [
        'numero', 'fecha_asignado', 'fecha_vence', 'mes_texto', 'estado',
        'accion_cobro', 'empresa', 'centro_operativo',
        'suministro', 'nombre_cliente', 'direccion', 'comuna',
        'nro_medidor', 'tipo_orden', 'situacion_a_inspeccionar', 'giro',
        'zona', 'empresa_colaboradora', 'situacion_encontrada',
        'situacion_dejada', 'es_factible_cortar', 'donde_factible',
        'numero_medidor', 'lectura', 'tipo_empalme', 'ejecucion_corte',
        'evidencia_corte', 'motivo_multa', 'multa', 'detalle',
        'respuesta_gestion', 'inspector', 'fecha_inspeccion',
        'empresa_oca', 'encargado', 'mes', 'anio',
    ]
    df = _keep_cols(df, known_cols)

    print(f"  Total rows: {len(df)} (using chunk_size={chunk_size})")
    df.to_sql("corte_reposicion", engine, if_exists="replace", index=False, chunksize=chunk_size)
    print(f"  Inserted {len(df)} rows")


def migrate_calidad(engine):
    """Migrate Control de Perdidas data with proper column mapping."""
    print("\n=== Migrating Calidad (Control Perdidas) ===")

    # --- BASE tables (mono + tri) ---
    base_col_map = {
        "numero_de_incidencia": "incidencia",
        "asignado_a": "inspector",
        "tipo_de_servicio": "tipo_servicio",
        "numero_de_cliente": "cliente",
        "nombre_de_cliente": "nombre_cliente",
        "calle": "direccion",
        "tarifa_(1)": "tarifa",
        "constante_(1)": "constante",
        "codificación": "estado_suministro",
        "modelo_en_terreno_corresponde_a_sistema": "modelo_corresponde",
        "medidor_en_terreno_corresponde_a_sistema": "medidor_corresponde",
        "empresa": "contratista",
        "volts": "voltaje",
        "amp": "amperaje",
        "e_%": "error_porcentaje",
        "acometida": "estado_acometida",
        "caja": "estado_caja",
        "tapa": "estado_tapa",
        "normalizar": "requiere_normalizacion",
        "observación": "observacion",
        "tipo_insp": "tipo_inspeccion",
        "notificacion": "notificacion",
    }

    # Tri-specific extra columns
    tri_base_extra_map = {
        "fecha": "fecha_inspeccion_raw",
        "inspector": "inspector_raw",
        "n._medidor": "medidor",
        "fp_medido": "factor_potencia",
        "%_error": "error_porcentaje",
    }

    for prefix, table in [
        ("mono_BASE", "calidad_mono_base"),
        ("tri_BASE", "calidad_tri_base"),
    ]:
        df = read_data_file(f"informe_calidad_{prefix}")
        if df.empty:
            print(f"  No data for {prefix}")
            continue

        df.columns = df.columns.str.strip().str.lower().str.replace(' ', '_')
        df = df.loc[:, ~df.columns.duplicated()]

        # Apply column mapping
        rename_dict = {k: v for k, v in base_col_map.items() if k in df.columns}
        if "tri" in prefix:
            tri_rename = {k: v for k, v in tri_base_extra_map.items() if k in df.columns}
            rename_dict.update(tri_rename)
        df = df.rename(columns=rename_dict)

        # For mono: incidencia is the ID, inspector comes from asignado_a
        # For tri: inspector might be numeric (code), use as-is
        if 'incidencia' in df.columns:
            df['incidencia'] = df['incidencia'].fillna('').astype(str).str.replace('.0', '', regex=False)
        if 'cliente' in df.columns:
            df['cliente'] = df['cliente'].fillna('').astype(str).str.replace('.0', '', regex=False)
        if 'medidor' in df.columns:
            df['medidor'] = df['medidor'].fillna('').astype(str).str.replace('.0', '', regex=False)

        # Handle inspector for tri (might be numeric code)
        if 'inspector_raw' in df.columns and 'inspector' not in df.columns:
            df['inspector'] = df['inspector_raw'].fillna('').astype(str).str.replace('.0', '', regex=False)
        elif 'inspector' in df.columns:
            df['inspector'] = df['inspector'].fillna('').astype(str).str.strip()

        # Handle fecha for tri
        if 'fecha_inspeccion_raw' in df.columns and 'fecha_inspeccion' not in df.columns:
            df['fecha_inspeccion'] = pd.to_datetime(df['fecha_inspeccion_raw'], format='mixed', errors='coerce')

        # fecha_de_actualización for mono is the date
        if 'fecha_de_actualización' in df.columns and 'fecha_inspeccion' not in df.columns:
            df['fecha_inspeccion'] = pd.to_datetime(df['fecha_de_actualización'], format='mixed', errors='coerce')

        # tipo_sistema
        if "mono" in prefix:
            df['tipo_sistema'] = 'MONOFASICO'
        else:
            df['tipo_sistema'] = 'TRIFASICO'

        # Compute mes/anio
        if 'fecha_inspeccion' in df.columns:
            df = _add_mes_anio(df, 'fecha_inspeccion')

        # mes_origen from the CSV (if present)
        if 'mes_origen' not in df.columns:
            df['mes_origen'] = None

        # Numeric conversions
        for col in ['error_porcentaje', 'factor_potencia', 'kwi', 'kva']:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')

        known_cols = [
            'incidencia', 'inspector', 'servicio', 'tipo_servicio', 'cliente',
            'nombre_cliente', 'direccion', 'comuna', 'latitud', 'longitud',
            'medidor', 'tarifa', 'constante', 'red', 'estado_suministro',
            'contratista', 'tipo_resultado', 'estado_propiedad',
            'requiere_normalizacion', 'requiere_trabajo', 'notificacion',
            'voltaje', 'amperaje', 'error_porcentaje', 'kc',
            'estado_acometida', 'estado_caja', 'estado_tapa',
            'perno_encontrado', 'perno_normalizado', 'giro',
            'modelo_corresponde', 'medidor_corresponde',
            'fecha_inspeccion', 'tipo_sistema', 'mes', 'anio', 'mes_origen',
            # tri-specific
            'factor_potencia', 'kwi', 'kva',
        ]
        df = _keep_cols(df, known_cols)

        df.to_sql(table, engine, if_exists="replace", index=False, chunksize=5000)
        print(f"  {table}: {len(df)} rows")

    # --- INSPECCIONES tables (mono + tri) ---
    insp_col_map = {
        "cc_number": "incidencia",
        "asignado_a": "inspector",
        "nro_suministro": "servicio",
        "nom_inspector": "inspector_name",
        "resultado_inspeccion": "tipo_resultado",
        "comuna.1": "comuna_alt",
    }

    for prefix, table in [
        ("mono_INSPECCIONES", "calidad_mono_inspecciones"),
        ("tri_INSPECCIONES", "calidad_tri_inspecciones"),
    ]:
        df = read_data_file(f"informe_calidad_{prefix}")
        if df.empty:
            print(f"  No data for {prefix}")
            continue

        df.columns = df.columns.str.strip().str.lower().str.replace(' ', '_')
        df = df.loc[:, ~df.columns.duplicated()]

        rename_dict = {k: v for k, v in insp_col_map.items() if k in df.columns}
        df = df.rename(columns=rename_dict)

        # incidencia/servicio to string
        for col in ['incidencia', 'servicio', 'medidor']:
            if col in df.columns:
                df[col] = df[col].fillna('').astype(str).str.replace('.0', '', regex=False)
                df[col] = df[col].replace({'': None, 'nan': None})

        # Inspector: prefer nom_inspector (inspector_name) if available
        if 'inspector_name' in df.columns:
            df['inspector'] = df['inspector_name'].fillna('').str.strip()
        elif 'inspector' in df.columns:
            df['inspector'] = df['inspector'].fillna('').astype(str).str.strip()

        # Comuna: prefer primary, fallback to alt
        if 'comuna_alt' in df.columns and 'comuna' in df.columns:
            df['comuna'] = df['comuna'].fillna(df['comuna_alt'])

        # Parse dates from ejecucion column
        if 'ejecucion' in df.columns:
            df['fecha_inspeccion'] = pd.to_datetime(df['ejecucion'], format='mixed', errors='coerce')

        # tipo_sistema
        if "mono" in prefix:
            df['tipo_sistema'] = 'MONOFASICO'
        else:
            df['tipo_sistema'] = 'TRIFASICO'

        # Compute mes/anio
        if 'fecha_inspeccion' in df.columns:
            df = _add_mes_anio(df, 'fecha_inspeccion')

        if 'mes_origen' not in df.columns:
            df['mes_origen'] = None

        known_cols = [
            'incidencia', 'inspector', 'servicio', 'cliente',
            'nombre_cliente', 'direccion', 'comuna', 'medidor',
            'contratista', 'tipo_resultado', 'fecha_inspeccion',
            'tipo_sistema', 'mes', 'anio', 'mes_origen',
        ]
        df = _keep_cols(df, known_cols)

        df.to_sql(table, engine, if_exists="replace", index=False, chunksize=5000)
        print(f"  {table}: {len(df)} rows")


def run_analyze(engine):
    """Run ANALYZE on all tables for query optimization."""
    print("\n=== Running ANALYZE ===")
    tables = [
        "users", "nncc", "medidores_cruzados",
        "calidad_mono_base", "calidad_mono_inspecciones",
        "calidad_tri_base", "calidad_tri_inspecciones",
        "lecturas", "telecomunicaciones", "corte_reposicion",
    ]
    with engine.connect() as conn:
        for table in tables:
            try:
                conn.execute(text(f"ANALYZE {table}"))
                conn.commit()
                print(f"  ANALYZE {table}: OK")
            except Exception as e:
                print(f"  ANALYZE {table}: {e}")


def main():
    parser = argparse.ArgumentParser(description="Migrate data to PostgreSQL")
    parser.add_argument("--table", type=str, help="Migrate specific table only")
    parser.add_argument("--chunk", type=int, default=5000, help="Chunk size for large tables")
    args = parser.parse_args()

    if not settings.DATABASE_URL:
        print("ERROR: DATABASE_URL not set in .env")
        sys.exit(1)

    db_url = settings.DATABASE_URL
    if "+asyncpg" in db_url:
        db_url = db_url.replace("postgresql+asyncpg://", "postgresql://")

    print(f"Connecting to database...")
    engine = create_engine(db_url, echo=False)

    migrations = {
        "users": lambda: migrate_users(engine),
        "nncc": lambda: migrate_nncc(engine),
        "medidores_cruzados": lambda: migrate_medidores_cruzados(engine),
        "calidad": lambda: migrate_calidad(engine),
        "lecturas": lambda: migrate_lecturas(engine),
        "telecomunicaciones": lambda: migrate_teleco(engine),
        "corte_reposicion": lambda: migrate_corte(engine, args.chunk),
    }

    if args.table:
        if args.table in migrations:
            migrations[args.table]()
        else:
            print(f"Unknown table: {args.table}")
            print(f"Available: {', '.join(migrations.keys())}")
            sys.exit(1)
    else:
        for name, migrate_fn in migrations.items():
            migrate_fn()

    run_analyze(engine)

    # Show final counts
    print("\n=== Final row counts ===")
    with engine.connect() as conn:
        for table in ["users", "nncc", "medidores_cruzados", "calidad_mono_base",
                       "calidad_mono_inspecciones", "calidad_tri_base",
                       "calidad_tri_inspecciones", "lecturas",
                       "telecomunicaciones", "corte_reposicion"]:
            try:
                count = conn.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
                print(f"  {table}: {count:,} rows")
            except Exception as e:
                print(f"  {table}: ERROR - {e}")

    engine.dispose()
    print("\nMigration complete!")


if __name__ == "__main__":
    main()
