#!/usr/bin/env python3
"""
Script para cargar datos del modulo de Lecturas desde archivos Excel.
Carga: IPAL, Preventivas, Ordenes Genericas, Refacturaciones, Lecturas a Grabar, Correos.

Uso:
    python backend/scripts/load_lectura_data.py [--module MODULE] [--clear]

    --module: Cargar solo un modulo especifico (ipal, preventivas, refacturaciones, correos, ordenes, grabar)
    --clear: Limpiar datos existentes antes de cargar
"""

import os
import sys
import re
import argparse
from pathlib import Path
from datetime import datetime, date
import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

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

# Base data path
DATA_PATH = Path(__file__).parent.parent.parent / 'data' / 'ENEL Calidad' / '4. Lectura'

# Month name to number mapping
MONTH_MAP = {
    'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6,
    'julio': 7, 'agosto': 8, 'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12,
    'ene': 1, 'feb': 2, 'mar': 3, 'abr': 4, 'may': 5, 'jun': 6,
    'jul': 7, 'ago': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dic': 12,
}


def parse_period_from_filename(filename: str) -> tuple[int | None, int | None]:
    """Extract month and year from filename."""
    filename_lower = filename.lower()
    found_month = None
    found_year = None

    # Look for year anywhere in filename
    year_match = re.search(r'20\d{2}', filename)
    if year_match:
        found_year = int(year_match.group())

    # Try to find month name (check longer names first to avoid partial matches)
    month_names_sorted = sorted(MONTH_MAP.keys(), key=len, reverse=True)
    for month_name in month_names_sorted:
        if month_name in filename_lower:
            found_month = MONTH_MAP[month_name]
            break

    # Try pattern like "01 ENERO 2025" or "01_ENERO 2026"
    if found_month is None:
        match = re.search(r'(\d{2})\s*[_\-]?\s*(\w+)', filename)
        if match:
            try:
                month_num = int(match.group(1))
                if 1 <= month_num <= 12:
                    found_month = month_num
            except ValueError:
                pass

    return found_month, found_year


def safe_float(val) -> float | None:
    """Safely convert value to float."""
    if pd.isna(val) or val is None or val == '':
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def safe_int(val) -> int | None:
    """Safely convert value to int."""
    if pd.isna(val) or val is None or val == '':
        return None
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return None


def safe_str(val, max_len: int = None) -> str | None:
    """Safely convert value to string."""
    if pd.isna(val) or val is None:
        return None
    s = str(val).strip()
    if s == '' or s.lower() in ('nan', 'none', 'null'):
        return None
    if max_len:
        s = s[:max_len]
    return s


def safe_date(val) -> date | None:
    """Safely convert value to date."""
    if pd.isna(val) or val is None:
        return None
    if isinstance(val, (datetime, date)):
        return val.date() if isinstance(val, datetime) else val
    try:
        return pd.to_datetime(val).date()
    except:
        return None


