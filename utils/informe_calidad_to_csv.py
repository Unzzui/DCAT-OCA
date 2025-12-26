import pandas as pd
from pathlib import Path

# Rutas
DATA_DIR = Path(__file__).parent.parent / "data"
EXCEL_MONO = DATA_DIR / "11_2025_calidad_mono.xlsx"
EXCEL_TRI = DATA_DIR / "11_2025_calidad_tri.xlsx"

def excel_to_csv():
    # Procesar archivo MONO
    print(f"\n{'='*50}")
    print(f"Procesando archivo MONOFASICO: {EXCEL_MONO}")
    print(f"{'='*50}")
    process_excel_file(EXCEL_MONO, "mono")

    # Procesar archivo TRI
    print(f"\n{'='*50}")
    print(f"Procesando archivo TRIFASICO: {EXCEL_TRI}")
    print(f"{'='*50}")
    process_excel_file(EXCEL_TRI, "tri")

    print("\nProceso completado.")

def process_excel_file(excel_path, prefix):
    if not excel_path.exists():
        print(f"  ERROR: Archivo no encontrado: {excel_path}")
        return

    excel_file = pd.ExcelFile(excel_path)
    sheet_names = excel_file.sheet_names

    print(f"Hojas encontradas: {sheet_names}")

    # Procesar cada hoja (excepto Sheet1 que suele estar vacia)
    for sheet_name in sheet_names:
        if sheet_name.lower() == "sheet1":
            print(f"\n  Saltando hoja '{sheet_name}' (hoja por defecto)")
            continue
        process_sheet(excel_file, sheet_name, prefix)

def process_sheet(excel_file, sheet_name, prefix):
    print(f"\nProcesando hoja '{sheet_name}' ({prefix})...")

    df = pd.read_excel(excel_file, sheet_name=sheet_name)

    print(f"  Filas leidas: {len(df)}")
    print(f"  Columnas originales: {len(df.columns)}")

    # Eliminar columnas que empiezan con "Unnamed" o tienen nombres NaN (columnas vacias)
    mask = df.columns.to_series().str.startswith("Unnamed").fillna(True)
    df = df.loc[:, ~mask]

    print(f"  Columnas finales: {len(df.columns)}")

    # Generar nombre de archivo CSV
    # Limpiar el nombre de la hoja para usarlo como nombre de archivo
    safe_sheet_name = sheet_name.replace("/", "-").replace("\\", "-").replace(":", "-").upper()
    output_csv = DATA_DIR / f"informe_calidad_{prefix}_{safe_sheet_name}.csv"

    # Guardar como CSV
    df.to_csv(output_csv, index=False, encoding="utf-8-sig")
    print(f"  CSV guardado en: {output_csv}")

    return df

if __name__ == "__main__":
    excel_to_csv()
