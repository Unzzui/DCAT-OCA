# NNCC Dashboard Visual Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all broken data connections, add interactive Leaflet map, improve KPI visuals with modals, and polish the overall dashboard UX.

**Architecture:** Fix precalculate script field names to match frontend interfaces, re-run to update DB. Add lat/lng columns to DB + pipeline. Add Leaflet map component. Rewrite KPI section with click-to-modal pattern. Polish all chart configs.

**Tech Stack:** Python/pandas (precalculate), PostgreSQL, FastAPI, Next.js 14, echarts, react-leaflet + leaflet (new), Tremor React

---

### Task 1: Fix precalculate_nncc.py field names

**Files:**
- Modify: `scripts/precalculate_nncc.py`

**Step 1: Fix remaining mismatched functions**

The following functions still have wrong field names (overview_kpis and tendencia_temporal were already partially fixed):

In `calc_ranking_contratistas` change output keys:
- `"tasa_mal_ejecutado"` → `"tasa_mal"`
- `"pendiente_normalizacion"` → `"pend_norm"`

In `calc_scatter_contratistas` change output keys:
- `"x_volumen"` → `"volumen"` (uses `r["inspecciones"]`)
- `"y_tasa_mal"` → `"tasa_mal"` (uses `r["tasa_mal"]` after ranking fix)
- `"size_multas"` → `"multas"` (uses `r["multas"]`)

In `calc_top_comunas` fix the sort key bug:
- Line 188: `x["tasa_mal_ejecutado"]` → `x["tasa_mal"]` (field was already renamed to `tasa_mal` above but sort still references old name)

In `calc_pareto_causas` change return format:
- Return a flat list instead of `{"categorias": [...], "keywords_observaciones": [...]}`
- Each item: `{"causa": str, "cantidad": int, "acumulado_pct": float}`
- Map: `"count"` → `"cantidad"`, `"acumulado"` → `"acumulado_pct"`

In `calc_trabajos_tipicamente_mal` change output keys:
- `"tipo_inspeccion"` → `"tipo_trabajo"`
- `"tasa_mal_ejecutado"` → `"tasa_mal"`

**Step 2: Add new calc functions for map + KPI modals + deltas**

Add `calc_mapa_puntos(df)`:
```python
def calc_mapa_puntos(df: pd.DataFrame) -> list:
    geo = df.dropna(subset=["latitud", "longitud"])
    if geo.empty:
        return []
    return [
        {
            "lat": float(row["latitud"]),
            "lng": float(row["longitud"]),
            "resultado": str(row.get("resultado_inspeccion", "")),
            "zona": str(row.get("zona", "")),
            "comuna": str(row.get("comuna", "")),
            "contratista": str(row.get("contratista_enel", "")),
        }
        for _, row in geo.iterrows()
    ]
```

Add `calc_kpi_modals(df)`:
```python
def calc_kpi_modals(df: pd.DataFrame) -> dict:
    # Breakdown by zona for total inspecciones
    zona_breakdown = []
    for zona, grp in df.groupby("zona"):
        zona_breakdown.append({"zona": str(zona), "total": int(len(grp))})
    zona_breakdown.sort(key=lambda x: x["total"], reverse=True)

    # Top 5 causas for mal ejecutado
    causas_raw = df["categoria_mal_ejecutado"].dropna()
    all_causas = []
    for c in causas_raw:
        for part in str(c).split("|"):
            part = part.strip()
            if part and part not in ("None", "nan"):
                all_causas.append(part)
    top_causas = [{"causa": c, "cantidad": n} for c, n in Counter(all_causas).most_common(5)]

    # Top 5 contratistas by multas
    top_multas_contratistas = []
    df_con = df.dropna(subset=["contratista_enel"])
    for contratista, grp in df_con.groupby("contratista_enel"):
        multas = int((grp["multa"] == "SI").sum())
        if multas > 0:
            top_multas_contratistas.append({"contratista": str(contratista), "multas": multas})
    top_multas_contratistas.sort(key=lambda x: x["multas"], reverse=True)
    top_multas_contratistas = top_multas_contratistas[:5]

    # No efectiva by zona
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
```