def load_ipal_inspecciones(session, clear: bool = False):
    """Load IPAL inspecciones from Excel files."""
    print("\n=== Loading IPAL Inspecciones ===")

    if clear:
        session.execute(text("DELETE FROM ipal_inspecciones"))
        session.commit()
        print("Cleared existing IPAL data")

    ipal_path = DATA_PATH / 'ipal y preventivas'
    if not ipal_path.exists():
        print(f"IPAL path not found: {ipal_path}")
        return

    total_loaded = 0

    # Find all IPAL files
    for month_dir in sorted(ipal_path.iterdir()):
        if not month_dir.is_dir():
            continue

        for file in month_dir.glob('*Inspecciones*Seguridad*.xlsx'):
            print(f"  Processing: {month_dir.name}/{file.name}")
            # Try filename first, then folder name
            mes, anio = parse_period_from_filename(file.name)
            if mes is None or anio is None:
                mes_folder, anio_folder = parse_period_from_filename(month_dir.name)
                if mes is None:
                    mes = mes_folder
                if anio is None:
                    anio = anio_folder
            # Default year based on folder pattern
            if anio is None:
                if '2026' in month_dir.name or '2026' in file.name:
                    anio = 2026
                else:
                    anio = 2025
            print(f"    Periodo: {anio}-{mes}")

            try:
                df = pd.read_excel(file, sheet_name='IPALES')
                # Filter out rows without valid Fecha (most are empty)
                df = df[df['Fecha'].notna()]
                print(f"    Valid rows: {len(df)}")
            except Exception as e:
                print(f"    Error reading file: {e}")
                continue

            records = []
            for _, row in df.iterrows():
                record = {
                    'fecha': safe_date(row.get('Fecha')),
                    'comuna': safe_str(row.get('Comuna'), 100),
                    'nombre_lector': safe_str(row.get('Nombre Lector'), 200),
                    'empresa': safe_str(row.get('Empresa'), 100),
                    'inspector': safe_str(row.get('INSPECTOR'), 100),
                    'estado': safe_str(row.get('Estado'), 50),
                    'hora_llamada': safe_str(row.get('Hora Llamada'), 50),
                    'nro_ipal': safe_str(row.get('Nº IPAL'), 50),
                    'observacion': safe_str(row.get('Observación')),
                    'codigo_hallazgo': safe_str(row.get('Codigo Hallazgo'), 100),
                    'observacion_inspector': safe_str(row.get('Observacion Inspector')),
                    'direccion': safe_str(row.get('DIRECCION DE INSPECCION')),
                    'mes': mes,
                    'anio': anio,
                }
                records.append(record)

            if records:
                session.execute(
                    text("""
                        INSERT INTO ipal_inspecciones
                        (fecha, comuna, nombre_lector, empresa, inspector, estado, hora_llamada,
                         nro_ipal, observacion, codigo_hallazgo, observacion_inspector, direccion, mes, anio)
                        VALUES (:fecha, :comuna, :nombre_lector, :empresa, :inspector, :estado, :hora_llamada,
                                :nro_ipal, :observacion, :codigo_hallazgo, :observacion_inspector, :direccion, :mes, :anio)
                    """),
                    records
                )
                session.commit()
                total_loaded += len(records)
                print(f"    Loaded {len(records)} records")

    print(f"  Total IPAL records loaded: {total_loaded}")


def load_preventivas(session, clear: bool = False):
    """Load Preventivas from Excel files."""
    print("\n=== Loading Preventivas ===")

    if clear:
        session.execute(text("DELETE FROM lecturas_preventivas"))
        session.commit()
        print("Cleared existing Preventivas data")

    prev_path = DATA_PATH / 'ipal y preventivas'
    if not prev_path.exists():
        print(f"Preventivas path not found: {prev_path}")
        return

    total_loaded = 0

    for month_dir in sorted(prev_path.iterdir()):
        if not month_dir.is_dir():
            continue

        for file in month_dir.glob('Preventivas*.xlsx'):
            print(f"  Processing: {file.name}")
            mes, anio = parse_period_from_filename(file.name)

            try:
                df = pd.read_excel(file, sheet_name='base')
                # Filter out rows without valid Numero Cliente
                df = df[df['Numero Cliente'].notna()]
                print(f"    Valid rows: {len(df)}")
            except Exception as e:
                print(f"    Error reading file: {e}")
                continue

            records = []
            for _, row in df.iterrows():
                record = {
                    'numero_cliente': safe_str(row.get('Numero Cliente'), 50),
                    'sector': safe_int(row.get('Sector')),
                    'zona': safe_int(row.get('Zona')),
                    'grupo': safe_int(row.get('Grupo')),
                    'ruta': safe_str(row.get('Ruta'), 20),
                    'tipo_operacion': safe_str(row.get('Tipo operacion'), 50),
                    'tarifa': safe_str(row.get('Tarifa'), 20),
                    'direccion': safe_str(row.get('Direccion')),
                    'consumo_prom_diario': safe_float(row.get('Consumo Prom. Diario')),
                    'periodo_lectura': safe_int(row.get('Periodo de lectura')),
                    'medidor': safe_str(row.get('Medidor'), 50),
                    'marca_medidor': safe_str(row.get('Marca Medidor'), 50),
                    'constante': safe_int(row.get('Constante')),
                    'lectura_anterior': safe_float(row.get('Lectura Anterior')),
                    'lectura_actual': safe_float(row.get('Lectura Actual')),
                    'consumo_anterior': safe_float(row.get('Consumo Anterior')),
                    'consumo_actual': safe_float(row.get('Consumo Actual')),
                    'irregularidad_1': safe_str(row.get('Irregularidad 1'), 100),
                    'irregularidad_2': safe_str(row.get('Irregularidad 2'), 100),
                    'irregularidad_3': safe_str(row.get('Irregularidad 3'), 100),
                    'irregularidad_4': safe_str(row.get('Irregularidad 4'), 100),
                    'verificacion_lectura': safe_str(row.get('Verificacion Lectura'), 100),
                    'codigo_lector': safe_int(row.get('Codigo Lector')),
                    'insitu': safe_str(row.get('INSITU'), 5),
                    'facturado': safe_str(row.get('Facturado'), 5),
                    'rf': safe_str(row.get('RF'), 5),
                    'mes': mes,
                    'anio': anio,
                }
                records.append(record)

            if records:
                # Insert in batches
                batch_size = 5000
                for i in range(0, len(records), batch_size):
                    batch = records[i:i+batch_size]
                    session.execute(
                        text("""
                            INSERT INTO lecturas_preventivas
                            (numero_cliente, sector, zona, grupo, ruta, tipo_operacion, tarifa, direccion,
                             consumo_prom_diario, periodo_lectura, medidor, marca_medidor, constante,
                             lectura_anterior, lectura_actual, consumo_anterior, consumo_actual,
                             irregularidad_1, irregularidad_2, irregularidad_3, irregularidad_4,
                             verificacion_lectura, codigo_lector, insitu, facturado, rf, mes, anio)
                            VALUES (:numero_cliente, :sector, :zona, :grupo, :ruta, :tipo_operacion, :tarifa, :direccion,
                                    :consumo_prom_diario, :periodo_lectura, :medidor, :marca_medidor, :constante,
                                    :lectura_anterior, :lectura_actual, :consumo_anterior, :consumo_actual,
                                    :irregularidad_1, :irregularidad_2, :irregularidad_3, :irregularidad_4,
                                    :verificacion_lectura, :codigo_lector, :insitu, :facturado, :rf, :mes, :anio)
                        """),
                        batch
                    )
                    session.commit()
                total_loaded += len(records)
                print(f"    Loaded {len(records)} records")

    print(f"  Total Preventivas records loaded: {total_loaded}")


