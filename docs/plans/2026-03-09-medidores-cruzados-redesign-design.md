# Medidores Cruzados — Redesign Design

## Objective

Restructure the Medidores Cruzados tab to match the visual style, component architecture, and interaction patterns of Informe NNCC. Migrate from Tremor UI charts to ECharts with chart-theme.ts constants. Decompose the monolithic 1068-line page into modular components. Restructure from 5 tabs to 4 focused tabs.

## Data Constraints

MC data is narrower than NNCC:
- NO contractor field → no Contratistas tab
- NO multas → no penalty KPI
- NO estado_efectividad → no OCA tab
- NO coordinates → no map
- HAS: resultado_inspeccion, zona, comuna, inspector, estado_medidor (6 categories), workflow dates (correo→asignacion→analisis→inspeccion), etapa_caso

## Tab Structure (4 tabs)

### Tab 0: Resumen Ejecutivo

**Section 1 — Hero KPIs (3 cols, divide-x)**
| KPI | Value | Status | Click |
|---|---|---|---|
| Tasa Mal Ejecutado % | mal/total*100 | good <=15%, bad >15% | Modal: desglose por zona |
| Total Inspecciones | count total | neutral | — |
| Tasa Bien Ejecutado % | bien/total*100 | good >=85%, bad <85% | Modal: desglose por estado_medidor |

Each HeroKpi with monthly sparkline.

**Section 2 — Operational KPIs (grid 2x4)**
- Zonas Activas (count distinct)
- Comunas (count distinct)
- Inspectores (count distinct)
- Pend. Inspeccion (sin fecha_inspeccion, amber if >0)

**Section 3 — Tendencia Temporal (60%) + Resultado por Zona (40%)**
- Left: EChart dual-axis bars (Total, Mal) + line (% Tasa Mal). Toggle Mes/Sem. DataZoom if >12.
- Right: Stacked horizontal bars (Bien+Mal+Otros) per zona. Click → selectedZona filter.

**Section 4 — Estado Medidor (60%) + Top Comunas (40%)**
- Left: Horizontal bars distribution of estado_medidor (6 categories). Semantic colors.
- Right: Top 5 comunas by tasa mal ejecutado.

### Tab 1: Inspectores

**Section 1 — Hero KPIs (3 cols)**
| KPI | Value | Status |
|---|---|---|
| Inspectores Activos | count + "en X zonas" | neutral |
| Peor Tasa Mal | max tasa_mal (name in subtitle) | bad >=30% |
| Prom. Casos/Inspector | total/count | neutral |

**Section 2 — Operational KPIs (grid 2x4)**
- Total Inspeccionadas
- Mal Ejecutados (count + %)
- Dias Prom. Proceso
- Sin Inspeccion (red if >0)

**Section 3 — Scatter (60%) + Top 10 Bar (40%)**
- Left: Scatter X=volumen, Y=%tasa_mal per inspector. Red dashed at 30%. Click → modal.
- Right: Top 10 by % mal ejecutado bars. Color by severity.

**Section 4 — Distribucion por Zona (60%) + Tabla Causa Principal (40%)**
- Left: Stacked bars inspector × estado_medidor (top 3 + otros).
- Right: Table: Inspector | Estado Medidor Principal | Cantidad. Click → drill to Detalle.

**Section 5 — Ranking Table**
```
# | Inspector | Insp. | Mal Ej. | Tasa Mal (bar) | Zonas | Comunas | Dias Prom.
```

### Tab 2: Analisis Operacional

**Section 1 — Hero KPIs (3 cols)**
| KPI | Value | Status |
|---|---|---|
| Dias Prom. Total | avg correo→inspeccion | good <=20d, bad >30d |
| Casos Estancados | sin avance >30d | bad if >0 |
| Tasa Resolucion % | inspeccionados/total*100 | good >=80%, bad <80% |

**Section 2 — Operational KPIs (grid 2x4)**
- Correo→Asignacion (avg days)
- Asignacion→Analisis (avg days)
- Analisis→Inspeccion (avg days)
- Casos >60 dias (red if >0)

**Section 3 — Evolucion Tiempos (60%) + Alertas (40%)**
- Left: EChart dual-axis bars (dias prom/mes) + line (tasa bien %).
- Right: Auto-generated alert cards (danger/warning/info).

**Section 4 — Cuellos de Botella (60%) + Casos Pendientes (40%)**
- Left: Table: Etapa | Cantidad | Sin Avance | % Estancado | Dias Prom.
- Right: 2x2 mini-KPI grid (sin inspeccion, sin asignar, asignados sin inspeccionar, estancados).

**Section 5 — Detalle Resultados (wide table)**
```
Total | Bien Ejecutados | Mal Ejecutados | UT Cruzada | Mal Ingresado | Sin Acceso | Normal
```

### Tab 3: Detalle

**Filter Bar (2 rows)**
- Row 1: Zona, Comuna, Inspector, Resultado, Estado Medidor (all multi-select) + search + ExportDropdown
- Row 2: Active FilterChip tags + "Limpiar todo"

**Data Table**
```
Mes | Fecha Insp. | Num Cliente | Direccion | Comuna | Zona | Inspector | Estado Medidor | Resultado | EEPP OCA
```
- Badges: resultado (green/red/gray), estado_medidor (semantic colors)
- Pagination: 20/page
- Drill-through from other tabs via FilterChip

## Technical Changes

### Frontend
- Migrate all charts from Tremor to ECharts with chart-theme.ts
- Decompose page.tsx into components/:
  - KpiCard.tsx (reuse from NNCC)
  - InspectorModal.tsx
  - FilterChip.tsx (reuse from NNCC)
- Import HeroKpi, FeatureKpi, KpiCard, ProgressKpi from NNCC components
- Use EChart component from components/ui/EChart.tsx
- MultiSelect from components/ui/MultiSelect.tsx

### Backend
- Restructure stats endpoint to return pre-organized data for new tab layout
- Add inspector-focused stats (scatter data, ranking with dias_prom)
- Keep analisis-operacional endpoint (already good)
- Ensure all endpoints support zona/mes/anio filtering consistently

### Styling
- All cards: bg-white rounded-lg border border-slate-200/60 shadow-sm px-4 py-3
- Labels: text-[10px] uppercase tracking-wider text-slate-400
- Values: text-3xl font-bold (hero), text-2xl (feature), text-lg (standard)
- Tables: border-b border-slate-50, hover:bg-slate-50/80
- Charts: TOOLTIP_STYLE, GRID_STYLE, AXIS_STYLE, LEGEND_STYLE from chart-theme.ts
