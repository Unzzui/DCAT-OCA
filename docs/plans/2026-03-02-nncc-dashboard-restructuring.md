# NNCC Dashboard Restructuring — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the entire NNCC dashboard with a 3-page executive quality control dashboard (eCharts + pre-calculated metrics) for ENEL accountability reporting.

**Architecture:** Python pre-calculation script computes all metrics from the `nncc` table and stores them as JSONB in a new `nncc_dashboard_stats` PostgreSQL table. Backend serves these pre-calculated stats via 3 new endpoints. Frontend replaces 5 existing tabs with 3 new ones using Apache eCharts for visualizations and Tremor for UI components.

**Tech Stack:** FastAPI + SQLAlchemy (async) | Next.js 14 + TypeScript | Apache eCharts (echarts-for-react) | PostgreSQL (Supabase) | Tremor React for UI | Tailwind CSS

**Design Doc:** `docs/plans/2026-03-02-nncc-dashboard-restructuring-design.md`

---

## Task 1: Install eCharts frontend dependency

**Files:**
- Modify: `frontend/package.json`

**Step 1: Install echarts and echarts-for-react**

```bash
cd frontend && npm install echarts echarts-for-react
```

**Step 2: Verify installation**

```bash
cd frontend && node -e "require('echarts'); require('echarts-for-react'); console.log('OK')"
```
Expected: `OK`

**Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: add echarts and echarts-for-react dependencies"
```

---

## Task 2: Create `nncc_dashboard_stats` database model

**Files:**
- Modify: `backend/app/db/models.py` (add new model after NNCCModel, around line 65)

**Step 1: Add the NNCCDashboardStats model**

In `backend/app/db/models.py`, after the `NNCCModel` class (line ~65), add:

```python
class NNCCDashboardStats(Base):
    __tablename__ = "nncc_dashboard_stats"

    id = Column(Integer, primary_key=True, autoincrement=True)
    stat_key = Column(String(100), nullable=False)
    base_periodo = Column(String(100), nullable=True)  # NULL = all bases combined
    data = Column(JSON, nullable=False)
    calculated_at = Column(DateTime, default=func.now())

    __table_args__ = (
        Index("idx_nncc_stats_lookup", "stat_key", "base_periodo", unique=True),
    )
```

Note: Import `func` from sqlalchemy at the top if not already imported. The existing imports on line 1-3 are:
```python
from sqlalchemy import Column, Integer, String, DateTime, Float, Text, JSON, Index
from .base import Base
```
Add `func` to the sqlalchemy import:
```python
from sqlalchemy import Column, Integer, String, DateTime, Float, Text, JSON, Index, func
```

**Step 2: Create the table in the database**

```bash
cd backend && python -c "
import asyncio
from app.db.session import init_async_engine, engine
from app.db.base import Base
from app.db.models import NNCCDashboardStats

async def create():
    init_async_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print('Table created')

asyncio.run(create())
"
```
Expected: `Table created`

**Step 3: Commit**

```bash
git add backend/app/db/models.py
git commit -m "feat: add NNCCDashboardStats model for pre-calculated metrics"
```

---

## Task 3: Create the pre-calculation Python script

**Files:**
- Create: `scripts/precalculate_nncc.py`

**Step 1: Write the pre-calculation script**

Create `scripts/precalculate_nncc.py` with the following content. This script:
- Reads from the `nncc` PostgreSQL table
- Normalizes dirty data (inconsistent casing)
- Computes all dashboard metrics
- Stores results in `nncc_dashboard_stats` as JSONB

```python
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
from datetime import datetime

import pandas as pd
from sqlalchemy import create_engine, text

# ---------------------------------------------------------------------------
# Database connection
# ---------------------------------------------------------------------------

def get_engine():
    url = os.getenv("DATABASE_URL")
    if not url:
        from dotenv import load_dotenv
        load_dotenv(os.path.join(os.path.dirname(__file__), "..", "backend", ".env"))
        url = os.getenv("DATABASE_URL")
    if not url:
        print("ERROR: DATABASE_URL not set")
        sys.exit(1)
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
# Metric calculations
# ---------------------------------------------------------------------------

def calc_overview_kpis(df: pd.DataFrame) -> dict:
    total = len(df)
    efectivas = (df["estado_efectividad"] == "EFECTIVA").sum()
    no_efectivas = (df["estado_efectividad"] == "NO EFECTIVA").sum()
    mal_ejecutado = (df["resultado_inspeccion"] == "TRABAJO MAL EJECUTADO").sum()
    multas_si = (df["multa"] == "SI").sum()
    pendiente_norm = (df["resultado_normalizacion"] == "PENDIENTE DE NORMALIZAR").sum()

    return {
        "total_inspecciones": int(total),
        "inspecciones_efectivas": int(efectivas),
        "inspecciones_no_efectivas": int(no_efectivas),
        "mal_ejecutado_count": int(mal_ejecutado),
        "mal_ejecutado_tasa": round(mal_ejecutado / efectivas * 100, 2) if efectivas > 0 else 0,
        "multas_si_count": int(multas_si),
        "multas_por_100": round(multas_si * 100 / total, 2) if total > 0 else 0,
        "no_efectiva_tasa": round(no_efectivas / total * 100, 2) if total > 0 else 0,
        "backlog_normalizacion": int(pendiente_norm),
        "backlog_tasa": round(pendiente_norm / total * 100, 2) if total > 0 else 0,
        "tasa_efectividad_oca": round(efectivas / total * 100, 2) if total > 0 else 0,
        "tasa_cierre_normalizacion": round((total - pendiente_norm) / total * 100, 2) if total > 0 else 0,
    }


def calc_tendencia_temporal(df: pd.DataFrame) -> list:
    """Weekly and monthly time series of key metrics."""
    results = []
    df_dated = df.dropna(subset=["fecha_inspeccion"]).copy()
    df_dated["fecha_inspeccion"] = pd.to_datetime(df_dated["fecha_inspeccion"])

    # Weekly
    df_dated["semana"] = df_dated["fecha_inspeccion"].dt.isocalendar().apply(
        lambda r: f"{r.year}-W{r.week:02d}", axis=1
    )
    for semana, grp in df_dated.groupby("semana"):
        efectivas = (grp["estado_efectividad"] == "EFECTIVA").sum()
        mal = (grp["resultado_inspeccion"] == "TRABAJO MAL EJECUTADO").sum()
        multas = (grp["multa"] == "SI").sum()
        results.append({
            "periodo": semana,
            "tipo": "semanal",
            "total": int(len(grp)),
            "efectivas": int(efectivas),
            "mal_ejecutado": int(mal),
            "mal_ejecutado_tasa": round(mal / efectivas * 100, 2) if efectivas > 0 else 0,
            "multas": int(multas),
        })

    # Monthly
    df_dated["mes_periodo"] = df_dated["fecha_inspeccion"].dt.to_period("M").astype(str)
    for mes, grp in df_dated.groupby("mes_periodo"):
        efectivas = (grp["estado_efectividad"] == "EFECTIVA").sum()
        mal = (grp["resultado_inspeccion"] == "TRABAJO MAL EJECUTADO").sum()
        multas = (grp["multa"] == "SI").sum()
        results.append({
            "periodo": mes,
            "tipo": "mensual",
            "total": int(len(grp)),
            "efectivas": int(efectivas),
            "mal_ejecutado": int(mal),
            "mal_ejecutado_tasa": round(mal / efectivas * 100, 2) if efectivas > 0 else 0,
            "multas": int(multas),
        })

    return sorted(results, key=lambda x: x["periodo"])