def load_ordenes_genericas(session, clear: bool = False):
    """Load Ordenes Genericas from Excel files."""
    print("\n=== Loading Ordenes Genericas ===")

    if clear:
        session.execute(text("DELETE FROM ordenes_genericas"))
        session.commit()
        print("Cleared existing Ordenes Genericas data")

    ordenes_path = DATA_PATH / 'ordenes genericas'
    if not ordenes_path.exists():
        print(f"Ordenes path not found: {ordenes_path}")
        return

    total_loaded = 0

    for file in sorted(ordenes_path.glob('Planilla Ordg*.xlsx')):
        print(f"  Processing: {file.name}")
        mes, anio = parse_period_from_filename(file.name)

        try:
            df = pd.read_excel(file, sheet_name='Hoja1')
        except Exception as e:
            print(f"    Error reading file: {e}")
            continue

        records = []
        for _, row in df.iterrows():
            record = {
                'numero_incidencia': safe_str(row.get('NÚMERO DE INCIDENCIA') or row.get('NUMERO DE INCIDENCIA'), 50),
                'asignado_a': safe_str(row.get('ASIGNADO A'), 100),
                'fecha': safe_date(row.get('FECHA')),
                'lectura_activa': safe_float(row.get('LECTURA ACTIVA')),
                'mes': mes,
                'anio': anio,
            }
            records.append(record)

        if records:
            session.execute(
                text("""
                    INSERT INTO ordenes_genericas
                    (numero_incidencia, asignado_a, fecha, lectura_activa, mes, anio)
                    VALUES (:numero_incidencia, :asignado_a, :fecha, :lectura_activa, :mes, :anio)
                """),
                records
            )
            session.commit()
            total_loaded += len(records)
            print(f"    Loaded {len(records)} records")

    print(f"  Total Ordenes Genericas records loaded: {total_loaded}")


