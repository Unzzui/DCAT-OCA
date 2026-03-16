"""
Pre-calculate NNCC dashboard metrics and store in nncc_dashboard_stats table.
Run after each data pipeline load.

Usage:
    python scripts/precalculate_nncc.py
    python scripts/precalculate_nncc.py --base "2025-11 EJECUTADOS"
"""

import argparse
import json
import os
import sys
from collections import Counter
from datetime import datetime

import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# ---------------------------------------------------------------------------
# Database connection
# ---------------------------------------------------------------------------

def get_engine():
    # Try loading .env from project root
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    load_dotenv(os.path.join(project_root, ".env"))

    url = os.getenv("DATABASE_URL")
    if not url:
        print("ERROR: DATABASE_URL not set")
        sys.exit(1)
    # Ensure sync driver
    url = url.replace("postgresql+asyncpg://", "postgresql://")
    return create_engine(url)

# ---------------------------------------------------------------------------
# Data normalization
# ---------------------------------------------------------------------------

NORMALIZE_MAP = {
    "cumple_norma_cc": {
        "Cumple Norma CC": "CUMPLE",
        "CUMPLE NORMA CC": "CUMPLE",
        "No Cumple Norma CC": "NO CUMPLE",
        "NO CUMPLE NORMA CC": "NO CUMPLE",
        "S/N": "S/N",
        "NO APLICA": "NO APLICA",
    },
    "cliente_conforme": {
        "Cliente conforme": "CONFORME",
        "CLIENTE CONFORME": "CONFORME",
        "Cliente disconforme": "DISCONFORME",
        "CLIENTE DISCONFORME": "DISCONFORME",
        "S/N": "S/N",
        "NO APLICA": "NO APLICA",
    },
    "estado_empalme": {
        "Bueno": "BUENO",
        "BUENO": "BUENO",
        "Malo": "MALO",
        "MALO": "MALO",
        "S/N": "S/N",
    },
    "multa": {
        "SI": "SI",
        "S": "SI",
        "NO": "NO",
    },
    "resultado_inspeccion": {
        "TRABAJO BIEN EJECUTADO": "TRABAJO BIEN EJECUTADO",
        "BIEN EJECUTADO": "TRABAJO BIEN EJECUTADO",
        "TRABAJO MAL EJECUTADO": "TRABAJO MAL EJECUTADO",
        "TRABAJO NO EJECUTADO": "TRABAJO NO EJECUTADO",
        "OTROS": "OTROS",
    },
    "estado_efectividad": {
        "EFECTIVA": "EFECTIVA",
        "NO EFECTIVA": "NO EFECTIVA",
    },
    "resultado_normalizacion": {
        "TRABAJO BIEN EJECUTADO": "TRABAJO BIEN EJECUTADO",
        "PENDIENTE DE NORMALIZAR": "PENDIENTE DE NORMALIZAR",
        "NO APLICA": "NO APLICA",
    },
}


def normalize_df(df: pd.DataFrame) -> pd.DataFrame:
    """Apply normalization mappings to clean up inconsistent casing."""
    for col, mapping in NORMALIZE_MAP.items():
        if col in df.columns:
            df[col] = df[col].map(mapping).fillna(df[col])
    return df

# ---------------------------------------------------------------------------
# Contratista normalization
# ---------------------------------------------------------------------------

CONTRATISTA_NORMALIZE = {
    "UTE INSPECCION INM": "UTE",
    "UTE INSPECCION COM": "UTE",
    "LARI INSPECCION INM": "LARI",
    "LARI INSPECCION COM": "LARI",
    "PROVIDER INSPECCION": "PROVIDER",
    "DOMINIOM INSPECCION": "DOMINIOM",
}


def normalize_contratista(df: pd.DataFrame) -> pd.DataFrame:
    """Consolidate contractor variants into base names."""
    if "contratista_enel" in df.columns:
        df["contratista_enel"] = df["contratista_enel"].replace(CONTRATISTA_NORMALIZE)
    return df

# ---------------------------------------------------------------------------
# Metric calculations
# ---------------------------------------------------------------------------