def calc_resultado_por_zona(df: pd.DataFrame) -> list:
    results = []
    for zona, grp in df.groupby("zona"):
        efectivas = (grp["estado_efectividad"] == "EFECTIVA").sum()
        bien = (grp["resultado_inspeccion"] == "TRABAJO BIEN EJECUTADO").sum()
        mal = (grp["resultado_inspeccion"] == "TRABAJO MAL EJECUTADO").sum()
        no_efec = (grp["estado_efectividad"] == "NO EFECTIVA").sum()
        otros = len(grp) - bien - mal - no_efec
        results.append({
            "zona": zona,
            "bien_ejecutado": int(bien),
            "mal_ejecutado": int(mal),
            "no_efectiva": int(no_efec),
            "otros": int(max(0, otros)),
            "total": int(len(grp)),
            "tasa_mal_ejecutado": round(mal / efectivas * 100, 2) if efectivas > 0 else 0,
        })
    return sorted(results, key=lambda x: x["total"], reverse=True)


def calc_top_comunas(df: pd.DataFrame, top_n: int = 5) -> list:
    results = []
    for comuna, grp in df.groupby("comuna"):
        efectivas = (grp["estado_efectividad"] == "EFECTIVA").sum()
        mal = (grp["resultado_inspeccion"] == "TRABAJO MAL EJECUTADO").sum()
        multas = (grp["multa"] == "SI").sum()
        if efectivas > 0:
            results.append({
                "comuna": comuna,
                "total": int(len(grp)),
                "efectivas": int(efectivas),
                "mal_ejecutado": int(mal),
                "tasa_mal_ejecutado": round(mal / efectivas * 100, 2),
                "multas": int(multas),
            })
    return sorted(results, key=lambda x: x["tasa_mal_ejecutado"], reverse=True)[:top_n]


def calc_ranking_contratistas(df: pd.DataFrame) -> list:
    df_con = df.dropna(subset=["contratista_enel"])
    results = []
    for contratista, grp in df_con.groupby("contratista_enel"):
        efectivas = (grp["estado_efectividad"] == "EFECTIVA").sum()
        mal = (grp["resultado_inspeccion"] == "TRABAJO MAL EJECUTADO").sum()
        multas = (grp["multa"] == "SI").sum()
        pendiente = (grp["resultado_normalizacion"] == "PENDIENTE DE NORMALIZAR").sum()
        results.append({
            "contratista": contratista,
            "inspecciones": int(len(grp)),
            "efectivas": int(efectivas),
            "mal_ejecutado": int(mal),
            "tasa_mal_ejecutado": round(mal / efectivas * 100, 2) if efectivas > 0 else 0,
            "multas": int(multas),
            "tasa_multas": round(multas / len(grp) * 100, 2) if len(grp) > 0 else 0,
            "pendiente_normalizacion": int(pendiente),
            "tasa_cierre": round((len(grp) - pendiente) / len(grp) * 100, 2) if len(grp) > 0 else 0,
        })
    return sorted(results, key=lambda x: x["inspecciones"], reverse=True)


def calc_scatter_contratistas(df: pd.DataFrame) -> list:
    ranking = calc_ranking_contratistas(df)
    return [
        {
            "contratista": r["contratista"],
            "x_volumen": r["inspecciones"],
            "y_tasa_mal": r["tasa_mal_ejecutado"],
            "size_multas": r["multas"],
        }
        for r in ranking
    ]


def calc_pareto_causas(df: pd.DataFrame) -> dict:
    # Split multi-category entries (e.g. "A | B" -> ["A", "B"])
    causas = df["categoria_mal_ejecutado"].dropna()
    all_causas = []
    for c in causas:
        for part in str(c).split("|"):
            part = part.strip()
            if part and part != "None":
                all_causas.append(part)

    from collections import Counter
    counts = Counter(all_causas)
    total = sum(counts.values())
    sorted_causas = counts.most_common()

    categorias = []
    acumulado = 0
    for causa, count in sorted_causas:
        pct = round(count / total * 100, 1) if total > 0 else 0
        acumulado += pct
        categorias.append({
            "causa": causa,
            "count": count,
            "pct": pct,
            "acumulado": round(acumulado, 1),
        })

    # Top keywords from inspector observations
    obs = df["observaciones_multa"].dropna()
    stop_words = {"DE", "LA", "EL", "EN", "SE", "NO", "CON", "Y", "A", "LOS", "LAS",
                  "DEL", "POR", "UN", "UNA", "QUE", "ES", "AL", "SU", "MAS"}
    words = " ".join(obs).upper().split()
    filtered = [w for w in words if len(w) > 2 and w not in stop_words]
    word_counts = Counter(filtered).most_common(15)
    keywords = [{"keyword": w, "count": c} for w, c in word_counts]

    return {"categorias": categorias, "keywords_observaciones": keywords}


def calc_desgloses_zona(df: pd.DataFrame) -> list:
    results = []
    for zona, grp_zona in df.groupby("zona"):
        comunas = []
        for comuna, grp_com in grp_zona.groupby("comuna"):
            efectivas = (grp_com["estado_efectividad"] == "EFECTIVA").sum()
            mal = (grp_com["resultado_inspeccion"] == "TRABAJO MAL EJECUTADO").sum()
            comunas.append({
                "comuna": comuna,
                "total": int(len(grp_com)),
                "mal_ejecutado": int(mal),
                "tasa": round(mal / efectivas * 100, 2) if efectivas > 0 else 0,
            })

        contratistas = []
        grp_con = grp_zona.dropna(subset=["contratista_enel"])
        for contratista, grp_c in grp_con.groupby("contratista_enel"):
            efectivas = (grp_c["estado_efectividad"] == "EFECTIVA").sum()
            mal = (grp_c["resultado_inspeccion"] == "TRABAJO MAL EJECUTADO").sum()
            contratistas.append({
                "contratista": contratista,
                "total": int(len(grp_c)),
                "mal_ejecutado": int(mal),
                "tasa": round(mal / efectivas * 100, 2) if efectivas > 0 else 0,
            })

        results.append({
            "zona": zona,
            "total": int(len(grp_zona)),
            "comunas": sorted(comunas, key=lambda x: x["total"], reverse=True),
            "contratistas": sorted(contratistas, key=lambda x: x["total"], reverse=True),
        })
    return sorted(results, key=lambda x: x["total"], reverse=True)


def calc_trabajos_tipicamente_mal(df: pd.DataFrame) -> list:
    results = []
    for tipo, grp in df.groupby("tipo_inspeccion"):
        efectivas = (grp["estado_efectividad"] == "EFECTIVA").sum()
        mal = (grp["resultado_inspeccion"] == "TRABAJO MAL EJECUTADO").sum()
        # Get top causes for this type
        causas_raw = grp["categoria_mal_ejecutado"].dropna()
        all_causas = []
        for c in causas_raw:
            for part in str(c).split("|"):
                part = part.strip()
                if part and part != "None":
                    all_causas.append(part)
        from collections import Counter
        top = [c for c, _ in Counter(all_causas).most_common(3)]
        results.append({
            "tipo_inspeccion": tipo,
            "total": int(len(grp)),
            "efectivas": int(efectivas),
            "mal_ejecutado": int(mal),
            "tasa_mal_ejecutado": round(mal / efectivas * 100, 2) if efectivas > 0 else 0,
            "top_causas": top,
        })
    return sorted(results, key=lambda x: x["mal_ejecutado"], reverse=True)

# ---------------------------------------------------------------------------
# Main execution
# ---------------------------------------------------------------------------

def run(base_filter: str = None):
    engine = get_engine()
    print(f"[{datetime.now().isoformat()}] Loading data from nncc table...")

    query = "SELECT * FROM nncc"
    if base_filter:
        query += f" WHERE base = '{base_filter}'"

    df = pd.read_sql(query, engine)
    print(f"  Loaded {len(df)} rows")

    # Normalize
    df = normalize_df(df)
    print("  Data normalized")

    # Calculate all metrics
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
    args = parser.parse_args()
    run(base_filter=args.base)