def load_refacturaciones(session, clear: bool = False):
    """Load Refacturaciones from Excel files."""
    print("\n=== Loading Refacturaciones ===")

    if clear:
        session.execute(text("DELETE FROM refacturaciones"))
        session.commit()
        print("Cleared existing Refacturaciones data")

    refas_path = DATA_PATH / 'refas'
    if not refas_path.exists():
        print(f"Refacturaciones path not found: {refas_path}")
        return

    total_loaded = 0

    for file in sorted(refas_path.glob('Re facturaciones BASE*.xlsx')):
        print(f"  Processing: {file.name}")
        mes, anio = parse_period_from_filename(file.name)

        # If year not found, assume current or default based on filename
        if anio is None:
            if '2026' in file.name:
                anio = 2026
            else:
                anio = 2025
        print(f"    Periodo: {anio}-{mes}")

        try:
            # Read all sheets - each sheet is a day of the month
            xl = pd.ExcelFile(file)
            all_dfs = []

            for sheet_name in xl.sheet_names:
                try:
                    # Header is at row 3 (0-indexed)
                    df = pd.read_excel(file, sheet_name=sheet_name, header=3)
                    df.columns = [str(c).strip().upper() for c in df.columns]

                    # Filter valid rows (must have CLIENTE)
                    if 'CLIENTE' in df.columns:
                        df = df[df['CLIENTE'].notna()]
                        if not df.empty:
                            all_dfs.append(df)
                except Exception:
                    continue

            if not all_dfs:
                print(f"    No valid data found")
                continue

            # Combine all sheets
            combined_df = pd.concat(all_dfs, ignore_index=True)
            print(f"    Valid rows: {len(combined_df)}")

        except Exception as e:
            print(f"    Error reading file: {e}")
            continue

        records = []
        for _, row in combined_df.iterrows():
            record = {
                'cliente': safe_str(row.get('CLIENTE'), 50),
                'ruta': safe_str(row.get('RUTA'), 20),
                'medidor': safe_str(row.get('MEDIDOR'), 50),
                'lectura_normal': safe_float(row.get('LEC.NORMAL') or row.get('LEC. NORMAL')),
                'fecha_normal': safe_date(row.get('FECHA')),
                'lectura_erronea': safe_float(row.get('LEC.ERRONEA') or row.get('LEC. ERRONEA')),
                'fecha_erronea': safe_date(row.get('FECHA.1')),
                'lectura_verificada': safe_float(row.get('LEC. VERIF.') or row.get('LEC.VERIF')),
                'fecha_verificada': safe_date(row.get('FECHA.2')),
                'constante': safe_int(row.get('CTTE') or row.get('COR.')),
                'facturado': safe_int(row.get('FACT.')),
                'kwh_cobrar': safe_float(row.get('KWH A COBRAR')),
                'kwh_rebajar': safe_float(row.get('KWH A REBAJ.')),
                'modif_lectura': safe_str(row.get('MODIF. LECT. A') or row.get('MODIF. LECTURA'), 100),
                'orden': safe_str(row.get('ORDEN'), 50),
                'comuna': safe_str(row.get('COMUNA'), 100),
                'leido_por': safe_str(row.get('LEIDO POR'), 100),
                'mes': mes,
                'anio': anio,
            }
            # Only add if we have at least cliente
            if record['cliente']:
                records.append(record)

        if records:
            session.execute(
                text("""
                    INSERT INTO refacturaciones
                    (cliente, ruta, medidor, lectura_normal, fecha_normal, lectura_erronea, fecha_erronea,
                     lectura_verificada, fecha_verificada, constante, facturado, kwh_cobrar, kwh_rebajar,
                     modif_lectura, orden, comuna, leido_por, mes, anio)
                    VALUES (:cliente, :ruta, :medidor, :lectura_normal, :fecha_normal, :lectura_erronea, :fecha_erronea,
                            :lectura_verificada, :fecha_verificada, :constante, :facturado, :kwh_cobrar, :kwh_rebajar,
                            :modif_lectura, :orden, :comuna, :leido_por, :mes, :anio)
                """),
                records
            )
            session.commit()
            total_loaded += len(records)
            print(f"    Loaded {len(records)} records")

    print(f"  Total Refacturaciones records loaded: {total_loaded}")


