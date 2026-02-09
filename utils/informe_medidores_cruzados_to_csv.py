import pandas as pd
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"
EXCEL_FILE = DATA_DIR / "ENEL Calidad" / "5. Nuevas Conexiones" / "Medidores Cruzados" / "Consolidado Medidores Cruzados NNCC (NUEVO CONTRATO).xlsx"
OUTPUT_CSV = DATA_DIR / "informe_medidores_cruzados.csv"


def excel_to_csv():
    print(f"Leyendo archivo: {EXCEL_FILE}")

    df = pd.read_excel(
        EXCEL_FILE,
        sheet_name="MEDIDORES CRUZADOS"
    )

    print(f"Filas leidas: {len(df)}")
    print(f"Columnas originales: {len(df.columns)}")

    # Eliminar columnas que empiezan con "Unnamed"
    mask = df.columns.to_series().str.startswith("Unnamed").fillna(True)
    df = df.loc[:, ~mask]

    # Limpiar nombres de columnas (quitar espacios extra)
    df.columns = df.columns.str.strip()

    print(f"Columnas finales: {len(df.columns)}")
    print(f"Columnas: {list(df.columns)}")

    # Guardar como CSV
    df.to_csv(OUTPUT_CSV, index=False, encoding="utf-8-sig")
    print(f"CSV guardado en: {OUTPUT_CSV}")
    print(f"Registros: {len(df)}")

    return df


if __name__ == "__main__":
    excel_to_csv()
