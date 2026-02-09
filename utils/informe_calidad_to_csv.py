import pandas as pd
from pathlib import Path

# Rutas
DATA_DIR = Path(__file__).parent.parent / "data"
ENEL_CALIDAD_DIR = DATA_DIR / "ENEL Calidad" / "2. Control Pérdida" / "2025"

# Archivos originales (mes 11 ya existente en data/)
EXCEL_MONO_LEGACY = DATA_DIR / "11_2025_calidad_mono.xlsx"
EXCEL_TRI_LEGACY = DATA_DIR / "11_2025_calidad_tri.xlsx"


def excel_to_csv():
    # Procesar archivos mensuales desde ENEL Calidad (meses 02-11)
    months = ["02", "03", "04", "05", "06", "07", "08", "09", "10", "11"]

    all_mono_dfs = {}  # {sheet_name: [df1, df2, ...]}
    all_tri_dfs = {}

    for month in months:
        month_dir = ENEL_CALIDAD_DIR / month
        if not month_dir.exists():
            print(f"Directorio no encontrado: {month_dir}")
            continue

        # Find mono and tri files in the month directory
        mono_files = list(month_dir.glob("*calidad_mono*"))
        tri_files = list(month_dir.glob("*calidad_tri*"))

        for mono_file in mono_files:
            print(f"\n{'='*50}")
            print(f"Procesando MONO mes {month}: {mono_file.name}")
            print(f"{'='*50}")
            process_monthly_file(mono_file, "mono", month, all_mono_dfs)

        for tri_file in tri_files:
            print(f"\n{'='*50}")
            print(f"Procesando TRI mes {month}: {tri_file.name}")
            print(f"{'='*50}")
            process_monthly_file(tri_file, "tri", month, all_tri_dfs)

    # Combine all monthly data per sheet and save
    print(f"\n{'='*50}")
    print("Combinando datos mensuales...")
    print(f"{'='*50}")

    for sheet_name, dfs in all_mono_dfs.items():
        if dfs:
            combined = pd.concat(dfs, ignore_index=True)
            safe_sheet_name = sheet_name.replace("/", "-").replace("\\", "-").replace(":", "-").upper()
            output_csv = DATA_DIR / f"informe_calidad_mono_{safe_sheet_name}.csv"
            combined.to_csv(output_csv, index=False, encoding="utf-8-sig")
            print(f"  MONO {safe_sheet_name}: {len(combined)} registros -> {output_csv.name}")

    for sheet_name, dfs in all_tri_dfs.items():
        if dfs:
            combined = pd.concat(dfs, ignore_index=True)
            safe_sheet_name = sheet_name.replace("/", "-").replace("\\", "-").replace(":", "-").upper()
            output_csv = DATA_DIR / f"informe_calidad_tri_{safe_sheet_name}.csv"
            combined.to_csv(output_csv, index=False, encoding="utf-8-sig")
            print(f"  TRI {safe_sheet_name}: {len(combined)} registros -> {output_csv.name}")

    print("\nProceso completado.")


def process_monthly_file(excel_path, prefix, month, all_dfs):
    if not excel_path.exists():
        print(f"  ERROR: Archivo no encontrado: {excel_path}")
        return

    try:
        excel_file = pd.ExcelFile(excel_path)
        sheet_names = excel_file.sheet_names
        print(f"Hojas encontradas: {sheet_names}")

        for sheet_name in sheet_names:
            if sheet_name.lower() == "sheet1":
                print(f"\n  Saltando hoja '{sheet_name}' (hoja por defecto)")
                continue

            df = process_sheet(excel_file, sheet_name, prefix)
            if df is not None and not df.empty:
                # Add MES_ORIGEN column
                df['MES_ORIGEN'] = f"{month}_2025"

                safe_name = sheet_name.replace("/", "-").replace("\\", "-").replace(":", "-").upper()
                if safe_name not in all_dfs:
                    all_dfs[safe_name] = []
                all_dfs[safe_name].append(df)
    except Exception as e:
        print(f"  ERROR procesando {excel_path.name}: {e}")


def process_sheet(excel_file, sheet_name, prefix):
    print(f"\nProcesando hoja '{sheet_name}' ({prefix})...")

    df = pd.read_excel(excel_file, sheet_name=sheet_name)

    print(f"  Filas leidas: {len(df)}")
    print(f"  Columnas originales: {len(df.columns)}")

    # Eliminar columnas que empiezan con "Unnamed" o tienen nombres NaN (columnas vacias)
    mask = df.columns.to_series().str.startswith("Unnamed").fillna(True)
    df = df.loc[:, ~mask]

    print(f"  Columnas finales: {len(df.columns)}")

    return df


if __name__ == "__main__":
    excel_to_csv()