def load_lecturas_grabar(session, clear: bool = False):
    """Load Lecturas a Grabar from Excel files."""
    print("\n=== Loading Lecturas a Grabar ===")

    if clear:
        session.execute(text("DELETE FROM lecturas_grabar"))
        session.commit()
        print("Cleared existing Lecturas a Grabar data")

    grabar_path = DATA_PATH / 'lecturas a grabar'
    if not grabar_path.exists():
        print(f"Lecturas a Grabar path not found: {grabar_path}")
        return

    total_loaded = 0

    for file in sorted(grabar_path.glob('BASE DE LECTURAS A GRABAR*.xlsx')):
        print(f"  Processing: {file.name}")

        # Get year from filename
        anio = 2025
        if '2026' in file.name:
            anio = 2026

        try:
            xl = pd.ExcelFile(file)
            for sheet_name in xl.sheet_names:
                # Handle variations like 'AGOS' for agosto
                sheet_upper = sheet_name.upper()
                if sheet_upper in ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN',
                                   'JUL', 'AGO', 'AGOS', 'SEP', 'OCT', 'NOV', 'DIC']:
                    mes = MONTH_MAP.get(sheet_name.lower()[:3], None)
                    if mes is None:
                        continue

                    df = pd.read_excel(file, sheet_name=sheet_name)
                    # Normalize column names by stripping whitespace
                    df.columns = [str(c).strip() for c in df.columns]
                    # Filter out empty rows
                    df = df[df.iloc[:, 0].notna()]  # First column (Cliente) must be non-null
                    print(f"    Sheet {sheet_name}: {len(df)} rows")

                    records = []
                    for _, row in df.iterrows():
                        record = {
                            'cliente': safe_str(row.get('Cliente'), 50),
                            'leido_por': safe_str(row.get('LEIDO POR'), 100),
                            'ruta': safe_str(row.get('Ruta'), 20),
                            'tarifa': safe_str(row.get('tarifa'), 20),
                            'medidor_activo': safe_str(row.get('Medidor Activo'), 50),
                            'medidor_reactivo': safe_str(row.get('Medidor Reactivo'), 50),
                            'fecha_lectura': safe_date(row.get('Fecha Lectura')),
                            'centro_operativo': safe_str(row.get('Centro Operativo'), 100),
                            'lec_activa': safe_float(row.get('LEC ACTIVA')),
                            'lec_reactiva': safe_float(row.get('LEC REACTIVA')),
                            'hora_max_hp': safe_str(row.get('HORA MAX HP'), 50),
                            'fecha_max_hp': safe_date(row.get('FECHA MAX HP')),
                            'dem_hp_encontrada': safe_float(row.get('DEM HP ENCONTRADA')),
                            'dem_hp_dejada': safe_float(row.get('DEM HP DEJADA')),
                            'dem_fp_encontrada': safe_float(row.get('DEM FP ENCONTRADA')),
                            'dem_fp_dejada': safe_float(row.get('DEM FP DEJADA')),
                            'observacion': safe_str(row.get('OBSERVACION')),
                            'fecha_envio': safe_date(row.get('FECHA DE ENVIO')),
                            'mes': mes,
                            'anio': anio,
                        }
                        if record['cliente']:
                            records.append(record)

                    if records:
                        session.execute(
                            text("""
                                INSERT INTO lecturas_grabar
                                (cliente, leido_por, ruta, tarifa, medidor_activo, medidor_reactivo,
                                 fecha_lectura, centro_operativo, lec_activa, lec_reactiva,
                                 hora_max_hp, fecha_max_hp, dem_hp_encontrada, dem_hp_dejada,
                                 dem_fp_encontrada, dem_fp_dejada, observacion, fecha_envio, mes, anio)
                                VALUES (:cliente, :leido_por, :ruta, :tarifa, :medidor_activo, :medidor_reactivo,
                                        :fecha_lectura, :centro_operativo, :lec_activa, :lec_reactiva,
                                        :hora_max_hp, :fecha_max_hp, :dem_hp_encontrada, :dem_hp_dejada,
                                        :dem_fp_encontrada, :dem_fp_dejada, :observacion, :fecha_envio, :mes, :anio)
                            """),
                            records
                        )
                        session.commit()
                        total_loaded += len(records)
                        print(f"    Sheet {sheet_name}: Loaded {len(records)} records")
        except Exception as e:
            print(f"    Error reading file: {e}")
            continue

    print(f"  Total Lecturas a Grabar records loaded: {total_loaded}")