def _get_inspected(df: pd.DataFrame) -> pd.DataFrame:
    """Return inspected rows: estado_efectividad not null/empty means inspected."""
    return df[df["estado_efectividad"].notna() & (df["estado_efectividad"].str.strip() != "")]


def calc_overview_kpis(df: pd.DataFrame) -> dict:
    total_asignadas = len(df)
    inspeccionadas = _get_inspected(df)
    total_inspeccionadas = len(inspeccionadas)
    # All counts must be from inspeccionadas (not full df) to avoid numerator > denominator
    efectivas = int((inspeccionadas["estado_efectividad"] == "EFECTIVA").sum())
    no_efectivas = int((inspeccionadas["estado_efectividad"] == "NO EFECTIVA").sum())
    mal_ejecutado = int((inspeccionadas["resultado_inspeccion"] == "TRABAJO MAL EJECUTADO").sum())
    multas_si = int((inspeccionadas["multa"] == "SI").sum())
    pendiente_norm = int((inspeccionadas["resultado_normalizacion"] == "PENDIENTE DE NORMALIZAR").sum())

    # Hallazgos de medidor en inspecciones (from categoria_mal_ejecutado)
    cat_col = inspeccionadas["categoria_mal_ejecutado"].fillna("")
    medidores_cruzados = int(cat_col.str.contains("CRUZADO", case=False).sum())
    distinto_medidor = int(cat_col.str.contains("DISTINTO_MEDIDOR", case=False).sum())

    # Cliente conforme (sobre efectivas)
    cc_col = inspeccionadas["cliente_conforme"].fillna("").str.upper().str.strip()
    conforme = int(cc_col.str.contains("CONFORME").sum() - cc_col.str.contains("DISCONFORME").sum())
    disconforme = int(cc_col.str.contains("DISCONFORME").sum())

    # Cumple norma codigo de colores (sobre efectivas)
    nc_col = inspeccionadas["cumple_norma_cc"].fillna("").str.upper().str.strip()
    cumple_cc = int(nc_col.str.contains("CUMPLE").sum() - nc_col.str.contains("NO CUMPLE").sum())
    no_cumple_cc = int(nc_col.str.contains("NO CUMPLE").sum())

    return {
        "total_asignadas": int(total_asignadas),
        "total_inspecciones": int(total_inspeccionadas),
        "total_efectivas": int(efectivas),
        "pct_mal_ejecutado": round(mal_ejecutado / efectivas * 100, 2) if efectivas > 0 else 0,
        "num_mal_ejecutado": mal_ejecutado,
        "num_multas_si": multas_si,
        "pct_no_efectiva": round(no_efectivas / total_inspeccionadas * 100, 2) if total_inspeccionadas > 0 else 0,
        "pct_avance": round(total_inspeccionadas / total_asignadas * 100, 2) if total_asignadas > 0 else 0,
        "tasa_efectividad_oca": round(efectivas / total_inspeccionadas * 100, 2) if total_inspeccionadas > 0 else 0,
        "tasa_cierre_normalizacion": round((mal_ejecutado - pendiente_norm) / mal_ejecutado * 100, 2) if mal_ejecutado > 0 else 100,
        # New metrics
        "num_pendientes_normalizar": pendiente_norm,
        "num_medidores_cruzados": medidores_cruzados,
        "num_distinto_medidor": distinto_medidor,
        "pct_cliente_conforme": round(conforme / efectivas * 100, 2) if efectivas > 0 else 0,
        "num_cliente_disconforme": disconforme,
        "pct_cumple_norma_cc": round(cumple_cc / efectivas * 100, 2) if efectivas > 0 else 0,
        "num_no_cumple_norma_cc": no_cumple_cc,
    }


