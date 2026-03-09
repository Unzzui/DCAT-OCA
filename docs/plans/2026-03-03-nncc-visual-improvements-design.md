# NNCC Dashboard - Visual Improvements & Data Fix Design

**Date:** 2026-03-03
**Status:** Approved

## Problem

The NNCC dashboard has multiple issues:
1. Pre-calculated data field names don't match frontend interfaces (charts show no data)
2. No geographic visualization despite having 853 records with lat/lng coordinates
3. KPI cards are static with no drill-down capability
4. Visual design needs polish (spacing, typography, colors, tooltips)
5. No trend comparison (current vs previous period)

## Scope

Fix critical data mismatches, add interactive Leaflet map, add KPI modals, visual polish, and advanced statistics. All changes are in-place refactoring.

## 1. Fix Data Field Name Mismatches

Update `precalculate_nncc.py` to output field names matching frontend TypeScript interfaces:

### overview_kpis
- `pct_mal_ejecutado` (was `mal_ejecutado_tasa`)
- `num_mal_ejecutado` (was `mal_ejecutado_count`)
- `num_multas_si` (was `multas_si_count`)
- `pct_no_efectiva` (was `no_efectiva_tasa`)
- Already correct: `total_inspecciones`, `backlog_normalizacion`, `tasa_efectividad_oca`, `tasa_cierre_normalizacion`

### tendencia_temporal
- `tasa_mal` (was `mal_ejecutado_tasa`)
- Remove unused: `tipo`, `efectivas`, `multas`

### resultado_por_zona
- `bien` (was `bien_ejecutado`)
- `mal` (was `mal_ejecutado`)
- `pendiente` (was `no_efectiva`)
- Remove: `otros`, `tasa_mal_ejecutado`

### top_comunas_problemas
- `tasa_mal` (was `tasa_mal_ejecutado`)

### ranking_contratistas
- `tasa_mal` (was `tasa_mal_ejecutado`)
- `pend_norm` (was `pendiente_normalizacion`)

### scatter_contratistas
- `volumen` (was `x_volumen`)
- `tasa_mal` (was `y_tasa_mal`)
- `multas` (was `size_multas`)

### pareto_causas
- Return flat array (was `{categorias: [...], keywords_observaciones: [...]}`)
- Each item: `causa`, `cantidad` (was `count`), `acumulado_pct` (was `acumulado`)

### trabajos_tipicamente_mal
- `tipo_trabajo` (was `tipo_inspeccion`)
- `tasa_mal` (was `tasa_mal_ejecutado`)

## 2. Interactive Map (Leaflet)

### Database
- Add `latitud DOUBLE PRECISION` and `longitud DOUBLE PRECISION` columns to `nncc` table
- Populate from parquet via pipeline.py column mapping

### Pre-calculation
- New stat key: `mapa_puntos`
- Data: Array of `{lat, lng, resultado, zona, comuna, contratista}` for records with valid coordinates
- ~853 points expected

### Frontend
- Install `react-leaflet` + `leaflet` packages
- New `LeafletMap` component (SSR-safe with dynamic import)
- Placed in Tab 0 (Resumen Ejecutivo) as full-width section below existing charts
- Markers color-coded by resultado (green=bien, red=mal, gray=pendiente)
- Marker clustering for zoom levels
- Popup on click: zona, comuna, contratista, resultado
- Click marker to add drill filter

## 3. KPI Modals

Click on any KPI card to open a modal with contextual detail:

| KPI | Modal Content |
|-----|--------------|
| Total Inspecciones | Mini bar chart: breakdown by zona |
| % Mal Ejecutado | Sparkline: trend last 4-8 periods |
| # Mal Ejecutado | Top 5 causas (mini horizontal bar) |
| # Multas SI | Top 5 contratistas with most multas |
| % No Efectiva | Breakdown by zona (mini bar) |
| Backlog Normalización | Progress toward zero (gauge) |
| Tasa Efectividad | Comparison vs previous period |
| Tasa Cierre | Comparison vs previous period |

Pre-calculate a new stat key `kpi_modals` with all modal data.

## 4. Visual Polish

### KPI Cards
- Larger value font (text-3xl), smaller label (text-xs uppercase tracking-wide)
- Descriptive icon per KPI (from lucide-react)
- Trend indicator arrow with delta percentage vs previous period
- Subtle hover effect (shadow-lg transition)
- Cursor pointer to indicate clickability

### Charts
- Consistent color palette: green (#10b981), red (#ef4444), amber (#f59e0b), indigo (#6366f1), gray (#6b7280)
- Richer tooltips with formatted numbers and percentages
- Chart titles with subtle description text
- Responsive grid: 2 columns on large screens, 1 on mobile

### Tables
- Sticky header
- Hover row highlight
- Better badge sizing and spacing

## 5. Advanced Statistics

### Period Comparison (Delta %)
- Add to `overview_kpis`: for each KPI, include `_prev` value from previous base period
- Frontend shows green/red arrow with percentage change

### Scatter Quadrants
- Add average lines to scatter plot (mean volumen, mean tasa_mal)
- Creates 4 quadrants: High Vol/High Risk, High Vol/Low Risk, etc.
- Label each quadrant subtly

## Tech Stack

- **Map**: `react-leaflet` v5 + `leaflet` v1.9 (new deps)
- **Charts**: `echarts` v6 via `echarts-for-react` (existing)
- **UI**: Tremor React (existing) for Cards, Tables, Badges
- **Modal**: Custom modal component or Tremor Dialog

## Files Changed

- `scripts/precalculate_nncc.py` - Fix field names, add mapa_puntos + kpi_modals + delta stats
- `backend/app/db/models.py` - Add latitud/longitud columns to NNCCModel
- `backend/app/services/nncc_dashboard_service.py` - Add get_mapa() endpoint data
- `backend/app/api/v1/nuevas_conexiones.py` - Add /dashboard/mapa endpoint
- `scripts/pipeline.py` - Add latitud/longitud to column mapping
- `frontend/package.json` - Add react-leaflet, leaflet deps
- `frontend/src/components/ui/LeafletMap.tsx` - New map component
- `frontend/src/app/dashboard/nuevas-conexiones/page.tsx` - Major visual overhaul