def load_correos(session, clear: bool = False):
    """Load Correos/Inspecciones Especiales from Excel files."""
    print("\n=== Loading Correos/Inspecciones Especiales ===")

    if clear:
        session.execute(text("DELETE FROM inspecciones_correos"))
        session.commit()
        print("Cleared existing Correos data")

    total_loaded = 0

    # ENEL Correos
    enel_path = DATA_PATH / 'inspecciones Enel (correos)'
    if enel_path.exists():
        for file in sorted(enel_path.glob('PLANILLA DE CORREOS*.xlsx')):
            # Skip temp files
            if file.name.startswith('~$'):
                continue
            print(f"  Processing ENEL: {file.name}")
            anio = 2026 if '2026' in file.name else 2025

            try:
                xl = pd.ExcelFile(file)
                for sheet_name in xl.sheet_names:
                    sheet_upper = sheet_name.upper()
                    if sheet_upper in ['BASE', 'ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN',
                                       'JUL', 'AGO', 'AGOS', 'SEP', 'SEPT', 'OCT', 'NOV', 'DIC']:
                        if sheet_upper == 'BASE':
                            mes = None  # Will be determined from data
                        else:
                            mes = MONTH_MAP.get(sheet_name.lower()[:3], None)

                        df = pd.read_excel(file, sheet_name=sheet_name)

                        records = []
                        for _, row in df.iterrows():
                            fecha_rec = safe_date(row.get('FECHA DE RECEPCION'))
                            fecha_resp = safe_date(row.get('FECHA DE RESPUESTA'))

                            # Calculate dias_respuesta
                            dias = None
                            if fecha_rec and fecha_resp:
                                dias = (fecha_resp - fecha_rec).days

                            # Determine month from fecha_recepcion if not set
                            record_mes = mes
                            if record_mes is None and fecha_rec:
                                record_mes = fecha_rec.month

                            record = {
                                'fuente': 'ENEL',
                                'fecha_recepcion': fecha_rec,
                                'cliente': safe_str(row.get('CLIENTE'), 50),
                                'quien_envio': safe_str(row.get('QUIEN ENVIO EL CORREO'), 200),
                                'reclamo': safe_str(row.get('RECLAMO')),
                                'fecha_terreno': safe_date(row.get('FECHA EN QUE SALIO A TERRENO')),
                                'respuesta': safe_str(row.get('RESPUESTA')),
                                'fecha_respuesta': fecha_resp,
                                'inspector': safe_str(row.get('INSPECTOR'), 100),
                                'comuna': safe_str(row.get('COMUNA'), 100),
                                'tarifa': safe_str(row.get('TARIFA'), 20),
                                'gestion': safe_str(row.get('gestion') or row.get('GESTION'), 50),
                                'sector': safe_float(row.get('sector') or row.get('SECTOR')),
                                'fecha_inspeccion': safe_date(row.get('fecha inspeccion') or row.get('FECHA INSPECCION')),
                                'dias_respuesta': dias,
                                'mes': record_mes,
                                'anio': anio,
                            }
                            if record['cliente'] or record['reclamo']:
                                records.append(record)

                        if records:
                            session.execute(
                                text("""
                                    INSERT INTO inspecciones_correos
                                    (fuente, fecha_recepcion, cliente, quien_envio, reclamo, fecha_terreno,
                                     respuesta, fecha_respuesta, inspector, comuna, tarifa, gestion,
                                     sector, fecha_inspeccion, dias_respuesta, mes, anio)
                                    VALUES (:fuente, :fecha_recepcion, :cliente, :quien_envio, :reclamo, :fecha_terreno,
                                            :respuesta, :fecha_respuesta, :inspector, :comuna, :tarifa, :gestion,
                                            :sector, :fecha_inspeccion, :dias_respuesta, :mes, :anio)
                                """),
                                records
                            )
                            session.commit()
                            total_loaded += len(records)
                            print(f"    Sheet {sheet_name}: Loaded {len(records)} records")
            except Exception as e:
                print(f"    Error reading file: {e}")
                continue

    # COLINA Correos
    colina_path = DATA_PATH / 'inspecciones Colina (correos)'
    if colina_path.exists():
        for file in sorted(colina_path.glob('PLANILLA DE CORREOS*.xlsx')):
            # Skip temp files
            if file.name.startswith('~$'):
                continue
            print(f"  Processing COLINA: {file.name}")
            anio = 2026 if '2026' in file.name else 2025

            try:
                xl = pd.ExcelFile(file)
                for sheet_name in xl.sheet_names:
                    sheet_lower = sheet_name.lower()
                    if sheet_lower in ['base', 'ene', 'feb', 'mar', 'abr', 'may', 'jun',
                                       'jul', 'ago', 'agos', 'sep', 'sept', 'oct', 'nov', 'dic']:
                        if sheet_lower == 'base':
                            mes = None
                        else:
                            mes = MONTH_MAP.get(sheet_name.lower()[:3], None)

                        df = pd.read_excel(file, sheet_name=sheet_name)

                        records = []
                        for _, row in df.iterrows():
                            fecha_rec = safe_date(row.get('FECHA DE RECEPCION'))
                            fecha_resp = safe_date(row.get('FECHA DE RESPUESTA'))

                            dias = None
                            if fecha_rec and fecha_resp:
                                dias = (fecha_resp - fecha_rec).days

                            record_mes = mes
                            if record_mes is None and fecha_rec:
                                record_mes = fecha_rec.month

                            record = {
                                'fuente': 'COLINA',
                                'fecha_recepcion': fecha_rec,
                                'cliente': safe_str(row.get('CLIENTE'), 50),
                                'quien_envio': safe_str(row.get('QUIEN ENVIO EL CORREO'), 200),
                                'reclamo': safe_str(row.get('RECLAMO')),
                                'fecha_terreno': safe_date(row.get('FECHA EN QUE SALIO A TERRENO')),
                                'respuesta': safe_str(row.get('RESPUESTA')),
                                'fecha_respuesta': fecha_resp,
                                'inspector': safe_str(row.get('INSPECTOR'), 100),
                                'comuna': safe_str(row.get('COMUNA'), 100),
                                'tarifa': safe_str(row.get('TARIFA'), 20),
                                'gestion': safe_str(row.get('GESTION') or row.get('gestion'), 50),
                                'sector': safe_float(row.get('SECTOR') or row.get('sector')),
                                'fecha_inspeccion': safe_date(row.get('FECHA INSPECCION') or row.get('fecha inspeccion')),
                                'dias_respuesta': dias,
                                'mes': record_mes,
                                'anio': anio,
                            }
                            if record['cliente'] or record['reclamo']:
                                records.append(record)

                        if records:
                            session.execute(
                                text("""
                                    INSERT INTO inspecciones_correos
                                    (fuente, fecha_recepcion, cliente, quien_envio, reclamo, fecha_terreno,
                                     respuesta, fecha_respuesta, inspector, comuna, tarifa, gestion,
                                     sector, fecha_inspeccion, dias_respuesta, mes, anio)
                                    VALUES (:fuente, :fecha_recepcion, :cliente, :quien_envio, :reclamo, :fecha_terreno,
                                            :respuesta, :fecha_respuesta, :inspector, :comuna, :tarifa, :gestion,
                                            :sector, :fecha_inspeccion, :dias_respuesta, :mes, :anio)
                                """),
                                records
                            )
                            session.commit()
                            total_loaded += len(records)
                            print(f"    Sheet {sheet_name}: Loaded {len(records)} records")
            except Exception as e:
                print(f"    Error reading file: {e}")
                continue

    print(f"  Total Correos records loaded: {total_loaded}")