**Step 3: Add mapa_puntos and kpi_modals to stats dict in run()**

In the `stats = { ... }` dict, add:
```python
"mapa_puntos": calc_mapa_puntos(df),
"kpi_modals": calc_kpi_modals(df),
```

**Step 4: Run the script to update DB**

```bash
cd /home/unzzui/Proyectos/DCAT-OCA
source venv/bin/activate
python scripts/precalculate_nncc.py
python scripts/precalculate_nncc.py --base "2025-11 EJECUTADOS"
python scripts/precalculate_nncc.py --base "2025-12 EJECUTADOS"
```

Expected: "Stored 11 stat keys" for each run (was 9, now +2 new)

**Step 5: Verify data in DB**

```bash
python3 -c "
import psycopg2, json
from dotenv import load_dotenv; import os; load_dotenv('.env')
conn = psycopg2.connect(os.getenv('DATABASE_URL'))
cur = conn.cursor()
cur.execute(\"SELECT stat_key, base_periodo FROM nncc_dashboard_stats WHERE base_periodo='__all__' ORDER BY stat_key\")
for r in cur.fetchall(): print(r[0])
# Verify ranking has tasa_mal not tasa_mal_ejecutado
cur.execute(\"SELECT data FROM nncc_dashboard_stats WHERE stat_key='ranking_contratistas' AND base_periodo='__all__'\")
d = cur.fetchone()[0]; d = json.loads(d) if isinstance(d,str) else d
print('ranking keys:', list(d[0].keys()))
cur.close(); conn.close()
"
```

Expected: ranking keys include `tasa_mal` and `pend_norm` (not old names)

---

### Task 2: Add lat/lng columns to DB + pipeline

**Files:**
- Modify: `backend/app/db/models.py`
- Modify: `scripts/pipeline.py`

**Step 1: Add columns to NNCCModel**

In `backend/app/db/models.py`, add to class NNCCModel after `categoria_mal_ejecutado`:
```python
latitud = Column(Float, nullable=True)
longitud = Column(Float, nullable=True)
```

**Step 2: Add ALTER TABLE to DB**

```bash
cd /home/unzzui/Proyectos/DCAT-OCA && source venv/bin/activate
python3 -c "
import psycopg2
from dotenv import load_dotenv; import os; load_dotenv('.env')
conn = psycopg2.connect(os.getenv('DATABASE_URL'))
cur = conn.cursor()
for col in ['latitud', 'longitud']:
    try:
        cur.execute(f'ALTER TABLE nncc ADD COLUMN {col} DOUBLE PRECISION')
    except Exception as e:
        conn.rollback()
        print(f'{col}: {e}')
        continue
conn.commit()
print('Columns added')
cur.close(); conn.close()
"
```

**Step 3: Add columns to pipeline.py column mapping**

In `scripts/pipeline.py`, add to the NNCC column mapping dict:
```python
"LATITUD": "latitud",
"LONGITUD": "longitud",
```

Also add `"latitud"` and `"longitud"` to the `known_cols` set.

**Step 4: Populate lat/lng from parquet via temp table update**

```bash
python3 -c "
import pandas as pd
import psycopg2
from dotenv import load_dotenv; import os; load_dotenv('.env')

df = pd.read_parquet('data/parquet/BASE_ACTUAL_20260302_230813.parquet')
# Only rows with valid lat/lng
geo = df[['VTA', 'LATITUD', 'LONGITUD']].dropna(subset=['LATITUD', 'LONGITUD'])
print(f'{len(geo)} rows with coordinates')

conn = psycopg2.connect(os.getenv('DATABASE_URL'))
cur = conn.cursor()
for _, row in geo.iterrows():
    cur.execute('UPDATE nncc SET latitud=%s, longitud=%s WHERE vta=%s',
                (float(row['LATITUD']), float(row['LONGITUD']), str(row['VTA'])))
conn.commit()
print(f'Updated {cur.rowcount} rows')
cur.close(); conn.close()
"
```

