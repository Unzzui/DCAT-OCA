# Medidores Cruzados Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure the Medidores Cruzados module from a monolithic Tremor-based page into a modular ECharts-based dashboard matching NNCC visual patterns, with 4 focused tabs.

**Architecture:** Reuse NNCC's shared components (HeroKpi, FeatureKpi, KpiCard, ProgressKpi, FilterChip, EChart). Create a new unified backend endpoint that returns all dashboard data in a single call. Frontend decomposes into tab components importing from chart-theme.ts.

**Tech Stack:** Next.js 14, ECharts via EChart component, Tailwind CSS, FastAPI, asyncio.gather SQL queries.

---

### Task 1: Backend — New Dashboard Endpoint

**Files:**
- Modify: `backend/app/services/medidores_cruzados_service.py`
- Modify: `backend/app/api/v1/medidores_cruzados.py`

**Step 1: Add `get_dashboard_all()` to service**

Add a new function in `medidores_cruzados_service.py` that returns all stats needed for the 4 tabs in a single call. It should combine data from `get_stats()` and `get_medidores_analisis_operacional()` but restructured for the new tab layout:

```python
@cached(ttl_seconds=60)
async def get_dashboard_all(
    zona: Optional[str] = None,
    mes: Optional[str] = None,
    anio: Optional[str] = None,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
) -> Dict[str, Any]:
    """Return all dashboard data for 4-tab MC layout."""
    where, params = _build_where(
        zona=zona, mes=mes, anio=anio, fecha_desde=fecha_desde, fecha_hasta=fecha_hasta,
    )

    # Run all queries in parallel
    (
        total_row,
        resultado_rows,
        zona_resultado_rows,
        estado_medidor_rows,
        inspector_full_rows,
        comuna_rows,
        evolucion_rows,
        tiempos_row,
        cuellos_rows,
        pendientes_row,
        evolucion_tiempos_rows,
        detalle_resultados_row,
    ) = await asyncio.gather(
        # 1. Total + bien/mal counts
        execute_query(f"""
            SELECT COUNT(*) as total,
                COUNT(*) FILTER (WHERE UPPER(resultado_inspeccion) LIKE '%%BIEN%%') as bien,
                COUNT(*) FILTER (WHERE UPPER(resultado_inspeccion) LIKE '%%MAL%%') as mal,
                COUNT(DISTINCT zona) as zonas_count,
                COUNT(DISTINCT TRIM(comuna)) FILTER (WHERE TRIM(COALESCE(comuna,'')) != '') as comunas_count,
                COUNT(DISTINCT inspector) FILTER (WHERE TRIM(COALESCE(inspector,'')) != '') as inspectores_count,
                COUNT(*) FILTER (WHERE fecha_inspeccion IS NULL) as pendientes_inspeccion
            FROM medidores_cruzados WHERE {where}
        """, params),
        # 2. Resultado distribution
        execute_query(f"""
            SELECT resultado_inspeccion, COUNT(*) as cantidad
            FROM medidores_cruzados WHERE {where} AND TRIM(COALESCE(resultado_inspeccion,'')) != ''
            GROUP BY resultado_inspeccion ORDER BY cantidad DESC
        """, params),
        # 3. Resultado por zona (stacked bar data)
        execute_query(f"""
            SELECT zona,
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE UPPER(resultado_inspeccion) LIKE '%%BIEN%%') as bien,
                COUNT(*) FILTER (WHERE UPPER(resultado_inspeccion) LIKE '%%MAL%%') as mal
            FROM medidores_cruzados WHERE {where} AND zona IS NOT NULL
            GROUP BY zona ORDER BY total DESC
        """, params),
        # 4. Estado medidor distribution
        execute_query(f"""
            SELECT estado_medidor, COUNT(*) as cantidad
            FROM medidores_cruzados WHERE {where} AND TRIM(COALESCE(estado_medidor,'')) != ''
            GROUP BY estado_medidor ORDER BY cantidad DESC
        """, params),
        # 5. Full inspector stats (for Inspectores tab)
        execute_query(f"""
            SELECT inspector,
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE UPPER(resultado_inspeccion) LIKE '%%BIEN%%') as bien,
                COUNT(*) FILTER (WHERE UPPER(resultado_inspeccion) LIKE '%%MAL%%') as mal,
                COUNT(DISTINCT zona) as zonas,
                COUNT(DISTINCT TRIM(comuna)) FILTER (WHERE TRIM(COALESCE(comuna,'')) != '') as comunas,
                ROUND(AVG(EXTRACT(DAY FROM fecha_inspeccion - fecha_correo))::numeric, 1) as dias_prom,
                ROUND(COUNT(*) FILTER (WHERE UPPER(resultado_inspeccion) LIKE '%%MAL%%') * 100.0 / NULLIF(COUNT(*), 0), 1) as tasa_mal,
                -- estado_medidor mas comun por inspector
                MODE() WITHIN GROUP (ORDER BY estado_medidor) as estado_principal
            FROM medidores_cruzados
            WHERE {where} AND TRIM(COALESCE(inspector,'')) != ''
            GROUP BY inspector ORDER BY total DESC
        """, params),
        # 6. Top comunas by tasa mal
        execute_query(f"""
            SELECT comuna, COUNT(*) as total,
                COUNT(*) FILTER (WHERE UPPER(resultado_inspeccion) LIKE '%%MAL%%') as mal,
                ROUND(COUNT(*) FILTER (WHERE UPPER(resultado_inspeccion) LIKE '%%MAL%%') * 100.0 / NULLIF(COUNT(*), 0), 1) as tasa_mal
            FROM medidores_cruzados WHERE {where} AND TRIM(COALESCE(comuna,'')) != ''
            GROUP BY comuna HAVING COUNT(*) >= 3
            ORDER BY tasa_mal DESC LIMIT 5
        """, params),
        # 7. Evolucion mensual
        execute_query(f"""
            SELECT TO_CHAR(fecha_inspeccion, 'YYYY-MM') as periodo,
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE UPPER(resultado_inspeccion) LIKE '%%BIEN%%') as bien,
                COUNT(*) FILTER (WHERE UPPER(resultado_inspeccion) LIKE '%%MAL%%') as mal
            FROM medidores_cruzados WHERE {where} AND fecha_inspeccion IS NOT NULL
            GROUP BY periodo ORDER BY periodo
        """, params),
        # 8. Tiempos de proceso (for Analisis Operacional)
        execute_query(f"""
            SELECT
                ROUND(AVG(EXTRACT(DAY FROM fecha_asignacion - fecha_correo))::numeric, 1) as correo_asignacion,
                ROUND(AVG(EXTRACT(DAY FROM fecha_analisis - fecha_asignacion))::numeric, 1) as asignacion_analisis,
                ROUND(AVG(EXTRACT(DAY FROM fecha_inspeccion - fecha_analisis))::numeric, 1) as analisis_inspeccion,
                ROUND(AVG(EXTRACT(DAY FROM fecha_inspeccion - fecha_correo))::numeric, 1) as total_dias,
                MAX(EXTRACT(DAY FROM fecha_inspeccion - fecha_correo)) as max_dias,
                MIN(EXTRACT(DAY FROM fecha_inspeccion - fecha_correo)) FILTER (WHERE fecha_inspeccion > fecha_correo) as min_dias,
                COUNT(*) FILTER (WHERE EXTRACT(DAY FROM fecha_inspeccion - fecha_correo) > 30) as mayor_30,
                COUNT(*) FILTER (WHERE EXTRACT(DAY FROM fecha_inspeccion - fecha_correo) > 60) as mayor_60,
                COUNT(*) as total
            FROM medidores_cruzados WHERE {where} AND fecha_correo IS NOT NULL AND fecha_inspeccion IS NOT NULL
        """, params),
        # 9. Cuellos de botella
        execute_query(f"""
            SELECT etapa_caso,
                COUNT(*) as cantidad,
                COUNT(*) FILTER (WHERE fecha_inspeccion IS NULL) as sin_inspeccion,
                ROUND(AVG(EXTRACT(DAY FROM COALESCE(fecha_inspeccion, CURRENT_DATE) - fecha_correo))::numeric, 1) as dias_promedio
            FROM medidores_cruzados WHERE {where} AND TRIM(COALESCE(etapa_caso,'')) != ''
            GROUP BY etapa_caso ORDER BY cantidad DESC
        """, params),
        # 10. Casos pendientes
        execute_query(f"""
            SELECT
                COUNT(*) FILTER (WHERE fecha_inspeccion IS NULL) as sin_inspeccion,
                COUNT(*) FILTER (WHERE fecha_asignacion IS NULL AND fecha_inspeccion IS NULL) as sin_asignar,
                COUNT(*) FILTER (WHERE fecha_asignacion IS NOT NULL AND fecha_inspeccion IS NULL AND EXTRACT(DAY FROM CURRENT_DATE - fecha_asignacion) > 15) as asignados_sin_inspeccionar,
                COUNT(*) FILTER (WHERE fecha_correo IS NOT NULL AND fecha_inspeccion IS NULL AND EXTRACT(DAY FROM CURRENT_DATE - fecha_correo) > 30) as estancados,
                COUNT(*) as total
            FROM medidores_cruzados WHERE {where}
        """, params),
        # 11. Evolucion tiempos por mes
        execute_query(f"""
            SELECT TO_CHAR(fecha_inspeccion, 'YYYY-MM') as periodo,
                COUNT(*) as total,
                ROUND(AVG(EXTRACT(DAY FROM fecha_inspeccion - fecha_correo))::numeric, 1) as dias_promedio,
                COUNT(*) FILTER (WHERE UPPER(resultado_inspeccion) LIKE '%%BIEN%%') as bien,
                COUNT(*) FILTER (WHERE UPPER(resultado_inspeccion) LIKE '%%MAL%%') as mal
            FROM medidores_cruzados WHERE {where} AND fecha_inspeccion IS NOT NULL AND fecha_correo IS NOT NULL
            GROUP BY periodo ORDER BY periodo DESC LIMIT 12
        """, params),
        # 12. Detalle resultados por estado
        execute_query(f"""
            SELECT
                COUNT(*) FILTER (WHERE UPPER(resultado_inspeccion) LIKE '%%MAL%%') as mal_ejecutados,
                COUNT(*) FILTER (WHERE UPPER(resultado_inspeccion) LIKE '%%BIEN%%') as bien_ejecutados,
                COUNT(*) FILTER (WHERE UPPER(estado_medidor) LIKE '%%NO ENCONTRADO%%') as no_encontrado,
                COUNT(*) FILTER (WHERE UPPER(estado_medidor) LIKE '%%MAL INGRESADO%%' OR UPPER(estado_medidor) LIKE '%%MAL CONFIGURADO%%') as mal_ingresado,
                COUNT(*) FILTER (WHERE UPPER(estado_medidor) LIKE '%%CRUZAD%%') as ut_cruzada,
                COUNT(*) FILTER (WHERE UPPER(estado_medidor) LIKE '%%SIN ACCESO%%') as sin_acceso,
                COUNT(*) FILTER (WHERE UPPER(estado_medidor) LIKE '%%NORMAL%%') as normal,
                COUNT(*) FILTER (WHERE TRIM(COALESCE(observacion_inspector,'')) = '') as sin_observacion,
                COUNT(*) as total
            FROM medidores_cruzados WHERE {where}
        """, params),
    )
```