```

**Step 2: Test the script locally**

```bash
cd /home/unzzui/Proyectos/DCAT-OCA && python scripts/precalculate_nncc.py
```
Expected: Output showing rows loaded, data normalized, and stat keys stored.

**Step 3: Test with base filter**

```bash
python scripts/precalculate_nncc.py --base "2025-11 EJECUTADOS"
python scripts/precalculate_nncc.py --base "2025-12 EJECUTADOS"
```
Expected: Each stores stats for the specific base.

**Step 4: Verify data in DB**

```bash
cd backend && python -c "
import asyncio
from app.services.db_queries import execute_query
async def check():
    rows = await execute_query('SELECT stat_key, base_periodo, calculated_at FROM nncc_dashboard_stats ORDER BY stat_key')
    for r in rows:
        print(f'{r[\"stat_key\"]:30s} | {r[\"base_periodo\"]:25s} | {r[\"calculated_at\"]}')
asyncio.run(check())
"
```
Expected: 9 stat_keys per base_periodo (27 total if 3 bases: __all__, 2025-11, 2025-12).

**Step 5: Commit**

```bash
git add scripts/precalculate_nncc.py
git commit -m "feat: add NNCC dashboard pre-calculation script"
```

---

## Task 4: Create backend service for pre-calculated stats

**Files:**
- Create: `backend/app/services/nncc_dashboard_service.py`

**Step 1: Write the dashboard service**

This service reads from `nncc_dashboard_stats` and returns pre-calculated data. It follows the same patterns as `data_service.py` (uses `execute_query` from `db_queries.py`).

```python
"""
Service for reading pre-calculated NNCC dashboard statistics.
All metrics are pre-computed by scripts/precalculate_nncc.py and stored in nncc_dashboard_stats.
"""

from .db_queries import execute_query
from .cache import cached


async def _get_stat(stat_key: str, base_periodo: str = None) -> dict | list:
    """Fetch a single pre-calculated stat by key and optional base filter."""
    base = base_periodo or "__all__"
    rows = await execute_query(
        "SELECT data FROM nncc_dashboard_stats WHERE stat_key = :key AND base_periodo = :base",
        {"key": stat_key, "base": base},
    )
    if not rows:
        return {}
    return rows[0]["data"]


@cached(ttl_seconds=300)
async def get_overview(base: str = None) -> dict:
    """Return Page A data: KPIs + trends + zone results + top comunas."""
    kpis = await _get_stat("overview_kpis", base)
    tendencia = await _get_stat("tendencia_temporal", base)
    zonas = await _get_stat("resultado_por_zona", base)
    top_comunas = await _get_stat("top_comunas_problemas", base)
    return {
        "kpis": kpis,
        "tendencia_temporal": tendencia,
        "resultado_por_zona": zonas,
        "top_comunas_problemas": top_comunas,
    }


@cached(ttl_seconds=300)
async def get_contratistas(base: str = None) -> dict:
    """Return Page B data: ranking + scatter."""
    ranking = await _get_stat("ranking_contratistas", base)
    scatter = await _get_stat("scatter_contratistas", base)
    return {
        "ranking_contratistas": ranking,
        "scatter_contratistas": scatter,
    }


@cached(ttl_seconds=300)
async def get_causas(base: str = None) -> dict:
    """Return Page C supplementary data: pareto + typical failures + zone breakdowns."""
    pareto = await _get_stat("pareto_causas", base)
    trabajos_mal = await _get_stat("trabajos_tipicamente_mal", base)
    desgloses = await _get_stat("desgloses_zona", base)
    return {
        "pareto_causas": pareto,
        "trabajos_tipicamente_mal": trabajos_mal,
        "desgloses_zona": desgloses,
    }


@cached(ttl_seconds=300)
async def get_available_bases() -> list:
    """Return list of base_periodo values that have pre-calculated stats."""
    rows = await execute_query(
        "SELECT DISTINCT base_periodo FROM nncc_dashboard_stats WHERE base_periodo != '__all__' ORDER BY base_periodo"
    )
    return [r["base_periodo"] for r in rows]
```

**Step 2: Commit**

```bash
git add backend/app/services/nncc_dashboard_service.py
git commit -m "feat: add NNCC dashboard service for pre-calculated stats"
```

---

## Task 5: Add new API endpoints for dashboard

**Files:**
- Modify: `backend/app/api/v1/nuevas_conexiones.py` (add 3 new endpoints)

**Step 1: Add dashboard endpoints**

In `backend/app/api/v1/nuevas_conexiones.py`, add the following new endpoints. These go BEFORE the existing paginated data endpoint (before line 15) to avoid route conflicts. Add the import at the top:

```python
from ..services import nncc_dashboard_service
```

Then add these 3 endpoints after the router definition (after line 12):

```python
@router.get("/dashboard/overview")
async def get_dashboard_overview(
    base: str = None,
    current_user=Depends(get_current_user),
):
    """Page A: Executive Quality Overview - KPIs, trends, zone results, top comunas."""
    return await nncc_dashboard_service.get_overview(base)


@router.get("/dashboard/contratistas")
async def get_dashboard_contratistas(
    base: str = None,
    current_user=Depends(get_current_user),
):
    """Page B: Contractor ranking and scatter data."""
    return await nncc_dashboard_service.get_contratistas(base)


@router.get("/dashboard/causas")
async def get_dashboard_causas(
    base: str = None,
    current_user=Depends(get_current_user),
):
    """Page C: Pareto of causes, typical failures, zone breakdowns."""
    return await nncc_dashboard_service.get_causas(base)


@router.get("/dashboard/bases")
async def get_dashboard_bases(
    current_user=Depends(get_current_user),
):
    """List of bases with pre-calculated stats available."""
    return await nncc_dashboard_service.get_available_bases()
```

**Step 2: Verify API starts and endpoints respond**

```bash
cd backend && uvicorn app.main:app --reload &
sleep 3
# Get a token first (use existing test credentials)
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ocaglobal.com","password":"admin123"}' | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Test overview endpoint
curl -s http://localhost:8000/api/v1/nuevas-conexiones/dashboard/overview \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool | head -20

# Test contratistas endpoint
curl -s http://localhost:8000/api/v1/nuevas-conexiones/dashboard/contratistas \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool | head -20

# Test causas endpoint
curl -s http://localhost:8000/api/v1/nuevas-conexiones/dashboard/causas \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool | head -20

kill %1
```
Expected: JSON responses with pre-calculated data.

**Step 3: Commit**

```bash
git add backend/app/api/v1/nuevas_conexiones.py
git commit -m "feat: add NNCC dashboard API endpoints for pre-calculated stats"
```

---

## Task 6: Update the existing data endpoint for Page C (detail table)

**Files:**
- Modify: `backend/app/services/data_service.py` (extend `get_filtered_data` to include contratista_enel and categoria_mal_ejecutado columns)

**Step 1: Add missing columns to the detail query**

In `backend/app/services/data_service.py`, the SELECT in `get_filtered_data()` (around lines 123-129) needs to include `contratista_enel` and `categoria_mal_ejecutado`. Find the SELECT column list and add them.

Current columns list (around line 123):
```python
vta, cliente, nombre_cliente, direccion, comuna, tarifa, zona, base,
n_medidor, estado_efectividad, resultado_inspeccion, multa,
observaciones_multa, TO_CHAR(fecha_inspeccion, 'YYYY-MM-DD') as fecha_inspeccion,
inspector, estado_contratista, resultado_normalizacion, cumple_norma_cc,
cliente_conforme, estado_empalme, tipo_inspeccion, voltaje, mes, anio, link_formulario
```

Add after `link_formulario`:
```
, contratista_enel, categoria_mal_ejecutado
```

Also add a `contratista` filter to `_build_where()` (around line 24-80). Add this condition alongside the existing zone/inspector filters:

```python
if filters.get("contratista"):
    conditions.append("UPPER(contratista_enel) = UPPER(:contratista)")
    params["contratista"] = filters["contratista"]