**Step 5: Re-run precalculate to generate mapa_puntos data**

```bash
python scripts/precalculate_nncc.py
python scripts/precalculate_nncc.py --base "2025-11 EJECUTADOS"
python scripts/precalculate_nncc.py --base "2025-12 EJECUTADOS"
```

---

### Task 3: Add backend mapa endpoint

**Files:**
- Modify: `backend/app/services/nncc_dashboard_service.py`
- Modify: `backend/app/api/v1/nuevas_conexiones.py`

**Step 1: Add get_mapa and get_kpi_modals to service**

In `nncc_dashboard_service.py`, add:
```python
@cached(ttl_seconds=300)
async def get_mapa(base: str = None) -> list:
    """Return map points with coordinates."""
    return await _get_stat("mapa_puntos", base)

@cached(ttl_seconds=300)
async def get_kpi_modals(base: str = None) -> dict:
    """Return KPI modal drill-down data."""
    return await _get_stat("kpi_modals", base)
```

**Step 2: Add API endpoints**

In `nuevas_conexiones.py`, add after the existing dashboard endpoints (before line 53 "Data endpoints"):
```python
@router.get("/dashboard/mapa")
async def get_dashboard_mapa(
    base: Optional[str] = Query(None, description="Filtrar por base/periodo"),
    current_user: User = Depends(get_current_user),
):
    """Map points with coordinates for geographic visualization."""
    return await nncc_dashboard_service.get_mapa(base)

@router.get("/dashboard/kpi-modals")
async def get_dashboard_kpi_modals(
    base: Optional[str] = Query(None, description="Filtrar por base/periodo"),
    current_user: User = Depends(get_current_user),
):
    """KPI drill-down modal data."""
    return await nncc_dashboard_service.get_kpi_modals(base)
```

---

### Task 4: Install Leaflet + create LeafletMap component

**Files:**
- Create: `frontend/src/components/ui/LeafletMap.tsx`
- Modify: `frontend/package.json`

**Step 1: Install dependencies**

```bash
cd /home/unzzui/Proyectos/DCAT-OCA/frontend
npm install leaflet react-leaflet
npm install -D @types/leaflet
```

**Step 2: Create LeafletMap component**

Create `frontend/src/components/ui/LeafletMap.tsx`:
- Use dynamic import (no SSR) since Leaflet needs `window`
- Accept `points: Array<{lat, lng, resultado, zona, comuna, contratista}>` prop
- Color markers: green for BIEN EJECUTADO, red for MAL EJECUTADO, gray for others
- Use MarkerClusterGroup for clustering (or simple CircleMarkers)
- Popup on click with point details
- `onPointClick` callback for drill-through
- Center on Santiago, Chile (-33.45, -70.65) with zoom 10
- Height prop (default 400px)
- Import leaflet CSS

**Step 3: Add leaflet CSS to layout or page**

In `page.tsx` or via a CSS import in the component:
```css
@import 'leaflet/dist/leaflet.css';
```

---

### Task 5: Rewrite page.tsx with visual improvements

**Files:**
- Modify: `frontend/src/app/dashboard/nuevas-conexiones/page.tsx`

This is the largest task. Changes:

**Step 1: Add new imports and types**

- Import `MapPin`, `Target`, `Zap`, `Shield`, `Activity`, `XCircle` from lucide-react for KPI icons
- Add `MapaPoint` interface: `{lat, lng, resultado, zona, comuna, contratista}`
- Add `KpiModalData` interface matching backend response
- Import dynamic from `next/dynamic` for LeafletMap

**Step 2: Add state for map + KPI modals**