Process all results into a structured response:

```python
    # Return structured response matching the 4-tab layout
    return {
        # === Tab 0: Resumen Ejecutivo ===
        "overview": {
            "kpis": {
                "total": total_row[0]["total"] if total_row else 0,
                "bien": total_row[0]["bien"] if total_row else 0,
                "mal": total_row[0]["mal"] if total_row else 0,
                "pct_mal": round(total_row[0]["mal"] / total_row[0]["total"] * 100, 1) if total_row and total_row[0]["total"] > 0 else 0,
                "pct_bien": round(total_row[0]["bien"] / total_row[0]["total"] * 100, 1) if total_row and total_row[0]["total"] > 0 else 0,
                "zonas_count": total_row[0]["zonas_count"] if total_row else 0,
                "comunas_count": total_row[0]["comunas_count"] if total_row else 0,
                "inspectores_count": total_row[0]["inspectores_count"] if total_row else 0,
                "pendientes_inspeccion": total_row[0]["pendientes_inspeccion"] if total_row else 0,
            },
            "resultado_por_zona": [
                {"zona": r["zona"], "total": r["total"], "bien": r["bien"], "mal": r["mal"],
                 "otros": r["total"] - r["bien"] - r["mal"]}
                for r in zona_resultado_rows
            ],
            "estado_medidor": [
                {"estado": r["estado_medidor"], "cantidad": r["cantidad"]}
                for r in estado_medidor_rows
            ],
            "top_comunas": [
                {"comuna": r["comuna"], "total": r["total"], "mal": r["mal"], "tasa_mal": float(r["tasa_mal"]) if r["tasa_mal"] else 0}
                for r in comuna_rows
            ],
            "evolucion_mensual": [
                {"periodo": r["periodo"], "total": r["total"], "bien": r["bien"], "mal": r["mal"],
                 "tasa_mal": round(r["mal"] / r["total"] * 100, 1) if r["total"] > 0 else 0}
                for r in evolucion_rows
            ],
        },
        # === Tab 1: Inspectores ===
        "inspectores": {
            "ranking": [
                {"inspector": r["inspector"], "total": r["total"], "bien": r["bien"], "mal": r["mal"],
                 "tasa_mal": float(r["tasa_mal"]) if r["tasa_mal"] else 0,
                 "zonas": r["zonas"], "comunas": r["comunas"],
                 "dias_prom": float(r["dias_prom"]) if r["dias_prom"] else 0,
                 "estado_principal": r["estado_principal"]}
                for r in inspector_full_rows
            ],
            "scatter": [
                {"inspector": r["inspector"], "volumen": r["total"],
                 "tasa_mal": float(r["tasa_mal"]) if r["tasa_mal"] else 0}
                for r in inspector_full_rows
            ],
        },
        # === Tab 2: Analisis Operacional ===
        "operacional": {
            "tiempos": _process_tiempos(tiempos_row),
            "cuellos_botella": [
                {"etapa": r["etapa_caso"], "cantidad": r["cantidad"],
                 "sin_inspeccion": r["sin_inspeccion"],
                 "dias_promedio": float(r["dias_promedio"]) if r["dias_promedio"] else 0,
                 "pct_estancado": round(r["sin_inspeccion"] / r["cantidad"] * 100, 1) if r["cantidad"] > 0 else 0}
                for r in (cuellos_rows or [])
            ],
            "pendientes": _process_pendientes(pendientes_row),
            "evolucion_tiempos": sorted([
                {"periodo": r["periodo"], "total": r["total"],
                 "dias_promedio": float(r["dias_promedio"]) if r["dias_promedio"] else 0,
                 "bien": r["bien"], "mal": r["mal"],
                 "tasa_bien": round(r["bien"] / r["total"] * 100, 1) if r["total"] > 0 else 0}
                for r in (evolucion_tiempos_rows or [])
            ], key=lambda x: x["periodo"]),
            "detalle_resultados": _process_detalle_resultados(detalle_resultados_row),
            "alertas": [],  # Generated below
        },
    }
```