def calc_tendencia_temporal(df: pd.DataFrame) -> list:
    """Weekly and monthly time series of key metrics."""
    results = []
    df_dated = df.dropna(subset=["fecha_inspeccion"]).copy()
    df_dated["fecha_inspeccion"] = pd.to_datetime(df_dated["fecha_inspeccion"])

    # Weekly
    iso = df_dated["fecha_inspeccion"].dt.isocalendar()
    df_dated["semana"] = iso["year"].astype(str) + "-W" + iso["week"].astype(str).str.zfill(2)
    for semana, grp in df_dated.groupby("semana"):
        efectivas = int((grp["estado_efectividad"] == "EFECTIVA").sum())
        mal = int((grp["resultado_inspeccion"] == "TRABAJO MAL EJECUTADO").sum())
        multas = int((grp["multa"] == "SI").sum())
        results.append({
            "periodo": semana,
            "total": int(len(grp)),
            "mal_ejecutado": mal,
            "tasa_mal": round(mal / efectivas * 100, 2) if efectivas > 0 else 0,
        })

    # Monthly
    df_dated["mes_periodo"] = df_dated["fecha_inspeccion"].dt.to_period("M").astype(str)
    for mes, grp in df_dated.groupby("mes_periodo"):
        efectivas = int((grp["estado_efectividad"] == "EFECTIVA").sum())
        mal = int((grp["resultado_inspeccion"] == "TRABAJO MAL EJECUTADO").sum())
        multas = int((grp["multa"] == "SI").sum())
        results.append({
            "periodo": mes,
            "total": int(len(grp)),
            "mal_ejecutado": mal,
            "tasa_mal": round(mal / efectivas * 100, 2) if efectivas > 0 else 0,
        })

    return sorted(results, key=lambda x: x["periodo"])


def calc_resultado_por_zona(df: pd.DataFrame) -> list:
    results = []
    for zona, grp in df.groupby("zona"):
        inspected = grp[grp["estado_efectividad"].notna() & (grp["estado_efectividad"].str.strip() != "")]
        efectivas = int((inspected["estado_efectividad"] == "EFECTIVA").sum())
        bien = int((inspected["resultado_inspeccion"] == "TRABAJO BIEN EJECUTADO").sum())
        mal = int((inspected["resultado_inspeccion"] == "TRABAJO MAL EJECUTADO").sum())
        no_efec = int((inspected["estado_efectividad"] == "NO EFECTIVA").sum())
        results.append({
            "zona": str(zona),
            "bien": bien,
            "mal": mal,
            "pendiente": no_efec,
            "efectivas": efectivas,
            "total": int(len(grp)),
            "total_inspecciones": int(len(inspected)),
        })
    return sorted(results, key=lambda x: x["total"], reverse=True)


def calc_top_comunas(df: pd.DataFrame, top_n: int = 5) -> list:
    results = []
    for comuna, grp in df.groupby("comuna"):
        efectivas = int((grp["estado_efectividad"] == "EFECTIVA").sum())
        mal = int((grp["resultado_inspeccion"] == "TRABAJO MAL EJECUTADO").sum())
        multas = int((grp["multa"] == "SI").sum())
        if efectivas > 0:
            results.append({
                "comuna": str(comuna),
                "tasa_mal": round(mal / efectivas * 100, 2),
                "total": int(len(grp)),
                "mal_ejecutado": mal,
            })
    return sorted(results, key=lambda x: x["tasa_mal"], reverse=True)[:top_n]


def calc_ranking_contratistas(df: pd.DataFrame) -> list:
    df_con = df.dropna(subset=["contratista_enel"])
    if df_con.empty:
        return []
    results = []
    for contratista, grp in df_con.groupby("contratista_enel"):
        efectivas = int((grp["estado_efectividad"] == "EFECTIVA").sum())
        mal = int((grp["resultado_inspeccion"] == "TRABAJO MAL EJECUTADO").sum())
        multas = int((grp["multa"] == "SI").sum())
        pendiente = int((grp["resultado_normalizacion"] == "PENDIENTE DE NORMALIZAR").sum())
        total = int(len(grp))
        results.append({
            "contratista": str(contratista),
            "inspecciones": total,
            "efectivas": efectivas,
            "mal_ejecutado": mal,
            "tasa_mal": round(mal / efectivas * 100, 2) if efectivas > 0 else 0,
            "multas": multas,
            "tasa_multas": round(multas / total * 100, 2) if total > 0 else 0,
            "pend_norm": pendiente,
            "tasa_cierre": round((total - pendiente) / total * 100, 2) if total > 0 else 0,
        })
    return sorted(results, key=lambda x: x["inspecciones"], reverse=True)


