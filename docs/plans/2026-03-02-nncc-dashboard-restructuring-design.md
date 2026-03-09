# NNCC Dashboard Restructuring — Design Document

**Date:** 2026-03-02
**Module:** Nuevas Conexiones (NNCC)
**Approach:** Refactor in-place (Enfoque A)

## Overview

Complete restructuring of the NNCC dashboard module to create an executive-grade quality control + accountability dashboard for ENEL. Replaces all existing tabs with 3 new pages focused on: what went wrong, who did it, where it happens, how much it costs/impacts, and whether it gets corrected.

## Key Decisions

- **Charts:** Apache eCharts (replaces Recharts for visualizations; Tremor retained for UI components)
- **Pre-calculation:** Python script → PostgreSQL table `nncc_dashboard_stats`
- **Drill-through:** Filter in same page (tab navigation with auto-applied filters)
- **Test data:** Bases `2025-11 EJECUTADOS` and `2025-12 EJECUTADOS` (~3,195 records, all with CONTRATISTA_ENEL)

## Data Quality — Normalization Required

The raw data has inconsistent casing that must be normalized during pre-calculation:

| Column | Raw Values | Normalized |
|--------|-----------|------------|
| CUMPLE NORMA CODIGO COLORES | "Cumple Norma CC", "CUMPLE NORMA CC" | "CUMPLE" |
| CUMPLE NORMA CODIGO COLORES | "No Cumple Norma CC", "NO CUMPLE NORMA CC" | "NO CUMPLE" |
| CLIENTE CONFORME | "Cliente conforme", "CLIENTE CONFORME" | "CONFORME" |
| CLIENTE CONFORME | "Cliente disconforme", "CLIENTE DISCONFORME" | "DISCONFORME" |
| ESTADO DEL EMPALME | "Bueno", "BUENO" | "BUENO" |
| ESTADO DEL EMPALME | "Malo", "MALO" | "MALO" |
| MULTA SI/NO | "S" | "SI" |
| RESULTADO FINAL DE INSPCCION | "BIEN EJECUTADO" | "TRABAJO BIEN EJECUTADO" |

---

## 1. Pre-calculation Layer (Python → PostgreSQL)

### Table: `nncc_dashboard_stats`

```sql
CREATE TABLE nncc_dashboard_stats (
    id SERIAL PRIMARY KEY,
    stat_key VARCHAR(100) NOT NULL,
    base_periodo VARCHAR(100),          -- NULL = all bases combined
    filters_hash VARCHAR(64),           -- NULL = global (no filters)
    data JSONB NOT NULL,
    calculated_at TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_nncc_stats_key ON nncc_dashboard_stats(stat_key, base_periodo);
```

### Pre-calculated Metrics (stat_keys)

**`overview_kpis`** — Executive KPIs:
```json
{
  "total_inspecciones": 3195,
  "inspecciones_efectivas": 2674,
  "inspecciones_no_efectivas": 299,
  "mal_ejecutado_count": 77,
  "mal_ejecutado_tasa": 2.88,
  "multas_si_count": 78,
  "multas_por_100": 2.44,
  "no_efectiva_tasa": 10.07,
  "backlog_normalizacion": 78,
  "backlog_tasa": 2.44,
  "tasa_efectividad_oca": 83.69,
  "tasa_cierre_normalizacion": 97.56,
  "delta_vs_anterior": {
    "mal_ejecutado_tasa": -0.3,
    "multas_count": +3,
    "no_efectiva_tasa": +1.2
  }
}
```

**`tendencia_temporal`** — Weekly/monthly time series:
```json
[
  {
    "periodo": "2025-W45",
    "tipo": "semanal",
    "total": 150,
    "efectivas": 130,
    "mal_ejecutado": 5,
    "mal_ejecutado_tasa": 3.85,
    "multas": 6
  }
]
```

**`resultado_por_zona`** — Stacked bars by zone:
```json
[
  {
    "zona": "FLORIDA",
    "bien_ejecutado": 1200,
    "mal_ejecutado": 35,
    "no_efectiva": 80,
    "otros": 10,
    "total": 1325,
    "tasa_mal_ejecutado": 2.69
  }
]
```

**`top_comunas_problemas`** — Top 5 by mal ejecutado rate:
```json
[
  {
    "comuna": "MAIPU",
    "total": 250,
    "efectivas": 220,
    "mal_ejecutado": 12,
    "tasa_mal_ejecutado": 5.45,
    "multas": 14
  }
]
```