Add helper functions `_process_tiempos()`, `_process_pendientes()`, `_process_detalle_resultados()` to extract these from query rows, plus the existing alert generation logic.

**Step 2: Add the API endpoint**

In `medidores_cruzados.py`, add:

```python
@router.get("/dashboard/all")
async def get_dashboard_all(
    zona: Optional[str] = Query(None),
    mes: Optional[str] = Query(None),
    anio: Optional[str] = Query(None),
    fecha_desde: Optional[str] = Query(None),
    fecha_hasta: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    return await medidores_cruzados_service.get_dashboard_all(
        zona=zona, mes=mes, anio=anio,
        fecha_desde=fecha_desde, fecha_hasta=fecha_hasta,
    )
```

**Step 3: Verify endpoint works**

Run: `curl -s http://localhost:8000/api/v1/medidores-cruzados/dashboard/all -H "Authorization: Bearer <token>" | python -m json.tool | head -50`
Expected: JSON with overview, inspectores, operacional keys.

**Step 4: Commit**

```bash
git add backend/app/services/medidores_cruzados_service.py backend/app/api/v1/medidores_cruzados.py
git commit -m "feat(mc): add unified dashboard endpoint for redesigned tabs"
```

---

### Task 2: Frontend — Types & Shared Imports

**Files:**
- Create: `frontend/src/app/dashboard/nuevas-conexiones/medidores-cruzados/types.ts`
- Create: `frontend/src/app/dashboard/nuevas-conexiones/medidores-cruzados/helpers.ts`