def calc_scatter_contratistas(df: pd.DataFrame) -> list:
    ranking = calc_ranking_contratistas(df)
    return [
        {
            "contratista": r["contratista"],
            "volumen": r["inspecciones"],
            "tasa_mal": r["tasa_mal"],
            "multas": r["multas"],
        }
        for r in ranking
    ]


def calc_pareto_causas(df: pd.DataFrame) -> list:
    # Split multi-category entries (e.g. "A | B" -> ["A", "B"])
    causas = df["categoria_mal_ejecutado"].dropna()
    all_causas = []
    for c in causas:
        for part in str(c).split("|"):
            part = part.strip()
            if part and part not in ("None", "nan"):
                all_causas.append(part)

    counts = Counter(all_causas)
    total = sum(counts.values())
    sorted_causas = counts.most_common()

    results = []
    acumulado = 0.0
    for causa, count in sorted_causas:
        pct = round(count / total * 100, 1) if total > 0 else 0
        acumulado += pct
        results.append({
            "causa": causa,
            "cantidad": count,
            "acumulado_pct": round(acumulado, 1),
        })

    return results


def calc_desgloses_zona(df: pd.DataFrame) -> list:
    results = []
    for zona, grp_zona in df.groupby("zona"):
        comunas = []
        for comuna, grp_com in grp_zona.groupby("comuna"):
            efectivas = int((grp_com["estado_efectividad"] == "EFECTIVA").sum())
            mal = int((grp_com["resultado_inspeccion"] == "TRABAJO MAL EJECUTADO").sum())
            comunas.append({
                "comuna": str(comuna),
                "total": int(len(grp_com)),
                "mal_ejecutado": mal,
                "tasa": round(mal / efectivas * 100, 2) if efectivas > 0 else 0,
            })

        contratistas = []
        grp_con = grp_zona.dropna(subset=["contratista_enel"])
        for contratista, grp_c in grp_con.groupby("contratista_enel"):
            efectivas = int((grp_c["estado_efectividad"] == "EFECTIVA").sum())
            mal = int((grp_c["resultado_inspeccion"] == "TRABAJO MAL EJECUTADO").sum())
            contratistas.append({
                "contratista": str(contratista),
                "total": int(len(grp_c)),
                "mal_ejecutado": mal,
                "tasa": round(mal / efectivas * 100, 2) if efectivas > 0 else 0,
            })

        results.append({
            "zona": str(zona),
            "total": int(len(grp_zona)),
            "comunas": sorted(comunas, key=lambda x: x["total"], reverse=True),
            "contratistas": sorted(contratistas, key=lambda x: x["total"], reverse=True),
        })
    return sorted(results, key=lambda x: x["total"], reverse=True)


def calc_trabajos_tipicamente_mal(df: pd.DataFrame) -> list:
    results = []
    for tipo, grp in df.groupby("tipo_inspeccion"):
        efectivas = int((grp["estado_efectividad"] == "EFECTIVA").sum())
        mal = int((grp["resultado_inspeccion"] == "TRABAJO MAL EJECUTADO").sum())
        # Get top causes for this type
        causas_raw = grp["categoria_mal_ejecutado"].dropna()
        all_causas = []
        for c in causas_raw:
            for part in str(c).split("|"):
                part = part.strip()
                if part and part not in ("None", "nan"):
                    all_causas.append(part)
        top = [c for c, _ in Counter(all_causas).most_common(3)]
        results.append({
            "tipo_trabajo": str(tipo),
            "total": int(len(grp)),
            "efectivas": efectivas,
            "mal_ejecutado": mal,
            "tasa_mal": round(mal / efectivas * 100, 2) if efectivas > 0 else 0,
            "top_causas": top,
        })
    return sorted(results, key=lambda x: x["mal_ejecutado"], reverse=True)

