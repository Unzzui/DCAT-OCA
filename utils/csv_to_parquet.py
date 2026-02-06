#!/usr/bin/env python3
"""
Script para convertir archivos CSV a formato Parquet.
Parquet es más rápido para lectura y usa menos espacio en disco.

Uso:
    python utils/csv_to_parquet.py
    python utils/csv_to_parquet.py --file informe_calidad_mono_BASE.csv
    python utils/csv_to_parquet.py --clean  # Elimina los CSVs después de convertir
"""

import os
import sys
import argparse
import pandas as pd
from pathlib import Path
from typing import Optional, List

# Directorios de datos
DATA_DIR = Path(__file__).parent.parent / "data"
PARQUET_DIR = DATA_DIR / "parquet"

# Mapeo de archivos CSV con sus configuraciones de encoding
CSV_FILES_CONFIG = {
    # Calidad
    "informe_calidad_mono_BASE.csv": {"encoding": "utf-8"},
    "informe_calidad_tri_BASE.csv": {"encoding": "utf-8"},
    "informe_calidad_mono_INSPECCIONES.csv": {"encoding": "utf-8"},
    "informe_calidad_tri_INSPECCIONES.csv": {"encoding": "utf-8"},
    "informe_calidad_mono_ALUMBRADO.csv": {"encoding": "utf-8"},
    "informe_calidad_mono_COMUNAS.csv": {"encoding": "utf-8"},
    "informe_calidad_tri_COMUNAS.csv": {"encoding": "utf-8"},
    "informe_calidad_mono_RESULTADOS.csv": {"encoding": "utf-8"},
    "informe_calidad_tri_RESULTADOS.csv": {"encoding": "utf-8"},
    # Lecturas
    "informe_lectura_ORDENES_ORDENES.csv": {"encoding": "utf-8"},
    "informe_lectura_SEC_SEC.csv": {"encoding": "utf-8"},
    "informe_lectura_VIRTUAL_VIRTUAL VISIT.csv": {"encoding": "utf-8"},
    "informe_lectura_VIRTUAL_VISITA VIRTUAL.csv": {"encoding": "utf-8"},
    # Corte
    "informe_corte.csv": {"encoding": "utf-8"},
    # Teleco
    "informe_teleco.csv": {"encoding": "utf-8-sig"},
    # NNCC
    "2025-05 INFORME NNCC (2024-2029) DIC 2025.csv": {"encoding": "utf-8"},
}


def get_parquet_path(csv_path: Path) -> Path:
    """Obtiene la ruta del archivo Parquet correspondiente al CSV en la carpeta parquet/."""
    PARQUET_DIR.mkdir(exist_ok=True)
    return PARQUET_DIR / f"{csv_path.stem}.parquet"


def convert_csv_to_parquet(
    csv_path: Path,
    encoding: str = "utf-8",
    overwrite: bool = False
) -> bool:
    """
    Convierte un archivo CSV a Parquet.

    Args:
        csv_path: Ruta al archivo CSV
        encoding: Encoding del archivo CSV
        overwrite: Si True, sobrescribe el Parquet existente

    Returns:
        True si la conversión fue exitosa, False en caso contrario
    """
    parquet_path = get_parquet_path(csv_path)

    if not csv_path.exists():
        print(f"  ⚠️  No existe: {csv_path.name}")
        return False

    if parquet_path.exists() and not overwrite:
        print(f"  ⏭️  Ya existe: {parquet_path.name}")
        return True

    try:
        # Leer CSV
        df = pd.read_csv(csv_path, encoding=encoding, low_memory=False)

        # Guardar como Parquet con compresión snappy (buen balance velocidad/tamaño)
        df.to_parquet(parquet_path, engine="pyarrow", compression="snappy", index=False)

        # Mostrar estadísticas
        csv_size = csv_path.stat().st_size / (1024 * 1024)  # MB
        parquet_size = parquet_path.stat().st_size / (1024 * 1024)  # MB
        reduction = ((csv_size - parquet_size) / csv_size) * 100 if csv_size > 0 else 0

        print(f"  ✅ {csv_path.name}")
        print(f"      Registros: {len(df):,}")
        print(f"      CSV: {csv_size:.2f} MB → Parquet: {parquet_size:.2f} MB ({reduction:.1f}% reducción)")

        return True

    except Exception as e:
        print(f"  ❌ Error en {csv_path.name}: {str(e)}")
        return False