**Step 1: Create MC types**

```typescript
// types.ts
export interface MCDashboardData {
  overview: MCOverview
  inspectores: MCInspectores
  operacional: MCOperacional
}

export interface MCOverview {
  kpis: {
    total: number
    bien: number
    mal: number
    pct_mal: number
    pct_bien: number
    zonas_count: number
    comunas_count: number
    inspectores_count: number
    pendientes_inspeccion: number
  }
  resultado_por_zona: Array<{ zona: string; total: number; bien: number; mal: number; otros: number }>
  estado_medidor: Array<{ estado: string; cantidad: number }>
  top_comunas: Array<{ comuna: string; total: number; mal: number; tasa_mal: number }>
  evolucion_mensual: Array<{ periodo: string; total: number; bien: number; mal: number; tasa_mal: number }>
}

export interface MCInspectores {
  ranking: Array<{
    inspector: string; total: number; bien: number; mal: number
    tasa_mal: number; zonas: number; comunas: number
    dias_prom: number; estado_principal: string
  }>
  scatter: Array<{ inspector: string; volumen: number; tasa_mal: number }>
}

export interface MCOperacional {
  tiempos: {
    correo_asignacion: number; asignacion_analisis: number; analisis_inspeccion: number
    total_dias: number; max_dias: number; min_dias: number
    mayor_30: number; mayor_60: number; total: number
  }
  cuellos_botella: Array<{
    etapa: string; cantidad: number; sin_inspeccion: number
    dias_promedio: number; pct_estancado: number
  }>
  pendientes: {
    sin_inspeccion: number; sin_asignar: number
    asignados_sin_inspeccionar: number; estancados: number; total: number
  }
  evolucion_tiempos: Array<{
    periodo: string; total: number; dias_promedio: number
    bien: number; mal: number; tasa_bien: number
  }>
  detalle_resultados: {
    mal_ejecutados: number; bien_ejecutados: number; no_encontrado: number
    mal_ingresado: number; ut_cruzada: number; sin_acceso: number
    normal: number; sin_observacion: number; total: number
  }
  alertas: Array<{ tipo: string; titulo: string; mensaje: string }>
}

export interface MCDrillFilter {
  key: string
  label: string
  value: string
}
```