def calc_mapa_puntos(df: pd.DataFrame) -> list:
    if "latitud" not in df.columns or "longitud" not in df.columns:
        return []
    geo = df.dropna(subset=["latitud", "longitud"])
    if geo.empty:
        return []

    def _str(row, col):
        v = row.get(col)
        return str(v) if pd.notna(v) else ""

    points = []
    for _, row in geo.iterrows():
        p = {
            "lat": float(row["latitud"]),
            "lng": float(row["longitud"]),
            "resultado": _str(row, "resultado_inspeccion"),
            "zona": _str(row, "zona"),
            "comuna": _str(row, "comuna"),
            "contratista": _str(row, "contratista_enel"),
            "vta": _str(row, "vta"),
            "cliente": _str(row, "cliente"),
            "nombre_cliente": _str(row, "nombre_cliente"),
            "inspector": _str(row, "inspector"),
            "tipo_trabajo": _str(row, "tipo_inspeccion"),
            "multa": _str(row, "multa"),
            "causa": _str(row, "categoria_mal_ejecutado"),
            # Additional inspection detail fields
            "direccion": _str(row, "direccion"),
            "n_medidor": _str(row, "n_medidor"),
            "estado_efectividad": _str(row, "estado_efectividad"),
            "observaciones_multa": _str(row, "observaciones_multa"),
            "estado_empalme": _str(row, "estado_empalme"),
            "cumple_norma_cc": _str(row, "cumple_norma_cc"),
            "cliente_conforme": _str(row, "cliente_conforme"),
            "resultado_normalizacion": _str(row, "resultado_normalizacion"),
            "estado_contratista": _str(row, "estado_contratista"),
        }
        fecha = row.get("fecha_inspeccion")
        p["fecha"] = str(fecha)[:10] if pd.notna(fecha) else ""
        link = row.get("link_formulario")
        p["link_formulario"] = str(link) if pd.notna(link) else ""
        points.append(p)
    return points


def calc_mal_ejecutados_analysis(df: pd.DataFrame) -> dict:
    """Detailed analysis of mal ejecutado records and their causes."""
    mal_df = df[df["resultado_inspeccion"] == "TRABAJO MAL EJECUTADO"].copy()
    if mal_df.empty:
        return {
            "total_mal": 0,
            "causas_individuales": [],
            "causas_por_zona": [],
            "causas_por_contratista": [],
            "mal_por_mes": [],
        }

    # Split pipe-separated categories into individual causes
    all_causas = []
    for c in mal_df["categoria_mal_ejecutado"].dropna():
        for part in str(c).split("|"):
            part = part.strip()
            if part and part not in ("None", "nan"):
                all_causas.append(part)

    # Individual cause counts
    causa_counts = Counter(all_causas)
    total_causas = sum(causa_counts.values())
    causas_individuales = []
    acum = 0.0
    for causa, count in causa_counts.most_common():
        pct = round(count / total_causas * 100, 1) if total_causas > 0 else 0
        acum += pct
        causas_individuales.append({
            "causa": causa,
            "cantidad": count,
            "pct": pct,
            "acumulado_pct": round(acum, 1),
        })

    # Causes by zona
    causas_por_zona = []
    for zona, grp in mal_df.groupby("zona"):
        zona_causas = []
        for c in grp["categoria_mal_ejecutado"].dropna():
            for part in str(c).split("|"):
                part = part.strip()
                if part and part not in ("None", "nan"):
                    zona_causas.append(part)
        zona_counts = Counter(zona_causas)
        top_causas = [{"causa": c, "cantidad": n} for c, n in zona_counts.most_common(5)]
        causas_por_zona.append({
            "zona": str(zona),
            "total_mal": int(len(grp)),
            "causas": top_causas,
        })
    causas_por_zona.sort(key=lambda x: x["total_mal"], reverse=True)

    # Causes by contratista (normalized)
    causas_por_contratista = []
    mal_con = mal_df.dropna(subset=["contratista_enel"])
    for contratista, grp in mal_con.groupby("contratista_enel"):
        con_causas = []
        for c in grp["categoria_mal_ejecutado"].dropna():
            for part in str(c).split("|"):
                part = part.strip()
                if part and part not in ("None", "nan"):
                    con_causas.append(part)
        con_counts = Counter(con_causas)
        top_causas = [{"causa": c, "cantidad": n} for c, n in con_counts.most_common(5)]
        causas_por_contratista.append({
            "contratista": str(contratista),
            "total_mal": int(len(grp)),
            "causas": top_causas,
        })
    causas_por_contratista.sort(key=lambda x: x["total_mal"], reverse=True)

    # Mal ejecutado by month
    mal_por_mes = []
    mal_dated = mal_df.dropna(subset=["fecha_inspeccion"]).copy()
    if not mal_dated.empty:
        mal_dated["fecha_inspeccion"] = pd.to_datetime(mal_dated["fecha_inspeccion"], errors="coerce")
        mal_dated = mal_dated.dropna(subset=["fecha_inspeccion"])
        mal_dated["mes_periodo"] = mal_dated["fecha_inspeccion"].dt.to_period("M").astype(str)
        for mes, grp in mal_dated.groupby("mes_periodo"):
            mes_causas = []
            for c in grp["categoria_mal_ejecutado"].dropna():
                for part in str(c).split("|"):
                    part = part.strip()
                    if part and part not in ("None", "nan"):
                        mes_causas.append(part)
            top = [{"causa": c, "cantidad": n} for c, n in Counter(mes_causas).most_common(3)]
            mal_por_mes.append({
                "periodo": str(mes),
                "total_mal": int(len(grp)),
                "top_causas": top,
            })
        mal_por_mes.sort(key=lambda x: x["periodo"])

    return {
        "total_mal": int(len(mal_df)),
        "causas_individuales": causas_individuales,
        "causas_por_zona": causas_por_zona,
        "causas_por_contratista": causas_por_contratista,
        "mal_por_mes": mal_por_mes,
    }