**`ranking_contratistas`** — Contractor matrix:
```json
[
  {
    "contratista": "UTE",
    "inspecciones": 951,
    "efectivas": 850,
    "mal_ejecutado": 12,
    "tasa_mal_ejecutado": 1.41,
    "multas": 15,
    "tasa_multas": 1.58,
    "pendiente_normalizacion": 8,
    "tasa_cierre": 99.16
  }
]
```

**`scatter_contratistas`** — Volume vs quality:
```json
[
  {
    "contratista": "UTE",
    "x_volumen": 951,
    "y_tasa_mal": 1.41,
    "size_multas": 15
  }
]
```

**`pareto_causas`** — Pareto of failure categories:
```json
{
  "categorias": [
    {"causa": "ROTULADO_INCORRECTO", "count": 24, "pct": 30.8, "acumulado": 30.8},
    {"causa": "NUMERO_MEDIDOR_MAL_INGRESADO", "count": 14, "pct": 17.9, "acumulado": 48.7},
    {"causa": "SIN_PERNO_BIELA", "count": 13, "pct": 16.7, "acumulado": 65.4}
  ],
  "keywords_observaciones": [
    {"keyword": "MEDIDOR", "count": 1963},
    {"keyword": "SUBTERRANEO", "count": 1225}
  ]
}
```

**`desgloses_zona`** — Zone breakdowns with communes and contractors:
```json
[
  {
    "zona": "FLORIDA",
    "comunas": [
      {"comuna": "LA FLORIDA", "total": 300, "mal_ejecutado": 8, "tasa": 2.7}
    ],
    "contratistas": [
      {"contratista": "UTE", "total": 400, "mal_ejecutado": 5, "tasa": 1.25}
    ]
  }
]
```

**`trabajos_tipicamente_mal`** — Cross-tab of inspection type x failure category:
```json
[
  {
    "tipo_inspeccion": "Inmobiliaria",
    "total": 40891,
    "mal_ejecutado": 70,
    "top_causas": ["ROTULADO_INCORRECTO", "SIN_PERNO_BIELA"]
  }
]
```

### Script: `scripts/precalculate_nncc.py`

- Reads from `nncc` table in PostgreSQL
- Normalizes data inconsistencies (casing issues)
- Computes all stat_keys above
- TRUNCATE + bulk INSERT into `nncc_dashboard_stats`
- Runs as final step of `pipeline.py`
- Supports `--base` filter for per-period calculation

---

## 2. Backend API Changes

### New Endpoints

```
GET /api/v1/nuevas-conexiones/dashboard/overview
    → Returns overview_kpis + tendencia_temporal + resultado_por_zona + top_comunas
    Query params: ?base=2025-11 EJECUTADOS

GET /api/v1/nuevas-conexiones/dashboard/contratistas
    → Returns ranking_contratistas + scatter_contratistas
    Query params: ?base=2025-11 EJECUTADOS

GET /api/v1/nuevas-conexiones/dashboard/causas
    → Returns pareto_causas + trabajos_tipicamente_mal + desgloses_zona
    Query params: ?base=2025-11 EJECUTADOS
```

### Existing Endpoints (kept)

```
GET /api/v1/nuevas-conexiones/         # Paginated detail table (Page C)
GET /api/v1/nuevas-conexiones/comunas  # Filter options
GET /api/v1/nuevas-conexiones/zonas    # Filter options
GET /api/v1/nuevas-conexiones/bases    # Filter options
GET /api/v1/nuevas-conexiones/export   # CSV/Excel export
```

### Removed Endpoints

```
GET /api/v1/nuevas-conexiones/stats       # Replaced by pre-calculated dashboard endpoints
GET /api/v1/nuevas-conexiones/inspectors  # Merged into contratistas
GET /api/v1/nuevas-conexiones/periodos    # Merged into bases
```

---

## 3. Frontend — Page A: Executive Quality Overview

### Tab name: "Resumen Ejecutivo"

### KPI Cards (3x2 grid)
| KPI | Calculation | Color Logic |
|-----|------------|-------------|
| Total Inspecciones | COUNT(*) | Neutral (blue) |
| % Mal Ejecutado | Mal Ejecutado / Efectivas * 100 | Green if < 3%, Red if > 5% |
| # Mal Ejecutado | COUNT where resultado = MAL | Red always |
| # Multas (SI) | COUNT where multa = SI | Red always |
| % No Efectiva | No Efectiva / Total * 100 | Green if < 10%, Red if > 15% |
| Backlog Normalización | Pendiente / Total | Green if < 3%, Red if > 5% |