**Step 2: Create MC helpers**

```typescript
// helpers.ts
export function pct(val: number | undefined | null): string {
  if (val == null || isNaN(val)) return '–'
  return `${val.toFixed(1)}%`
}

export function estadoMedidorColor(estado: string): string {
  const s = estado?.toUpperCase() || ''
  if (s.includes('NORMAL')) return 'green'
  if (s.includes('MAL') || s.includes('CONFIGURADO')) return 'red'
  if (s.includes('CRUZAD')) return 'amber'
  if (s.includes('SIN ACCESO')) return 'slate'
  if (s.includes('NO ENCONTRADO')) return 'orange'
  return 'gray'
}

export const ESTADO_MEDIDOR_COLORS: Record<string, string> = {
  'MEDIDOR NORMAL': '#15803d',
  'MEDIDOR MAL INGRESADO EN SISTEMA': '#b91c1c',
  'CONCENTRADOR MAL CONFIGURADO': '#dc2626',
  'UT CRUZADA': '#92400e',
  'SIN ACCESO': '#64748b',
  'MEDIDOR NO ENCONTRADO': '#c2410c',
}
```

**Step 3: Commit**

```bash
git add frontend/src/app/dashboard/nuevas-conexiones/medidores-cruzados/types.ts frontend/src/app/dashboard/nuevas-conexiones/medidores-cruzados/helpers.ts
git commit -m "feat(mc): add TypeScript types and helpers for redesigned dashboard"
```

---

### Task 3: Frontend — Tab 0 Resumen Ejecutivo

**Files:**
- Create: `frontend/src/app/dashboard/nuevas-conexiones/medidores-cruzados/components/ResumenTab.tsx`

**Context:**
- Import `HeroKpi`, `KpiCard` from `../../components/KpiCard`
- Import `EChart` from `@/components/ui/EChart`
- Import all chart theme constants from `../../chart-theme`
- Import `pct` from `../helpers`

**Step 1: Build ResumenTab component**

The component receives `data: MCOverview` and `selectedZona`, `setSelectedZona` props.

Structure (matching NNCC exactly):

1. **Hero KPIs row** — `bg-white rounded-lg border border-slate-200/60 shadow-sm` card with `grid grid-cols-3 divide-x divide-slate-100`:
   - HeroKpi: Tasa Mal Ejecutado (sparkData from evolucion_mensual.map(e => e.tasa_mal))
   - HeroKpi: Total Inspecciones (sparkData from evolucion_mensual.map(e => e.total))
   - HeroKpi: Tasa Bien Ejecutado (sparkData from evolucion_mensual.map(e => 100 - e.tasa_mal))

2. **Operational KPIs row** — same card style, `grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-100`:
   - KpiCard: Zonas Activas
   - KpiCard: Comunas
   - KpiCard: Inspectores
   - KpiCard: Pend. Inspeccion (status amber/bad if > 0)

3. **Tendencia + Zona row** — `grid grid-cols-1 lg:grid-cols-5 gap-3`:
   - `lg:col-span-3`: EChart with dual-axis (bar Total + bar Mal on left axis, line % Tasa Mal on right axis 0-100%). Use `CHART_COLORS.primary` for Total bars, `CHART_COLORS.danger` for Mal bars, `CHART_COLORS.warning` for line. Use `TOOLTIP_STYLE`, `GRID_STYLE`, `AXIS_STYLE`, `LEGEND_STYLE`, `BAR_RADIUS`.
   - `lg:col-span-2`: EChart horizontal stacked bar for resultado_por_zona. Bien = `CHART_COLORS.success`, Mal = `CHART_COLORS.danger`, Otros = `CHART_COLORS.muted`. Click handler: `onEvents={{ click: (p) => setSelectedZona(p.name === selectedZona ? null : p.name) }}`. Opacity: selected zona 100%, others 25%.