```

**Step 2: Update the API endpoint to accept contratista filter**

In `backend/app/api/v1/nuevas_conexiones.py`, the main GET endpoint (line ~15) needs a `contratista` query parameter. Add it alongside the existing filter params:

```python
contratista: str = None,
```

And pass it in the filters dict:

```python
"contratista": contratista,
```

**Step 3: Commit**

```bash
git add backend/app/services/data_service.py backend/app/api/v1/nuevas_conexiones.py
git commit -m "feat: add contratista_enel and categoria_mal_ejecutado to detail query"
```

---

## Task 7: Rewrite frontend Page A — Executive Quality Overview

**Files:**
- Modify: `frontend/src/app/dashboard/nuevas-conexiones/page.tsx` (complete rewrite)

**Step 1: Create the eCharts wrapper component**

This is a client-side only component (eCharts needs `window`). Create a shared wrapper:

Create `frontend/src/components/ui/EChart.tsx`:

```tsx
'use client'

import { useRef, useEffect } from 'react'
import * as echarts from 'echarts/core'
import { BarChart, LineChart, ScatterChart, PieChart, GaugeChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DataZoomComponent,
  ToolboxComponent,
  MarkLineComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([
  BarChart, LineChart, ScatterChart, PieChart, GaugeChart,
  TitleComponent, TooltipComponent, GridComponent, LegendComponent,
  DataZoomComponent, ToolboxComponent, MarkLineComponent,
  CanvasRenderer,
])

interface EChartProps {
  option: echarts.EChartsOption
  height?: string
  className?: string
  onEvents?: Record<string, (params: any) => void>
}

export function EChart({ option, height = '350px', className = '', onEvents }: EChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!chartRef.current) return

    const chart = echarts.init(chartRef.current)
    instanceRef.current = chart
    chart.setOption(option)

    if (onEvents) {
      Object.entries(onEvents).forEach(([event, handler]) => {
        chart.on(event, handler)
      })
    }

    const handleResize = () => chart.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.dispose()
    }
  }, [])

  useEffect(() => {
    if (instanceRef.current) {
      instanceRef.current.setOption(option, { notMerge: true })
    }
  }, [option])

  return <div ref={chartRef} style={{ height }} className={className} />
}
```

**Step 2: Commit the EChart component**

```bash
git add frontend/src/components/ui/EChart.tsx
git commit -m "feat: add reusable EChart wrapper component for Apache eCharts"
```

---

## Task 8: Rewrite the NNCC page with 3 tabs

**Files:**
- Modify: `frontend/src/app/dashboard/nuevas-conexiones/page.tsx` (complete rewrite)

This is the largest task. The file goes from ~1,323 lines to a complete rewrite with 3 tabs.

**Step 1: Write the complete new page**

Replace the entire contents of `frontend/src/app/dashboard/nuevas-conexiones/page.tsx` with the new implementation. The page has:

- Global filters bar (Base, Zona, Contratista, Date range)
- Tab A: "Resumen Ejecutivo" — KPI cards + eCharts (tendencia, zonas, top comunas)
- Tab B: "Contratistas" — Ranking table + eCharts (scatter, top by tasa)
- Tab C: "Detalle" — Filterable detail table + eCharts (pareto, trabajos mal)
- Drill-through: clicking charts in A/B applies filters and navigates to tab C

The page fetches from 4 endpoints:
- `/api/v1/nuevas-conexiones/dashboard/overview` (Page A)
- `/api/v1/nuevas-conexiones/dashboard/contratistas` (Page B)
- `/api/v1/nuevas-conexiones/dashboard/causas` (Page C charts)
- `/api/v1/nuevas-conexiones/` (Page C detail table, existing endpoint)

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/Header'
import {
  Card, Title, Text, Flex, Grid,
  Table, TableHead, TableHeaderCell, TableBody, TableRow, TableCell,
  Badge, Select, SelectItem, TextInput,
  Tab, TabGroup, TabList, TabPanel, TabPanels,
} from '@tremor/react'
import {
  Search, TrendingUp, TrendingDown, AlertTriangle,
  ExternalLink, ChevronLeft, ChevronRight, X, BarChart3,
  Users, FileText, Activity,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ExportDropdown } from '@/components/ui/ExportDropdown'
import { EChart } from '@/components/ui/EChart'
import { formatNumber } from '@/lib/utils'
import { api } from '@/lib/api'

// ---------- Types ----------

interface OverviewData {
  kpis: {
    total_inspecciones: number
    inspecciones_efectivas: number
    inspecciones_no_efectivas: number
    mal_ejecutado_count: number
    mal_ejecutado_tasa: number
    multas_si_count: number
    multas_por_100: number
    no_efectiva_tasa: number
    backlog_normalizacion: number
    backlog_tasa: number
    tasa_efectividad_oca: number
    tasa_cierre_normalizacion: number
  }
  tendencia_temporal: Array<{
    periodo: string
    tipo: string
    total: number
    efectivas: number
    mal_ejecutado: number
    mal_ejecutado_tasa: number
    multas: number
  }>
  resultado_por_zona: Array<{
    zona: string
    bien_ejecutado: number
    mal_ejecutado: number
    no_efectiva: number
    otros: number
    total: number
    tasa_mal_ejecutado: number
  }>
  top_comunas_problemas: Array<{
    comuna: string
    total: number
    efectivas: number
    mal_ejecutado: number
    tasa_mal_ejecutado: number
    multas: number
  }>
}

interface ContratistasData {
  ranking_contratistas: Array<{
    contratista: string
    inspecciones: number
    efectivas: number
    mal_ejecutado: number
    tasa_mal_ejecutado: number
    multas: number
    tasa_multas: number
    pendiente_normalizacion: number
    tasa_cierre: number
  }>
  scatter_contratistas: Array<{
    contratista: string
    x_volumen: number
    y_tasa_mal: number
    size_multas: number
  }>
}

interface CausasData {
  pareto_causas: {
    categorias: Array<{
      causa: string
      count: number
      pct: number
      acumulado: number
    }>
    keywords_observaciones: Array<{
      keyword: string
      count: number
    }>
  }
  trabajos_tipicamente_mal: Array<{
    tipo_inspeccion: string
    total: number
    efectivas: number
    mal_ejecutado: number
    tasa_mal_ejecutado: number
    top_causas: string[]
  }>
  desgloses_zona: Array<{
    zona: string
    total: number
    comunas: Array<{ comuna: string; total: number; mal_ejecutado: number; tasa: number }>
    contratistas: Array<{ contratista: string; total: number; mal_ejecutado: number; tasa: number }>
  }>
}

interface DetailRecord {
  vta: string
  cliente: string
  nombre_cliente: string
  direccion: string
  comuna: string
  zona: string
  contratista_enel: string
  resultado_inspeccion: string
  multa: string
  categoria_mal_ejecutado: string
  fecha_inspeccion: string
  inspector: string
  link_formulario: string
  observaciones_multa: string
}

// ---------- KPI Card Component ----------

function KPICard({ title, value, subtitle, trend, trendDirection, color }: {
  title: string
  value: string | number
  subtitle?: string
  trend?: number
  trendDirection?: 'up-good' | 'up-bad' | 'down-good' | 'down-bad'
  color: 'blue' | 'red' | 'green' | 'amber'
}) {
  const colorMap = {
    blue: 'border-blue-500 bg-blue-50',
    red: 'border-red-500 bg-red-50',
    green: 'border-green-500 bg-green-50',
    amber: 'border-amber-500 bg-amber-50',
  }
  const isGood = trendDirection === 'up-good' || trendDirection === 'down-good'

  return (
    <Card className={`border-l-4 ${colorMap[color]}`}>
      <Text className="text-sm text-gray-500">{title}</Text>
      <p className="text-3xl font-bold mt-1">{value}</p>
      {subtitle && <Text className="text-xs text-gray-400 mt-1">{subtitle}</Text>}
      {trend !== undefined && (
        <Flex className="mt-2 gap-1" justifyContent="start" alignItems="center">
          {trend >= 0 ? (
            <TrendingUp className={`w-4 h-4 ${isGood ? 'text-green-600' : 'text-red-600'}`} />
          ) : (
            <TrendingDown className={`w-4 h-4 ${isGood ? 'text-green-600' : 'text-red-600'}`} />
          )}
          <Text className={`text-xs font-medium ${isGood ? 'text-green-600' : 'text-red-600'}`}>
            {trend > 0 ? '+' : ''}{trend}%
          </Text>
          <Text className="text-xs text-gray-400">vs periodo anterior</Text>
        </Flex>
      )}
    </Card>
  )
}

// ---------- Main Page Component ----------

export default function NuevasConexionesPage() {
  // Global state
  const [activeTab, setActiveTab] = useState(0)
  const [selectedBase, setSelectedBase] = useState<string>('')
  const [selectedZona, setSelectedZona] = useState<string>('')
  const [selectedContratista, setSelectedContratista] = useState<string>('')
  const [availableBases, setAvailableBases] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  // Drill-through filters (applied when clicking charts)
  const [drillFilters, setDrillFilters] = useState<Record<string, string>>({})

  // Page A data
  const [overview, setOverview] = useState<OverviewData | null>(null)

  // Page B data
  const [contratistas, setContratistas] = useState<ContratistasData | null>(null)

  // Page C data
  const [causas, setCausas] = useState<CausasData | null>(null)
  const [detailData, setDetailData] = useState<DetailRecord[]>([])
  const [detailTotal, setDetailTotal] = useState(0)
  const [detailPage, setDetailPage] = useState(1)
  const [detailSearch, setDetailSearch] = useState('')
  const DETAIL_LIMIT = 20

  // Zonas list (from overview data)
  const zonas = overview?.resultado_por_zona?.map(z => z.zona) || []
  const contratistasList = contratistas?.ranking_contratistas?.map(c => c.contratista) || []

  // ---------- Data Fetching ----------

  const fetchBases = useCallback(async () => {
    try {
      const bases = await api.get<string[]>('/api/v1/nuevas-conexiones/dashboard/bases')
      setAvailableBases(bases)
    } catch (err) {
      console.error('Error fetching bases:', err)
    }
  }, [])

  const fetchOverview = useCallback(async () => {
    try {
      const params: Record<string, string> = {}
      if (selectedBase) params.base = selectedBase
      const data = await api.get<OverviewData>('/api/v1/nuevas-conexiones/dashboard/overview', params)
      setOverview(data)
    } catch (err) {
      console.error('Error fetching overview:', err)
    }
  }, [selectedBase])

  const fetchContratistas = useCallback(async () => {
    try {
      const params: Record<string, string> = {}
      if (selectedBase) params.base = selectedBase
      const data = await api.get<ContratistasData>('/api/v1/nuevas-conexiones/dashboard/contratistas', params)
      setContratistas(data)
    } catch (err) {
      console.error('Error fetching contratistas:', err)
    }
  }, [selectedBase])

  const fetchCausas = useCallback(async () => {
    try {
      const params: Record<string, string> = {}
      if (selectedBase) params.base = selectedBase
      const data = await api.get<CausasData>('/api/v1/nuevas-conexiones/dashboard/causas', params)
      setCausas(data)
    } catch (err) {
      console.error('Error fetching causas:', err)
    }
  }, [selectedBase])

  const fetchDetail = useCallback(async () => {
    try {
      const params: Record<string, string | number> = {
        page: detailPage,
        limit: DETAIL_LIMIT,
      }
      if (selectedBase) params.base = selectedBase
      if (selectedZona || drillFilters.zona) params.zona = drillFilters.zona || selectedZona
      if (selectedContratista || drillFilters.contratista) params.contratista = drillFilters.contratista || selectedContratista
      if (drillFilters.comuna) params.comuna = drillFilters.comuna
      if (detailSearch) params.search = detailSearch

      const data = await api.get<{ data: DetailRecord[]; total: number }>('/api/v1/nuevas-conexiones/', params)
      setDetailData(data.data)
      setDetailTotal(data.total)
    } catch (err) {
      console.error('Error fetching detail:', err)
    }
  }, [detailPage, selectedBase, selectedZona, selectedContratista, drillFilters, detailSearch])

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await fetchBases()
      await Promise.all([fetchOverview(), fetchContratistas(), fetchCausas(), fetchDetail()])
      setLoading(false)
    }
    init()
  }, [])

  // Refetch when filters change
  useEffect(() => {
    if (!loading) {
      Promise.all([fetchOverview(), fetchContratistas(), fetchCausas()])
    }
  }, [selectedBase])

  useEffect(() => {
    if (!loading) {
      fetchDetail()
    }
  }, [detailPage, selectedZona, selectedContratista, drillFilters, detailSearch])

  // ---------- Drill-through Handler ----------

  const drillTo = (filters: Record<string, string>) => {
    setDrillFilters(prev => ({ ...prev, ...filters }))
    setDetailPage(1)
    setActiveTab(2) // Navigate to Detail tab
  }

  const clearDrillFilters = () => {
    setDrillFilters({})
    setDetailPage(1)
  }

  // ---------- eCharts Options ----------

  const tendenciaOption = (): any => {
    if (!overview?.tendencia_temporal) return {}
    const monthly = overview.tendencia_temporal
      .filter(t => t.tipo === 'mensual')
      .sort((a, b) => a.periodo.localeCompare(b.periodo))

    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
      legend: { data: ['# Multas', '% Mal Ejecutado'], top: 0 },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', data: monthly.map(m => m.periodo), axisLabel: { rotate: 45 } },
      yAxis: [
        { type: 'value', name: '# Multas', position: 'left' },
        { type: 'value', name: '% Mal Ejec.', position: 'right', axisLabel: { formatter: '{value}%' } },
      ],
      series: [
        {
          name: '# Multas',
          type: 'bar',
          data: monthly.map(m => m.multas),
          itemStyle: { color: '#ef4444' },
          barMaxWidth: 30,
        },
        {
          name: '% Mal Ejecutado',
          type: 'line',
          yAxisIndex: 1,
          data: monthly.map(m => m.mal_ejecutado_tasa),
          itemStyle: { color: '#f59e0b' },
          lineStyle: { width: 2 },
          symbol: 'circle',
          symbolSize: 6,
        },
      ],
    }
  }

  const zonaStackedOption = (): any => {
    if (!overview?.resultado_por_zona) return {}
    const data = overview.resultado_por_zona

    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: ['Bien Ejecutado', 'Mal Ejecutado', 'No Efectiva', 'Otros'], top: 0 },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      yAxis: { type: 'category', data: data.map(d => d.zona) },
      xAxis: { type: 'value' },
      series: [
        { name: 'Bien Ejecutado', type: 'bar', stack: 'total', data: data.map(d => d.bien_ejecutado), itemStyle: { color: '#10b981' } },
        { name: 'Mal Ejecutado', type: 'bar', stack: 'total', data: data.map(d => d.mal_ejecutado), itemStyle: { color: '#ef4444' } },
        { name: 'No Efectiva', type: 'bar', stack: 'total', data: data.map(d => d.no_efectiva), itemStyle: { color: '#94a3b8' } },
        { name: 'Otros', type: 'bar', stack: 'total', data: data.map(d => d.otros), itemStyle: { color: '#d1d5db' } },
      ],
    }
  }

  const topComunasOption = (): any => {
    if (!overview?.top_comunas_problemas) return {}
    const data = [...overview.top_comunas_problemas].reverse()

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const d = params[0]
          const comuna = data[d.dataIndex]
          return `<b>${comuna.comuna}</b><br/>Tasa Mal Ejec: ${comuna.tasa_mal_ejecutado}%<br/>Cantidad: ${comuna.mal_ejecutado}/${comuna.efectivas}<br/>Multas: ${comuna.multas}`
        },
      },
      grid: { left: '3%', right: '15%', bottom: '3%', containLabel: true },
      yAxis: { type: 'category', data: data.map(d => d.comuna) },
      xAxis: { type: 'value', axisLabel: { formatter: '{value}%' } },
      series: [{
        type: 'bar',
        data: data.map(d => d.tasa_mal_ejecutado),
        itemStyle: {
          color: (params: any) => {
            const val = params.value
            if (val > 5) return '#ef4444'
            if (val > 3) return '#f59e0b'
            return '#10b981'
          },
        },
        label: { show: true, position: 'right', formatter: '{c}%' },
      }],
    }
  }

  const scatterOption = (): any => {
    if (!contratistas?.scatter_contratistas) return {}
    const data = contratistas.scatter_contratistas

    return {
      tooltip: {
        formatter: (params: any) => {
          const d = data[params.dataIndex]
          return `<b>${d.contratista}</b><br/>Volumen: ${d.x_volumen}<br/>Tasa Mal Ejec: ${d.y_tasa_mal}%<br/>Multas: ${d.size_multas}`
        },
      },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'value', name: 'Volumen (inspecciones)', nameLocation: 'center', nameGap: 30 },
      yAxis: { type: 'value', name: 'Tasa Mal Ejecutado (%)', nameLocation: 'center', nameGap: 40, axisLabel: { formatter: '{value}%' } },
      series: [{
        type: 'scatter',
        data: data.map(d => [d.x_volumen, d.y_tasa_mal, d.size_multas, d.contratista]),
        symbolSize: (val: number[]) => Math.max(15, Math.min(50, val[2] * 3)),
        itemStyle: { color: '#3b82f6', opacity: 0.8 },
        label: {
          show: true,
          formatter: (params: any) => params.value[3],
          position: 'top',
          fontSize: 11,
          fontWeight: 'bold',
        },
      }],
    }
  }

  const topContratistasTasaOption = (): any => {
    if (!contratistas?.ranking_contratistas) return {}
    const data = [...contratistas.ranking_contratistas]
      .sort((a, b) => a.tasa_mal_ejecutado - b.tasa_mal_ejecutado)

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const d = data[params[0].dataIndex]
          return `<b>${d.contratista}</b><br/>Tasa: ${d.tasa_mal_ejecutado}%<br/>Cantidad: ${d.mal_ejecutado}/${d.efectivas}`
        },
      },
      grid: { left: '3%', right: '15%', bottom: '3%', containLabel: true },
      yAxis: { type: 'category', data: data.map(d => d.contratista) },
      xAxis: { type: 'value', axisLabel: { formatter: '{value}%' } },
      series: [{
        type: 'bar',
        data: data.map(d => d.tasa_mal_ejecutado),
        itemStyle: {
          color: (params: any) => {
            const val = params.value
            if (val > 3) return '#ef4444'
            if (val > 2) return '#f59e0b'
            return '#10b981'
          },
        },
        label: { show: true, position: 'right', formatter: '{c}%' },
      }],
    }
  }

  const paretoOption = (): any => {
    if (!causas?.pareto_causas?.categorias?.length) return {}
    const data = causas.pareto_causas.categorias

    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
      legend: { data: ['Cantidad', '% Acumulado'], top: 0 },
      grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
      xAxis: {
        type: 'category',
        data: data.map(d => d.causa.replace(/_/g, ' ')),
        axisLabel: { rotate: 45, fontSize: 10 },
      },
      yAxis: [
        { type: 'value', name: 'Cantidad', position: 'left' },
        { type: 'value', name: '% Acumulado', position: 'right', max: 100, axisLabel: { formatter: '{value}%' } },
      ],
      series: [
        {
          name: 'Cantidad',
          type: 'bar',
          data: data.map(d => d.count),
          itemStyle: { color: '#3b82f6' },
        },
        {
          name: '% Acumulado',
          type: 'line',
          yAxisIndex: 1,
          data: data.map(d => d.acumulado),
          itemStyle: { color: '#ef4444' },
          lineStyle: { width: 2 },
        },
      ],
    }
  }

  const trabajosMalOption = (): any => {
    if (!causas?.trabajos_tipicamente_mal?.length) return {}
    const data = causas.trabajos_tipicamente_mal.filter(d => d.mal_ejecutado > 0)

    return {
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '10%', bottom: '3%', containLabel: true },
      yAxis: { type: 'category', data: data.map(d => d.tipo_inspeccion) },
      xAxis: { type: 'value', axisLabel: { formatter: '{value}%' } },
      series: [{
        type: 'bar',
        data: data.map(d => d.tasa_mal_ejecutado),
        itemStyle: { color: '#f59e0b' },
        label: {
          show: true,
          position: 'right',
          formatter: (params: any) => {
            const d = data[params.dataIndex]
            return `${d.tasa_mal_ejecutado}% (${d.mal_ejecutado})`
          },
        },
      }],
    }
  }

  // ---------- Render ----------

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-[80vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      </div>
    )
  }

  const kpis = overview?.kpis

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Title + Export */}
        <Flex justifyContent="between" alignItems="center" className="mb-6">
          <div>
            <Title className="text-2xl font-bold">Nuevas Conexiones — Control de Calidad</Title>
            <Text className="text-gray-500">Dashboard ejecutivo ENEL</Text>
          </div>
          <ExportDropdown
            endpoint="/api/v1/nuevas-conexiones/export"
            filename="nncc_export"
            filters={{ base: selectedBase, zona: selectedZona }}
          />
        </Flex>

        {/* Global Filters */}
        <Card className="mb-6">
          <Flex className="gap-4 flex-wrap">
            <div className="w-48">
              <Text className="text-xs mb-1">Base / Periodo</Text>
              <Select value={selectedBase} onValueChange={setSelectedBase} placeholder="Todas las bases">
                <SelectItem value="">Todas</SelectItem>
                {availableBases.map(b => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </Select>
            </div>
            <div className="w-40">
              <Text className="text-xs mb-1">Zona</Text>
              <Select value={selectedZona} onValueChange={setSelectedZona} placeholder="Todas">
                <SelectItem value="">Todas</SelectItem>
                {zonas.map(z => (
                  <SelectItem key={z} value={z}>{z}</SelectItem>
                ))}
              </Select>
            </div>
            <div className="w-48">
              <Text className="text-xs mb-1">Contratista</Text>
              <Select value={selectedContratista} onValueChange={setSelectedContratista} placeholder="Todos">
                <SelectItem value="">Todos</SelectItem>
                {contratistasList.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </Select>
            </div>
          </Flex>
        </Card>

        {/* Tabs */}
        <TabGroup index={activeTab} onIndexChange={setActiveTab}>
          <TabList variant="solid">
            <Tab icon={Activity}>Resumen Ejecutivo</Tab>
            <Tab icon={Users}>Contratistas</Tab>
            <Tab icon={FileText}>Detalle</Tab>
          </TabList>

          <TabPanels>
            {/* ========== PAGE A: Executive Quality Overview ========== */}
            <TabPanel>
              <div className="mt-6 space-y-6">
                {/* KPI Cards */}
                {kpis && (
                  <Grid numItemsMd={3} numItemsLg={3} className="gap-4">
                    <KPICard
                      title="Total Inspecciones"
                      value={formatNumber(kpis.total_inspecciones)}
                      subtitle={`${kpis.inspecciones_efectivas} efectivas`}
                      color="blue"
                    />
                    <KPICard
                      title="% Mal Ejecutado"
                      value={`${kpis.mal_ejecutado_tasa}%`}
                      subtitle={`${kpis.mal_ejecutado_count} inspecciones`}
                      color={kpis.mal_ejecutado_tasa > 5 ? 'red' : kpis.mal_ejecutado_tasa > 3 ? 'amber' : 'green'}
                    />
                    <KPICard
                      title="# Mal Ejecutado"
                      value={formatNumber(kpis.mal_ejecutado_count)}
                      subtitle={`de ${kpis.inspecciones_efectivas} efectivas`}
                      color="red"
                    />
                    <KPICard
                      title="# Multas (SI)"
                      value={formatNumber(kpis.multas_si_count)}
                      subtitle={`${kpis.multas_por_100} por 100 insp.`}
                      color="red"
                    />
                    <KPICard
                      title="% No Efectiva"
                      value={`${kpis.no_efectiva_tasa}%`}
                      subtitle={`${kpis.inspecciones_no_efectivas} sin acceso`}
                      color={kpis.no_efectiva_tasa > 15 ? 'red' : kpis.no_efectiva_tasa > 10 ? 'amber' : 'green'}
                    />
                    <KPICard
                      title="Backlog Normalización"
                      value={`${formatNumber(kpis.backlog_normalizacion)}/${formatNumber(kpis.total_inspecciones)}`}
                      subtitle={`${kpis.backlog_tasa}% pendiente`}
                      color={kpis.backlog_tasa > 5 ? 'red' : kpis.backlog_tasa > 3 ? 'amber' : 'green'}
                    />
                  </Grid>
                )}

                {/* Tendencia temporal */}
                <Card>
                  <Title>Tendencia Mensual: % Mal Ejecutado y Multas</Title>
                  <EChart option={tendenciaOption()} height="380px" />
                </Card>

                {/* Resultado por zona + Top comunas */}
                <Grid numItemsMd={2} className="gap-4">
                  <Card>
                    <Title>Resultado por Zona</Title>
                    <Text className="text-xs text-gray-400 mb-2">Click en una zona para ver detalle</Text>
                    <EChart
                      option={zonaStackedOption()}
                      height="300px"
                      onEvents={{
                        click: (params: any) => {
                          const zona = overview?.resultado_por_zona?.[params.dataIndex]?.zona
                          if (zona) drillTo({ zona })
                        },
                      }}
                    />
                  </Card>
                  <Card>
                    <Title>Top 5 Comunas con Más Mal Ejecutado</Title>
                    <Text className="text-xs text-gray-400 mb-2">Ordenado por tasa, no por cantidad</Text>
                    <EChart
                      option={topComunasOption()}
                      height="300px"
                      onEvents={{
                        click: (params: any) => {
                          const comunas = [...(overview?.top_comunas_problemas || [])].reverse()
                          const comuna = comunas[params.dataIndex]?.comuna
                          if (comuna) drillTo({ comuna })
                        },
                      }}
                    />
                  </Card>
                </Grid>

                {/* Tasa Efectividad OCA */}
                {kpis && (
                  <Grid numItemsMd={2} className="gap-4">
                    <Card>
                      <Title>Tasa Efectividad OCA</Title>
                      <div className="flex items-center justify-center py-4">
                        <div className="text-center">
                          <p className="text-5xl font-bold text-blue-600">{kpis.tasa_efectividad_oca}%</p>
                          <Text className="mt-2 text-gray-500">Efectivas / Total</Text>
                        </div>
                      </div>
                    </Card>
                    <Card>
                      <Title>Tasa de Cierre Normalización</Title>
                      <div className="flex items-center justify-center py-4">
                        <div className="text-center">
                          <p className={`text-5xl font-bold ${kpis.tasa_cierre_normalizacion > 95 ? 'text-green-600' : 'text-amber-600'}`}>
                            {kpis.tasa_cierre_normalizacion}%
                          </p>
                          <Text className="mt-2 text-gray-500">Normalizados / Total</Text>
                        </div>
                      </div>
                    </Card>
                  </Grid>
                )}
              </div>
            </TabPanel>

            {/* ========== PAGE B: Contratistas ========== */}
            <TabPanel>
              <div className="mt-6 space-y-6">
                {/* Ranking Table */}
                {contratistas?.ranking_contratistas && (
                  <Card>
                    <Title>Ranking de Contratistas</Title>
                    <Text className="text-xs text-gray-400 mb-4">Click en una fila para ver detalle del contratista</Text>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableHeaderCell>Contratista</TableHeaderCell>
                          <TableHeaderCell className="text-right">Inspecciones</TableHeaderCell>
                          <TableHeaderCell className="text-right">Mal Ejecutado</TableHeaderCell>
                          <TableHeaderCell className="text-right">Tasa Mal %</TableHeaderCell>
                          <TableHeaderCell className="text-right">Multas</TableHeaderCell>
                          <TableHeaderCell className="text-right">Tasa Multas %</TableHeaderCell>
                          <TableHeaderCell className="text-right">Pend. Norm.</TableHeaderCell>
                          <TableHeaderCell className="text-right">Tasa Cierre %</TableHeaderCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {contratistas.ranking_contratistas.map((c) => (
                          <TableRow
                            key={c.contratista}
                            className="cursor-pointer hover:bg-gray-50"
                            onClick={() => drillTo({ contratista: c.contratista })}
                          >
                            <TableCell className="font-medium">{c.contratista}</TableCell>
                            <TableCell className="text-right">{formatNumber(c.inspecciones)}</TableCell>
                            <TableCell className="text-right">{c.mal_ejecutado}</TableCell>
                            <TableCell className="text-right">
                              <Badge color={c.tasa_mal_ejecutado > 3 ? 'red' : c.tasa_mal_ejecutado > 2 ? 'yellow' : 'green'}>
                                {c.tasa_mal_ejecutado}%
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{c.multas}</TableCell>
                            <TableCell className="text-right">
                              <Badge color={c.tasa_multas > 3 ? 'red' : c.tasa_multas > 2 ? 'yellow' : 'green'}>
                                {c.tasa_multas}%
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{c.pendiente_normalizacion}</TableCell>
                            <TableCell className="text-right">
                              <Badge color={c.tasa_cierre > 97 ? 'green' : c.tasa_cierre > 95 ? 'yellow' : 'red'}>
                                {c.tasa_cierre}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* Total row */}
                        <TableRow className="bg-gray-100 font-bold">
                          <TableCell>TOTAL</TableCell>
                          <TableCell className="text-right">
                            {formatNumber(contratistas.ranking_contratistas.reduce((s, c) => s + c.inspecciones, 0))}
                          </TableCell>
                          <TableCell className="text-right">
                            {contratistas.ranking_contratistas.reduce((s, c) => s + c.mal_ejecutado, 0)}
                          </TableCell>
                          <TableCell className="text-right">—</TableCell>
                          <TableCell className="text-right">
                            {contratistas.ranking_contratistas.reduce((s, c) => s + c.multas, 0)}
                          </TableCell>
                          <TableCell className="text-right">—</TableCell>
                          <TableCell className="text-right">
                            {contratistas.ranking_contratistas.reduce((s, c) => s + c.pendiente_normalizacion, 0)}
                          </TableCell>
                          <TableCell className="text-right">—</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </Card>
                )}

                {/* Scatter + Top by tasa */}
                <Grid numItemsMd={2} className="gap-4">
                  <Card>
                    <Title>Volumen vs Tasa de Mal Ejecutado</Title>
                    <Text className="text-xs text-gray-400 mb-2">Tamaño = cantidad de multas</Text>
                    <EChart option={scatterOption()} height="350px" />
                  </Card>
                  <Card>
                    <Title>Top Contratistas por Tasa</Title>
                    <Text className="text-xs text-gray-400 mb-2">Ordenado por tasa (no por cantidad)</Text>
                    <EChart option={topContratistasTasaOption()} height="350px" />
                  </Card>
                </Grid>
              </div>
            </TabPanel>

            {/* ========== PAGE C: Detalle Operativo ========== */}
            <TabPanel>
              <div className="mt-6 space-y-6">
                {/* Active drill-through filters */}
                {Object.keys(drillFilters).length > 0 && (
                  <Card className="bg-blue-50 border-blue-200">
                    <Flex justifyContent="between" alignItems="center">
                      <Flex className="gap-2 flex-wrap" justifyContent="start">
                        <Text className="text-sm font-medium text-blue-700">Filtros activos:</Text>
                        {Object.entries(drillFilters).map(([key, val]) => (
                          <Badge key={key} color="blue" className="cursor-pointer" onClick={() => {
                            setDrillFilters(prev => {
                              const next = { ...prev }
                              delete next[key]
                              return next
                            })
                          }}>
                            {key}: {val} <X className="w-3 h-3 ml-1 inline" />
                          </Badge>
                        ))}
                      </Flex>
                      <Button variant="ghost" size="sm" onClick={clearDrillFilters}>
                        Limpiar filtros
                      </Button>
                    </Flex>
                  </Card>
                )}

                {/* Search */}
                <Card>
                  <TextInput
                    icon={Search}
                    placeholder="Buscar por cliente, dirección, comuna, medidor..."
                    value={detailSearch}
                    onChange={(e) => {
                      setDetailSearch(e.target.value)
                      setDetailPage(1)
                    }}
                  />
                </Card>

                {/* Detail Table */}
                <Card>
                  <Flex justifyContent="between" className="mb-4">
                    <Title>Detalle de Inspecciones</Title>
                    <Text className="text-sm text-gray-500">{formatNumber(detailTotal)} registros</Text>
                  </Flex>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableHeaderCell>VTA</TableHeaderCell>
                          <TableHeaderCell>Cliente</TableHeaderCell>
                          <TableHeaderCell>Dirección</TableHeaderCell>
                          <TableHeaderCell>Comuna</TableHeaderCell>
                          <TableHeaderCell>Contratista</TableHeaderCell>
                          <TableHeaderCell>Resultado</TableHeaderCell>
                          <TableHeaderCell>Multa</TableHeaderCell>
                          <TableHeaderCell>Categoría</TableHeaderCell>
                          <TableHeaderCell>Obs.</TableHeaderCell>
                          <TableHeaderCell>Link</TableHeaderCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {detailData.map((row, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs">{row.vta || '—'}</TableCell>
                            <TableCell className="text-xs">{row.cliente}</TableCell>
                            <TableCell className="text-xs max-w-[200px] truncate" title={row.direccion}>
                              {row.direccion}
                            </TableCell>
                            <TableCell className="text-xs">{row.comuna}</TableCell>
                            <TableCell className="text-xs">{row.contratista_enel || '—'}</TableCell>
                            <TableCell>
                              <Badge
                                color={
                                  row.resultado_inspeccion?.includes('BIEN') ? 'green'
                                  : row.resultado_inspeccion?.includes('MAL') ? 'red'
                                  : 'gray'
                                }
                                size="xs"
                              >
                                {row.resultado_inspeccion?.includes('BIEN') ? 'Bien'
                                  : row.resultado_inspeccion?.includes('MAL') ? 'Mal'
                                  : row.resultado_inspeccion?.includes('OTROS') ? 'Otros'
                                  : 'N/E'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge color={row.multa === 'SI' ? 'red' : 'gray'} size="xs">
                                {row.multa || '—'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs max-w-[150px] truncate" title={row.categoria_mal_ejecutado}>
                              {row.categoria_mal_ejecutado || '—'}
                            </TableCell>
                            <TableCell className="text-xs max-w-[150px] truncate" title={row.observaciones_multa}>
                              {row.observaciones_multa || '—'}
                            </TableCell>
                            <TableCell>
                              {row.link_formulario ? (
                                <a href={row.link_formulario} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="w-4 h-4 text-blue-500 hover:text-blue-700" />
                                </a>
                              ) : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  <Flex justifyContent="between" className="mt-4">
                    <Text className="text-sm text-gray-500">
                      Página {detailPage} de {Math.ceil(detailTotal / DETAIL_LIMIT) || 1}
                    </Text>
                    <Flex className="gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDetailPage(p => Math.max(1, p - 1))}
                        disabled={detailPage <= 1}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDetailPage(p => p + 1)}
                        disabled={detailPage >= Math.ceil(detailTotal / DETAIL_LIMIT)}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </Flex>
                  </Flex>
                </Card>

                {/* Pareto + Trabajos típicamente mal */}
                <Grid numItemsMd={2} className="gap-4">
                  <Card>
                    <Title>Pareto de Causas (Mal Ejecutado)</Title>
                    <Text className="text-xs text-gray-400 mb-2">Categorías separadas individualmente</Text>
                    <EChart option={paretoOption()} height="350px" />
                  </Card>
                  <Card>
                    <Title>Trabajos Típicamente Mal Ejecutados</Title>
                    <Text className="text-xs text-gray-400 mb-2">Tasa por tipo de inspección</Text>
                    <EChart option={trabajosMalOption()} height="350px" />
                  </Card>
                </Grid>
              </div>
            </TabPanel>
          </TabPanels>
        </TabGroup>
      </main>
    </div>
  )
}
```