def calc_ranking_inspectores(df: pd.DataFrame) -> list:
    """Ranking of inspectors by volume and effectiveness."""
    insp = _get_inspected(df)
    if insp.empty or "inspector" not in insp.columns:
        return []
    insp_valid = insp.dropna(subset=["inspector"])
    insp_valid = insp_valid[insp_valid["inspector"].str.strip() != ""]
    if insp_valid.empty:
        return []
    results = []
    for inspector, grp in insp_valid.groupby("inspector"):
        total = int(len(grp))
        efectivas = int((grp["estado_efectividad"] == "EFECTIVA").sum())
        mal = int((grp["resultado_inspeccion"] == "TRABAJO MAL EJECUTADO").sum())
        multas = int((grp["multa"] == "SI").sum())
        zonas_list = sorted(grp["zona"].dropna().unique().tolist())
        results.append({
            "inspector": str(inspector),
            "inspecciones": total,
            "efectivas": efectivas,
            "tasa_efectividad": round(efectivas / total * 100, 2) if total > 0 else 0,
            "mal_ejecutado": mal,
            "tasa_mal": round(mal / efectivas * 100, 2) if efectivas > 0 else 0,
            "multas": multas,
            "zonas": zonas_list,
        })
    return sorted(results, key=lambda x: x["inspecciones"], reverse=True)


def calc_efectividad_por_zona(df: pd.DataFrame) -> list:
    """Effectiveness rate per zona (inspected records only)."""
    insp = _get_inspected(df)
    if insp.empty:
        return []
    results = []
    for zona, grp in insp.groupby("zona"):
        total = int(len(grp))
        efectivas = int((grp["estado_efectividad"] == "EFECTIVA").sum())
        results.append({
            "zona": str(zona),
            "total": total,
            "efectivas": efectivas,
            "tasa_efectividad": round(efectivas / total * 100, 2) if total > 0 else 0,
        })
    return sorted(results, key=lambda x: x["tasa_efectividad"])


def calc_tendencia_efectividad(df: pd.DataFrame) -> list:
    """Monthly effectiveness trend (inspected records with valid dates)."""
    insp = _get_inspected(df)
    if insp.empty:
        return []
    dated = insp.dropna(subset=["fecha_inspeccion"]).copy()
    if dated.empty:
        return []
    dated["fecha_inspeccion"] = pd.to_datetime(dated["fecha_inspeccion"], errors="coerce")
    dated = dated.dropna(subset=["fecha_inspeccion"])
    dated["mes_periodo"] = dated["fecha_inspeccion"].dt.to_period("M").astype(str)
    results = []
    for mes, grp in dated.groupby("mes_periodo"):
        total = int(len(grp))
        efectivas = int((grp["estado_efectividad"] == "EFECTIVA").sum())
        results.append({
            "periodo": str(mes),
            "total": total,
            "efectivas": efectivas,
            "tasa_efectividad": round(efectivas / total * 100, 2) if total > 0 else 0,
        })
    return sorted(results, key=lambda x: x["periodo"])