4. **Estado Medidor + Top Comunas row** — `grid grid-cols-1 lg:grid-cols-5 gap-3`:
   - `lg:col-span-3`: EChart horizontal bars for estado_medidor distribution. Use `ESTADO_MEDIDOR_COLORS` for each bar. Labels 11px.
   - `lg:col-span-2`: EChart horizontal bars for top 5 comunas by tasa_mal. Color: red >50%, amber 30-50%, slate <30%.

Each chart wrapped in `bg-white rounded-lg border border-slate-200/60 shadow-sm px-4 py-3` with section title: `<p className="text-xs font-semibold text-slate-700 tracking-tight mb-3">Title</p>`.

**Step 2: Commit**

```bash
git add frontend/src/app/dashboard/nuevas-conexiones/medidores-cruzados/components/ResumenTab.tsx
git commit -m "feat(mc): implement Resumen Ejecutivo tab with ECharts"
```

---

### Task 4: Frontend — Tab 1 Inspectores

**Files:**
- Create: `frontend/src/app/dashboard/nuevas-conexiones/medidores-cruzados/components/InspectoresTab.tsx`

**Context:** Same imports as ResumenTab + `FeatureKpi`, `ProgressKpi`.

**Step 1: Build InspectoresTab component**

Receives `data: MCInspectores`, `overview: MCOverview`, `addDrillFilter: (key, label, value) => void`.

1. **Hero KPIs row** (3 cols):
   - HeroKpi: "Inspectores Activos" — value = ranking.length, subtitle = `en ${uniqueZonas} zonas`
   - HeroKpi: "Peor Tasa Mal" — value = pct(worstInspector.tasa_mal), subtitle = worstInspector.inspector, status = tasa >= 30 ? 'bad' : 'neutral'
   - HeroKpi: "Prom. Casos/Inspector" — value = Math.round(overview.kpis.total / ranking.length)

2. **Operational KPIs row** (4 cols):
   - KpiCard: Total Inspeccionadas — overview.kpis.total - overview.kpis.pendientes_inspeccion
   - KpiCard: Mal Ejecutados — `${overview.kpis.mal}` with subtitle `${pct(overview.kpis.pct_mal)} del total`
   - KpiCard: Dias Prom. Proceso — avg of ranking.map(r => r.dias_prom)
   - KpiCard: Sin Inspeccion — overview.kpis.pendientes_inspeccion, status red if > 0

3. **Scatter (60%) + Top 10 Bar (40%)**:
   - Left: EChart scatter — xAxis volumen, yAxis tasa_mal (0-100). Scatter series with `symbolSize: (val) => Math.max(8, val[0] / maxVol * 40)`. Red dashed markLine at y=30. Gray dashed markLine at x=avgVolumen. Use `CONTRATISTA_COLORS` per inspector. Tooltip shows inspector name, volumen, tasa_mal%.
   - Right: EChart horizontal bar — top 10 by tasa_mal. Color per bar: `itemStyle.color` = red >=30%, amber 15-30%, slate <15%. Label on right showing `${tasa_mal}%`.

4. **Distribucion por Zona (60%) + Causa Principal Table (40%)**:
   - Left: EChart stacked horizontal bar — top 8 inspectors × estado_medidor breakdown. Get top 3 estados globally, group rest as "Otros". Use `CONTRATISTA_COLORS` for each estado.
   - Right: HTML table — headers: Inspector | Estado Principal | Cantidad. `text-[10px] uppercase tracking-wider text-slate-500` for headers. Rows: `border-b border-slate-50 hover:bg-slate-50/80 cursor-pointer`. Click → `addDrillFilter('inspector', 'Inspector', row.inspector)`.

5. **Ranking Table** — full width card:
   - Headers: # | Inspector | Insp. | Mal Ej. | Tasa Mal | Zonas | Comunas | Dias Prom.
   - "Tasa Mal" column: thin bar (3px height, max normalized to highest tasa in view) + badge. Color: red >=30%, amber 15-30%, green <15%.
   - Click row → `addDrillFilter('inspector', 'Inspector', row.inspector)`.

**Step 2: Commit**

```bash
git add frontend/src/app/dashboard/nuevas-conexiones/medidores-cruzados/components/InspectoresTab.tsx
git commit -m "feat(mc): implement Inspectores tab with scatter and ranking"
```

---

### Task 5: Frontend — Tab 2 Analisis Operacional