**Step 2: Verify the page compiles**

```bash
cd frontend && npm run build 2>&1 | tail -20
```
Expected: Build succeeds without errors.

**Step 3: Commit**

```bash
git add frontend/src/app/dashboard/nuevas-conexiones/page.tsx
git commit -m "feat: rewrite NNCC dashboard with 3-tab executive layout and eCharts"
```

---

## Task 9: Integrate pre-calculation into the pipeline

**Files:**
- Modify: `scripts/pipeline.py` (add pre-calculation call after NNCC data load)

**Step 1: Add pre-calculation step to pipeline**

In `scripts/pipeline.py`, after the `process_nncc()` function completes its data insertion (around line 264), add a call to the pre-calculation script. Find the end of `process_nncc()` and add:

After the NNCC data is inserted into the DB, import and call the pre-calculation:

```python
from precalculate_nncc import run as precalculate_nncc_stats
```

At the point where `process_nncc()` finishes, add:

```python
# Pre-calculate dashboard stats
print("  Pre-calculating NNCC dashboard stats...")
precalculate_nncc_stats()
print("  NNCC dashboard stats updated")
```

**Step 2: Commit**

```bash
git add scripts/pipeline.py
git commit -m "feat: integrate NNCC pre-calculation into pipeline"
```

---

## Task 10: End-to-end verification