```typescript
const [mapaPoints, setMapaPoints] = useState<MapaPoint[]>([])
const [mapaLoading, setMapaLoading] = useState(false)
const [kpiModalData, setKpiModalData] = useState<KpiModalData | null>(null)
const [activeModal, setActiveModal] = useState<string | null>(null)
```

**Step 3: Add data fetching for mapa + kpi-modals**

Fetch from `/api/v1/nuevas-conexiones/dashboard/mapa` and `/api/v1/nuevas-conexiones/dashboard/kpi-modals` alongside overview data.

**Step 4: Improve KPI cards section**

- Make KpiCard clickable (cursor-pointer, hover:shadow-lg transition)
- onClick opens modal via `setActiveModal(kpiKey)`
- Larger value text (text-3xl font-bold)
- Icon per KPI with colored background circle
- Better grid: `grid-cols-2 md:grid-cols-4 lg:grid-cols-4` for first 4, then 2-col for progress bars

**Step 5: Add KPI Modal component**

Create inline `KpiModal` component:
- Overlay with backdrop blur
- Card with title, mini EChart, close button
- Content varies by `activeModal` key:
  - `"total"`: horizontal bar of zona_breakdown
  - `"mal_ejecutado"`: horizontal bar of top_causas
  - `"multas"`: horizontal bar of top_multas_contratistas
  - `"no_efectiva"`: horizontal bar of no_efectiva_zona
- Close on backdrop click or X button

**Step 6: Add map section to Tab 0**

Below the existing charts in Tab 0 (Resumen Ejecutivo), add:
```tsx
<Card className="mt-4">
  <Title>Distribución Geográfica de Inspecciones</Title>
  <Text>853 inspecciones con coordenadas disponibles</Text>
  <div className="mt-3">
    <LeafletMap
      points={mapaPoints}
      height="400px"
      onPointClick={(p) => addDrillFilter('comuna', 'Comuna', p.comuna)}
    />
  </div>
</Card>
```

**Step 7: Fix all chart configurations**

Ensure all EChart options reference the correct field names from the (now-fixed) API data:
- tendencia_temporal: `tasa_mal` (already correct in interface)
- resultado_por_zona: `bien`, `mal`, `pendiente` (already correct)
- scatter: `volumen`, `tasa_mal`, `multas` (already correct)
- pareto: `cantidad`, `acumulado_pct` (already correct)
- trabajos: `tipo_trabajo`, `tasa_mal` (already correct)

Fix chart tooltips to use `formatNumber()` and `pct()` helpers consistently.

**Step 8: Visual polish across all charts**

- Add consistent color constants at top of file
- Better chart heights (min 300px for main charts)
- Grid: `grid-cols-1 lg:grid-cols-2` for chart pairs
- Card padding consistent (`p-4` or `p-5`)
- Chart titles with `<Text>` subtitle description

---

### Task 6: Remove debug logging

**Files:**
- Modify: `frontend/src/lib/api.ts` - Remove `[AUTH DEBUG]` console.logs from getHeaders
- Modify: `frontend/src/contexts/AuthContext.tsx` - Remove `[AUTH DEBUG]` console.logs from login
- Modify: `backend/app/api/deps.py` - Remove `[AUTH DEBUG]` print from get_current_user
- Modify: `backend/app/core/security.py` - Remove `[AUTH DEBUG]` prints from decode_token

---

### Task 7: Build verification

**Step 1: Frontend build check**

```bash
cd /home/unzzui/Proyectos/DCAT-OCA/frontend && npx next build
```

Expected: Build succeeds with no errors.

**Step 2: Start services and manual test**

```bash
cd /home/unzzui/Proyectos/DCAT-OCA && bash start.sh
```

Navigate to `http://localhost:3000/dashboard/nuevas-conexiones`:
- Tab 0: KPIs render with values, charts show data, map shows points
- Tab 1: Scatter + ranking table populate correctly
- Tab 2: Detail table + pareto chart work
- Click KPI card → modal opens with mini chart
- Click map point → drill filter added