**Files:**
- Create: `frontend/src/app/dashboard/nuevas-conexiones/medidores-cruzados/components/OperacionalTab.tsx`

**Step 1: Build OperacionalTab component**

Receives `data: MCOperacional`.

1. **Hero KPIs row** (3 cols):
   - HeroKpi: "Dias Prom. Total" — value = data.tiempos.total_dias, status = <=20 good, >30 bad
   - HeroKpi: "Casos Estancados" — value = data.pendientes.estancados, status = >0 bad
   - HeroKpi: "Tasa Resolucion" — value = pct((data.tiempos.total / (data.pendientes.total || 1)) * 100), status = >=80 good, <80 bad

2. **Operational KPIs row** (4 cols):
   - KpiCard: Correo→Asignacion — data.tiempos.correo_asignacion + " dias"
   - KpiCard: Asignacion→Analisis — data.tiempos.asignacion_analisis + " dias"
   - KpiCard: Analisis→Inspeccion — data.tiempos.analisis_inspeccion + " dias"
   - KpiCard: Casos >60 dias — data.tiempos.mayor_60, status red if > 0

3. **Evolucion Tiempos (60%) + Alertas (40%)**:
   - Left: EChart dual-axis — bars (dias_promedio) left axis + line (tasa_bien) right axis 0-100%. Use `CHART_COLORS.primary` for bars, `CHART_COLORS.success` for line. DataZoom if >12 entries.
   - Right: Alert cards — map data.alertas to styled cards. Border-left-4: danger → border-red-600, warning → border-amber-500, info → border-blue-500. White bg, icon (AlertTriangle for danger, AlertCircle for warning, Info for info from lucide-react). Title bold, message text-slate-600 text-[11px].

4. **Cuellos de Botella (60%) + Casos Pendientes (40%)**:
   - Left: HTML table — Etapa | Cantidad | Sin Avance | % Estancado | Dias Prom. Same styling as NNCC tables.
   - Right: 2x2 grid of mini-KPIs using `KpiCard`:
     - Sin Inspeccion
     - Sin Asignar
     - Asignados sin Insp.
     - Estancados >30d

5. **Detalle Resultados** — full width card with single data row:
   - Grid of 7 metric cells showing: Total | Bien Ejecutados | Mal Ejecutados | UT Cruzada | Mal Ingresado | Sin Acceso | Normal
   - Each cell: label (10px uppercase) + value (text-lg font-semibold) + badge color

**Step 2: Commit**

```bash
git add frontend/src/app/dashboard/nuevas-conexiones/medidores-cruzados/components/OperacionalTab.tsx
git commit -m "feat(mc): implement Analisis Operacional tab"
```

---

### Task 6: Frontend — Tab 3 Detalle

**Files:**
- Create: `frontend/src/app/dashboard/nuevas-conexiones/medidores-cruzados/components/DetalleTab.tsx`

**Context:** Reuse `FilterChip` from `../../components/FilterChip`, `MultiSelect` from `@/components/ui/MultiSelect`, `ExportDropdown` from `@/components/ui/ExportDropdown`.

**Step 1: Build DetalleTab component**

Receives props: `drillFilters`, `setDrillFilters`, `zonas`, `comunas`, `inspectors`, `estadosMedidor`, `globalFilters` (zona, mes, anio).

Internal state: `searchTerm`, `selectedZonas`, `selectedComunas`, `selectedInspectors`, `selectedEstados`, `selectedResultado`, `page`, `data`, `loading`.

1. **Filter Bar** — white card, 2 rows:
   - Row 1: `flex flex-wrap items-center gap-2`
     - Label: `text-[10px] uppercase tracking-wider text-slate-400 font-medium` "Filtrar:"
     - MultiSelect for Zona, Comuna, Inspector, Estado Medidor
     - Select for Resultado (Bien Ejecutado | Mal Ejecutado | Otro)
     - Search input: `border border-slate-200 rounded-md px-3 py-1.5 text-[11px]`
     - ExportDropdown
   - Row 2 (if drillFilters.length > 0): FilterChip tags + "Limpiar todo" button

2. **Data Table**:
   - Headers: Mes | Fecha Insp. | Num Cliente | Direccion | Comuna | Zona | Inspector | Estado Medidor | Resultado | EEPP OCA
   - Same styling as NNCC: `border-b border-slate-50 hover:bg-slate-50/80`
   - Resultado badge: green (BIEN), red (MAL), gray (other)
   - Estado Medidor: colored text using `estadoMedidorColor()`
   - Pagination: 20/page, "NNN reg. — pag. X/Y"

