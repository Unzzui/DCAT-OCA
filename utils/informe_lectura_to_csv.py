import pandas as pd
from pathlib import Path

# Rutas
DATA_DIR = Path(__file__).parent.parent / "data"
EXCEL_FILE = DATA_DIR / "Planilla Ordg 12 DICIEMBRE 2025 BASE ACT.xlsx"

def excel_to_csv():
    print(f"Leyendo archivo: {EXCEL_FILE}")

    # Leer todas las hojas del archivo Excel
    excel_file = pd.ExcelFile(EXCEL_FILE)
    sheet_names = excel_file.sheet_names

    print(f"Hojas encontradas: {sheet_names}")

    # Filtrar hojas que contengan "SEC" u "ORDENES"
    sec_sheets = [name for name in sheet_names if "SEC" in name.upper()]
    ordenes_sheets = [name for name in sheet_names if "ORDEN" in name.upper()]
    virtual_sheets = [name for name in sheet_names if "VIRTUAL" in name.upper()]

    print(f"Hojas SEC encontradas: {sec_sheets}")
    print(f"Hojas ORDENES encontradas: {ordenes_sheets}")

    # Procesar hojas SEC
    for sheet_name in sec_sheets:
        process_sheet(excel_file, sheet_name, "SEC")

    # Procesar hojas ORDENES
    for sheet_name in ordenes_sheets:
        process_sheet(excel_file, sheet_name, "ORDENES")

    for sheet_name in virtual_sheets:
        process_sheet(excel_file, sheet_name, "VIRTUAL")

    print("Proceso completado.")

def process_sheet(excel_file, sheet_name, category):
    print(f"\nProcesando hoja '{sheet_name}' ({category})...")

    df = pd.read_excel(excel_file, sheet_name=sheet_name)

    print(f"  Filas leidas: {len(df)}")
    print(f"  Columnas originales: {len(df.columns)}")

    # Eliminar columnas que empiezan con "Unnamed" o tienen nombres NaN (columnas vacias)
    mask = df.columns.to_series().str.startswith("Unnamed").fillna(True)
    df = df.loc[:, ~mask]

    print(f"  Columnas finales: {len(df.columns)}")

    # Generar nombre de archivo CSV
    # Limpiar el nombre de la hoja para usarlo como nombre de archivo
    safe_sheet_name = sheet_name.replace("/", "-").replace("\\", "-").replace(":", "-")
    output_csv = DATA_DIR / f"informe_lectura_{category}_{safe_sheet_name}.csv"

    # Guardar como CSV
    df.to_csv(output_csv, index=False, encoding="utf-8-sig")
    print(f"  CSV guardado en: {output_csv}")

    return df

if __name__ == "__main__":
    excel_to_csv()
