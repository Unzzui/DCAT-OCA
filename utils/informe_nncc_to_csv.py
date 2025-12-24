import pandas as pd
from pathlib import Path

# Rutas
DATA_DIR = Path(__file__).parent.parent / "data"
EXCEL_FILE = DATA_DIR / "2025-05 INFORME NNCC (2024-2029) DIC 2025.xlsx"
OUTPUT_CSV = DATA_DIR / "2025-05 INFORME NNCC (2024-2029) DIC 2025.csv"

def excel_to_csv():

    print(f"Leyendo archivo: {EXCEL_FILE}")

    df = pd.read_excel(
        EXCEL_FILE,
        sheet_name="BASE ACTUAL"
    )

    print(f"Filas leidas: {len(df)}")
    print(f"Columnas originales: {len(df.columns)}")

    # Eliminar columnas que empiezan con "Unnamed" o tienen nombres NaN (columnas vacías)
    mask = df.columns.to_series().str.startswith("Unnamed").fillna(True)
    df = df.loc[:, ~mask]

    print(f"Columnas finales: {len(df.columns)}")
    print(f"Columnas: {list(df.columns)}")

    # Guardar como CSV
    df.to_csv(OUTPUT_CSV, index=False, encoding="utf-8-sig")
    print(f"CSV guardado en: {OUTPUT_CSV}")

    return df

if __name__ == "__main__":
    excel_to_csv()