3. **Data fetching**: Use `api.get('/medidores-cruzados', { params })` with all filters. Refetch on filter change with debounce.

**Step 2: Commit**

```bash
git add frontend/src/app/dashboard/nuevas-conexiones/medidores-cruzados/components/DetalleTab.tsx
git commit -m "feat(mc): implement Detalle tab with filters and drill-through"
```

---

### Task 7: Frontend — Rewrite Main Page

**Files:**
- Rewrite: `frontend/src/app/dashboard/nuevas-conexiones/medidores-cruzados/page.tsx`

**Step 1: Rewrite page.tsx as orchestrator**

The page becomes a thin orchestrator (~200 lines) that:

1. **State**: `activeTab`, `selectedZona`, `drillFilters`, `dashboardData`, `loading`, `globalFilters` (zona, mes, anio), `filterOptions` (zonas, comunas, inspectors, estadosMedidor, periodos).

2. **Data loading**:
   - On mount: fetch `/medidores-cruzados/zonas`, `/medidores-cruzados/comunas`, `/medidores-cruzados/inspectors`, `/medidores-cruzados/estados-medidor`, `/medidores-cruzados/periodos` in parallel.
   - On filter change: fetch `/medidores-cruzados/dashboard/all` with globalFilters.

3. **Global filter bar** at top (same style as current): Ano, Mes, Zona dropdowns.

4. **Tab bar**: 4 tabs — Resumen Ejecutivo | Inspectores | Analisis Operacional | Detalle
   - Style: `flex gap-1 border-b border-slate-200` with each tab `px-4 py-2 text-[11px] font-medium uppercase tracking-wider`. Active: `text-slate-900 border-b-2 border-slate-900`. Inactive: `text-slate-400 hover:text-slate-600`.

5. **Tab content**: Conditionally render the tab component, passing relevant data slice.

6. **Drill-through handler**:
```typescript
const addDrillFilter = (key: string, label: string, value: string) => {
  setDrillFilters(prev => {
    const existing = prev.find(f => f.key === key)
    return existing
      ? prev.map(f => f.key === key ? { key, label, value } : f)
      : [...prev, { key, label, value }]
  })
  setActiveTab(3) // Go to Detalle
}
```

**Step 2: Remove old Tremor imports**

The rewritten page should NOT import any Tremor components (DonutChart, BarChart, AreaChart, ProgressBar, Badge, etc.). All charts use EChart. All KPIs use shared components.

**Step 3: Verify the page compiles and renders**

Run: `cd frontend && npm run build`
Expected: No TypeScript errors, page renders at `/dashboard/nuevas-conexiones/medidores-cruzados`.

**Step 4: Commit**

```bash
git add frontend/src/app/dashboard/nuevas-conexiones/medidores-cruzados/
git commit -m "feat(mc): rewrite page as thin orchestrator with 4-tab layout"
```

---

### Task 8: Integration Testing & Polish

**Files:**
- All MC frontend files
- Backend service

**Step 1: Verify all 4 tabs render with real data**

Navigate to each tab and verify:
- Tab 0: Hero KPIs show correct numbers, charts render, zona click filters work
- Tab 1: Scatter plot shows inspectors, ranking table populates, drill to Detalle works
- Tab 2: Tiempos show, alerts generate, cuellos de botella table fills
- Tab 3: Filters work, data loads, pagination works, drill filters from other tabs apply

**Step 2: Verify global filters (Ano, Mes, Zona) affect all tabs**

Change filters and confirm dashboard/all is re-fetched and all tabs update.

**Step 3: Verify export still works**

Click CSV/Excel export in Detalle tab, confirm file downloads with correct data.

**Step 4: Visual polish**

- Ensure all cards have consistent spacing (gap-3 between sections)
- Verify chart tooltips match NNCC style (white bg, slate border)
- Check responsive layout on narrower viewport (1024px)
- Confirm no Tremor components remain

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat(mc): complete redesign — 4-tab ECharts dashboard matching NNCC style"
```

---

## Task Dependency Graph

```
Task 1 (Backend) ─────────────────┐
Task 2 (Types/Helpers) ───────────┤
                                  ├──→ Task 7 (Main Page Rewrite)
Task 3 (Resumen Tab) ────────────┤      │
Task 4 (Inspectores Tab) ────────┤      ▼
Task 5 (Operacional Tab) ────────┤   Task 8 (Integration & Polish)
Task 6 (Detalle Tab) ────────────┘
```

Tasks 1-6 can be executed in parallel (backend + each tab component independently). Task 7 depends on all of them. Task 8 depends on Task 7.