def calc_kpi_modals(df: pd.DataFrame) -> dict:
    zona_breakdown = []
    for zona, grp in df.groupby("zona"):
        zona_breakdown.append({"zona": str(zona), "total": int(len(grp))})
    zona_breakdown.sort(key=lambda x: x["total"], reverse=True)

    causas_raw = df["categoria_mal_ejecutado"].dropna()
    all_causas = []
    for c in causas_raw:
        for part in str(c).split("|"):
            part = part.strip()
            if part and part not in ("None", "nan"):
                all_causas.append(part)
    top_causas = [{"causa": c, "cantidad": n} for c, n in Counter(all_causas).most_common(5)]

    top_multas_contratistas = []
    df_con = df.dropna(subset=["contratista_enel"])
    for contratista, grp in df_con.groupby("contratista_enel"):
        multas = int((grp["multa"] == "SI").sum())
        if multas > 0:
            top_multas_contratistas.append({"contratista": str(contratista), "multas": multas})
    top_multas_contratistas.sort(key=lambda x: x["multas"], reverse=True)
    top_multas_contratistas = top_multas_contratistas[:5]

    no_efectiva_zona = []
    for zona, grp in df.groupby("zona"):
        no_ef = int((grp["estado_efectividad"] == "NO EFECTIVA").sum())
        total = int(len(grp))
        no_efectiva_zona.append({
            "zona": str(zona),
            "no_efectiva": no_ef,
            "total": total,
            "pct": round(no_ef / total * 100, 1) if total > 0 else 0,
        })
    no_efectiva_zona.sort(key=lambda x: x["pct"], reverse=True)

    return {
        "zona_breakdown": zona_breakdown,
        "top_causas": top_causas,
        "top_multas_contratistas": top_multas_contratistas,
        "no_efectiva_zona": no_efectiva_zona,
    }


def calc_no_efectivos_analysis(df: pd.DataFrame) -> dict:
    """Analysis of non-effective inspections by category."""
    insp = _get_inspected(df)
    no_ef = insp[insp["estado_efectividad"] == "NO EFECTIVA"].copy()

    total_no_efectivas = len(no_ef)
    if total_no_efectivas == 0:
        return {
            "total_no_efectivas": 0,
            "categorias": [],
            "por_zona": [],
            "por_contratista": [],
        }

    # Category breakdown
    categorias = []
    if "categoria_no_efectivo" in no_ef.columns:
        cat_counts = no_ef["categoria_no_efectivo"].fillna("OTRO").value_counts()
        acum = 0.0
        for cat, count in cat_counts.items():
            pct = round(count / total_no_efectivas * 100, 1)
            acum += pct
            categorias.append({
                "categoria": str(cat),
                "cantidad": int(count),
                "pct": pct,
                "acumulado_pct": round(acum, 1),
            })

    # By zona
    por_zona = []
    if "categoria_no_efectivo" in no_ef.columns:
        for zona, grp in no_ef.groupby("zona"):
            zona_cats = grp["categoria_no_efectivo"].fillna("OTRO").value_counts()
            top_cats = [{"categoria": str(c), "cantidad": int(n)} for c, n in zona_cats.head(5).items()]
            por_zona.append({
                "zona": str(zona),
                "total_no_efectivas": int(len(grp)),
                "categorias": top_cats,
            })
        por_zona.sort(key=lambda x: x["total_no_efectivas"], reverse=True)

    # By contratista
    por_contratista = []
    if "categoria_no_efectivo" in no_ef.columns:
        no_ef_con = no_ef.dropna(subset=["contratista_enel"])
        for contratista, grp in no_ef_con.groupby("contratista_enel"):
            con_cats = grp["categoria_no_efectivo"].fillna("OTRO").value_counts()
            top_cats = [{"categoria": str(c), "cantidad": int(n)} for c, n in con_cats.head(5).items()]
            por_contratista.append({
                "contratista": str(contratista),
                "total_no_efectivas": int(len(grp)),
                "categorias": top_cats,
            })
        por_contratista.sort(key=lambda x: x["total_no_efectivas"], reverse=True)

    return {
        "total_no_efectivas": int(total_no_efectivas),
        "categorias": categorias,
        "por_zona": por_zona,
        "por_contratista": por_contratista,
    }