**Step 1: Run the pre-calculation script for test bases**

```bash
cd /home/unzzui/Proyectos/DCAT-OCA
python scripts/precalculate_nncc.py --base "2025-11 EJECUTADOS"
python scripts/precalculate_nncc.py --base "2025-12 EJECUTADOS"
python scripts/precalculate_nncc.py
```

**Step 2: Start the backend and verify endpoints**

```bash
cd backend && uvicorn app.main:app --reload &
sleep 3

TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ocaglobal.com","password":"admin123"}' | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

echo "=== Overview ==="
curl -s "http://localhost:8000/api/v1/nuevas-conexiones/dashboard/overview?base=2025-12+EJECUTADOS" \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool | head -30

echo "=== Contratistas ==="
curl -s "http://localhost:8000/api/v1/nuevas-conexiones/dashboard/contratistas?base=2025-12+EJECUTADOS" \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool | head -30

echo "=== Causas ==="
curl -s "http://localhost:8000/api/v1/nuevas-conexiones/dashboard/causas?base=2025-12+EJECUTADOS" \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool | head -30

echo "=== Bases ==="
curl -s "http://localhost:8000/api/v1/nuevas-conexiones/dashboard/bases" \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool

kill %1
```

Expected: All endpoints return valid JSON with metrics matching the test data.

**Step 3: Start the frontend and verify visually**

```bash
cd frontend && npm run dev &
sleep 5
echo "Open http://localhost:3000/dashboard/nuevas-conexiones in browser"
```

Verify:
- [ ] Tab "Resumen Ejecutivo" shows 6 KPI cards with correct values
- [ ] Tendencia chart shows monthly bars + line
- [ ] Resultado por zona shows horizontal stacked bars
- [ ] Top 5 comunas shows horizontal bars sorted by tasa
- [ ] Tab "Contratistas" shows ranking table with 4 contratistas (UTE, LARI, DOMINIOM, PROVIDER)
- [ ] Scatter chart shows 4 points with labels
- [ ] Top por tasa shows horizontal bars
- [ ] Tab "Detalle" shows paginated table with 20 rows
- [ ] Clicking a zone in chart navigates to Detail tab with filter applied
- [ ] Clicking a contratista row navigates to Detail tab with filter applied
- [ ] Pareto chart shows cause breakdown
- [ ] Drill-through filters show as removable chips

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete NNCC dashboard restructuring with eCharts and pre-calculated metrics"
```