def main():
    parser = argparse.ArgumentParser(description='Load Lectura module data from Excel files')
    parser.add_argument('--module', choices=['ipal', 'preventivas', 'ordenes', 'refacturaciones', 'grabar', 'correos', 'all'],
                        default='all', help='Module to load (default: all)')
    parser.add_argument('--clear', action='store_true', help='Clear existing data before loading')
    args = parser.parse_args()

    print(f"Connecting to database...")
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        if args.module == 'all':
            load_ipal_inspecciones(session, args.clear)
            load_preventivas(session, args.clear)
            load_ordenes_genericas(session, args.clear)
            load_refacturaciones(session, args.clear)
            load_lecturas_grabar(session, args.clear)
            load_correos(session, args.clear)
        elif args.module == 'ipal':
            load_ipal_inspecciones(session, args.clear)
        elif args.module == 'preventivas':
            load_preventivas(session, args.clear)
        elif args.module == 'ordenes':
            load_ordenes_genericas(session, args.clear)
        elif args.module == 'refacturaciones':
            load_refacturaciones(session, args.clear)
        elif args.module == 'grabar':
            load_lecturas_grabar(session, args.clear)
        elif args.module == 'correos':
            load_correos(session, args.clear)

        print("\n=== Load Complete ===")

    except Exception as e:
        print(f"Error: {e}")
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == '__main__':
    main()