Each card shows delta vs previous period (arrow + percentage).

### Charts (eCharts)
1. **Tendencia temporal** — Mixed chart (bar: # multas, line: % mal ejecutado). Toggle: semanal/mensual. Dark theme compatible.
2. **Resultado por zona** — Horizontal stacked bar. Colors: emerald (bien), rose (mal), slate (no efectiva). Click → drill to Page C.
3. **Top 5 comunas** — Horizontal bar sorted by tasa (not count). Shows both count and rate. Click → drill to Page C.

---

## 4. Frontend — Page B: Contratistas (Ranking & Benchmark)

### Tab name: "Contratistas"

### Ranking Table (HTML table with color coding)
Columns: Contratista | Inspecciones | Mal Ejecutado | Tasa Mal % | Multas | Tasa Multas % | Pendiente Norm. | Tasa Cierre %

- Cells color-coded: green/red based on thresholds
- Footer row with TOTAL
- Click row → drill to Page C filtered by contratista
- Rule: Always show Cantidad AND Tasa together

### Charts (eCharts)
1. **Scatter** — x=volumen, y=tasa mal ejecutado, bubble size=multas. Labels on each point. Quadrant lines at median values.
2. **Top contratistas por TASA** — Horizontal bar. Shows both count label and tasa. Sorted by tasa descending.

---

## 5. Frontend — Page C: Detalle Operativo (Drill-through)

### Tab name: "Detalle"

### Active Filters Bar
Shows applied drill-through filters as removable chips: `[Zona: FLORIDA ×] [Contratista: UTE ×]`

### Detail Table (20 rows per page)
Columns:
- VTA / Cliente / Dirección (truncated) / Comuna
- Contratista_ENEL
- Resultado final inspección (color badge)
- Multa SI/NO (color badge)
- Categoría mal ejecutado
- Obs Inspector (truncated + tooltip on hover)
- Link Formulario (button "Ver" → opens URL)

### Additional Charts
1. **Pareto de causas** — Bar + cumulative line. Splits multi-category entries (e.g. "A | B" → counts for A and B separately).
2. **Trabajos típicamente mal ejecutados** — Grouped bar by tipo_inspeccion showing failure rates.
3. **Tasa Efectividad OCA** — Gauge chart showing overall effectiveness rate.

### Drill-through Mechanism
- Click on any chart element in Page A/B → auto-navigates to Page C tab with filters applied
- Filters stored in React state (not URL params)
- "Limpiar filtros" button to reset

---

## 6. Key Formulas

| Metric | Formula |
|--------|---------|
| Tasa Mal Ejecutado | Mal Ejecutado / Inspecciones Efectivas * 100 |
| Tasa No Efectiva | No Efectiva / Total * 100 |
| Multas por 100 insp. | Multas SI * 100 / Total |
| Tasa Efectividad OCA | Efectivas / Total * 100 |
| Backlog Normalización | Pendiente Normalizar / Total |
| Tasa de Cierre | (Total - Pendientes) / Total * 100 |

---

## 7. Tech Stack Changes

| Component | Before | After |
|-----------|--------|-------|
| Charts | Tremor + Recharts | Apache eCharts (echarts-for-react) |
| UI Components | Tremor | Tremor (kept) |
| Stats calculation | Real-time SQL in backend | Pre-calculated in PostgreSQL |
| Stats caching | TTL 60s in-memory | Persistent in DB table |
| Tabs | 5 tabs (Dashboard, Datos, Territorial, Inspectores, Medidores) | 3 tabs (Resumen Ejecutivo, Contratistas, Detalle) |

---

## 8. Files to Modify/Create

### New Files
- `scripts/precalculate_nncc.py` — Pre-calculation script
- `backend/app/db/models_stats.py` — SQLAlchemy model for nncc_dashboard_stats (or extend models.py)
- `backend/app/services/nncc_dashboard_service.py` — Service reading from pre-calculated stats
- `backend/app/schemas/nncc_dashboard.py` — Pydantic models for new endpoints

### Modified Files
- `frontend/src/app/dashboard/nuevas-conexiones/page.tsx` — Complete rewrite (3 new tabs)
- `backend/app/api/v1/nuevas_conexiones.py` — Add new dashboard endpoints
- `backend/app/api/v1/router.py` — Register new routes
- `scripts/pipeline.py` — Add pre-calculation step after data load

### Dependencies to Add
- Frontend: `echarts`, `echarts-for-react`
- Backend: No new dependencies needed