# ---------------------------------------------------------------------------
# Main execution
# ---------------------------------------------------------------------------

def run(base_filter: str = None):
    engine = get_engine()
    print(f"[{datetime.now().isoformat()}] Loading data from nncc table...")

    query = "SELECT * FROM nncc"
    if base_filter:
        query += " WHERE base = :base_filter"
    else:
        query += " WHERE base LIKE '%EJECUTADOS'"

    with engine.connect() as conn:
        if base_filter:
            df = pd.read_sql(text(query), conn, params={"base_filter": base_filter})
        else:
            df = pd.read_sql(text(query), conn)

    print(f"  Loaded {len(df)} rows")

    if df.empty:
        print("  No data found. Skipping.")
        return

    # Normalize
    df = normalize_df(df)
    df = normalize_contratista(df)
    print("  Data normalized (including contratista consolidation)")

    # Calculate all metrics
    print("  Calculating metrics...")
    stats = {
        "overview_kpis": calc_overview_kpis(df),
        "tendencia_temporal": calc_tendencia_temporal(df),
        "resultado_por_zona": calc_resultado_por_zona(df),
        "top_comunas_problemas": calc_top_comunas(df),
        "ranking_contratistas": calc_ranking_contratistas(df),
        "scatter_contratistas": calc_scatter_contratistas(df),
        "pareto_causas": calc_pareto_causas(df),
        "desgloses_zona": calc_desgloses_zona(df),
        "trabajos_tipicamente_mal": calc_trabajos_tipicamente_mal(df),
        "mapa_puntos": calc_mapa_puntos(df),
        "kpi_modals": calc_kpi_modals(df),
        "mal_ejecutados_analysis": calc_mal_ejecutados_analysis(df),
        "ranking_inspectores": calc_ranking_inspectores(df),
        "efectividad_por_zona": calc_efectividad_por_zona(df),
        "tendencia_efectividad": calc_tendencia_efectividad(df),
        "no_efectivos_analysis": calc_no_efectivos_analysis(df),
    }

    # Store in DB
    base_label = base_filter or "__all__"
    with engine.begin() as conn:
        # Clear existing stats for this base
        conn.execute(text(
            "DELETE FROM nncc_dashboard_stats WHERE base_periodo = :base"
        ), {"base": base_label})

        for key, data in stats.items():
            conn.execute(text("""
                INSERT INTO nncc_dashboard_stats (stat_key, base_periodo, data, calculated_at)
                VALUES (:key, :base, :data, NOW())
            """), {"key": key, "base": base_label, "data": json.dumps(data)})

    print(f"  Stored {len(stats)} stat keys for base '{base_label}'")
    print(f"[{datetime.now().isoformat()}] Done!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Pre-calculate NNCC dashboard metrics")
    parser.add_argument("--base", type=str, default=None, help="Filter by base periodo")
    parser.add_argument("--all-bases", action="store_true", help="Pre-calculate for every base")
    args = parser.parse_args()
    if args.all_bases:
        engine = get_engine()
        with engine.connect() as conn:
            rows = conn.execute(text(
                "SELECT DISTINCT base FROM nncc WHERE base IS NOT NULL AND base LIKE '%EJECUTADOS' ORDER BY base"
            )).fetchall()
        bases = [r[0] for r in rows]
        print(f"Found {len(bases)} bases to pre-calculate: {bases}")
        for b in bases:
            print(f"\n{'='*60}")
            run(base_filter=b)
        # Also run __all__ aggregate
        print(f"\n{'='*60}")
        run(base_filter=None)
    else:
        run(base_filter=args.base)