def convert_all(overwrite: bool = False, clean: bool = False) -> None:
    """Convierte todos los archivos CSV configurados a Parquet."""
    print("\n" + "=" * 60)
    print("📦 Conversión de CSV a Parquet")
    print("=" * 60 + "\n")

    success_count = 0
    error_count = 0

    for csv_name, config in CSV_FILES_CONFIG.items():
        csv_path = DATA_DIR / csv_name
        encoding = config.get("encoding", "utf-8")

        if convert_csv_to_parquet(csv_path, encoding, overwrite):
            success_count += 1

            # Eliminar CSV si se solicita
            if clean and csv_path.exists():
                csv_path.unlink()
                print(f"      🗑️  CSV eliminado")
        else:
            error_count += 1

        print()

    # También buscar CSVs no listados en la configuración
    print("\n🔍 Buscando CSVs adicionales...")
    for csv_file in DATA_DIR.glob("*.csv"):
        if csv_file.name not in CSV_FILES_CONFIG:
            print(f"  ℹ️  CSV no configurado encontrado: {csv_file.name}")
            if convert_csv_to_parquet(csv_file, "utf-8", overwrite):
                success_count += 1
            else:
                error_count += 1

    print("\n" + "=" * 60)
    print(f"📊 Resumen: {success_count} exitosos, {error_count} errores")
    print("=" * 60 + "\n")


def convert_single(filename: str, overwrite: bool = False) -> None:
    """Convierte un solo archivo CSV a Parquet."""
    csv_path = DATA_DIR / filename

    if filename in CSV_FILES_CONFIG:
        encoding = CSV_FILES_CONFIG[filename].get("encoding", "utf-8")
    else:
        encoding = "utf-8"

    convert_csv_to_parquet(csv_path, encoding, overwrite)


def list_files() -> None:
    """Lista los archivos CSV y Parquet en el directorio de datos."""
    print("\n" + "=" * 60)
    print("📁 Archivos en data/")
    print("=" * 60 + "\n")

    csv_files = list(DATA_DIR.glob("*.csv"))
    parquet_files = list(PARQUET_DIR.glob("*.parquet")) if PARQUET_DIR.exists() else []

    print(f"📄 CSVs encontrados (data/): {len(csv_files)}")
    for f in sorted(csv_files):
        size = f.stat().st_size / (1024 * 1024)
        print(f"   - {f.name} ({size:.2f} MB)")

    print(f"\n📦 Parquets encontrados (data/parquet/): {len(parquet_files)}")
    for f in sorted(parquet_files):
        size = f.stat().st_size / (1024 * 1024)
        print(f"   - {f.name} ({size:.2f} MB)")

    print()


def main():
    parser = argparse.ArgumentParser(
        description="Convierte archivos CSV a formato Parquet para mejor rendimiento"
    )
    parser.add_argument(
        "--file", "-f",
        type=str,
        help="Nombre del archivo CSV específico a convertir"
    )
    parser.add_argument(
        "--overwrite", "-o",
        action="store_true",
        help="Sobrescribir archivos Parquet existentes"
    )
    parser.add_argument(
        "--clean", "-c",
        action="store_true",
        help="Eliminar archivos CSV después de convertir"
    )
    parser.add_argument(
        "--list", "-l",
        action="store_true",
        help="Listar archivos CSV y Parquet existentes"
    )

    args = parser.parse_args()

    if args.list:
        list_files()
    elif args.file:
        convert_single(args.file, args.overwrite)
    else:
        convert_all(args.overwrite, args.clean)


if __name__ == "__main__":
    main()
