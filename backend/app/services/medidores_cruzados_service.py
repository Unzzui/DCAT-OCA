"""
Servicio de datos para el modulo de Medidores Cruzados.
Optimizado: queries SQL directas en vez de cargar DataFrames completos.
"""

import asyncio
from datetime import datetime, date
from typing import Optional, Dict, Any, List
from ..core.config import settings
from .db_queries import execute_query, execute_scalar
from .cache import cached


def _parse_date(date_str: Optional[str]) -> Optional[date]:
    """Convert date string to date object for asyncpg compatibility."""
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        return None


def _build_where(
    zona: Optional[str] = None,
    inspector: Optional[str] = None,
    estado_medidor: Optional[str] = None,
    comuna: Optional[str] = None,
    mes: Optional[str] = None,
    anio: Optional[str] = None,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
    search: Optional[str] = None,
) -> tuple[str, dict]:
    conditions = []
    params = {}

    if zona:
        conditions.append("UPPER(zona) = UPPER(:zona)")
        params["zona"] = zona
    if inspector:
        conditions.append("inspector ILIKE :inspector")
        params["inspector"] = f"%{inspector}%"
    if estado_medidor:
        conditions.append("estado_medidor ILIKE :estado_medidor")
        params["estado_medidor"] = f"%{estado_medidor}%"
    if comuna:
        conditions.append("UPPER(comuna) = UPPER(:comuna)")
        params["comuna"] = comuna
    if mes:
        conditions.append("UPPER(mes) = UPPER(:mes)")
        params["mes"] = mes
    if anio:
        conditions.append("EXTRACT(YEAR FROM fecha_inspeccion) = :anio")
        params["anio"] = int(anio)
    if fecha_desde:
        parsed_desde = _parse_date(fecha_desde)
        if parsed_desde:
            conditions.append("fecha_inspeccion >= :fecha_desde")
            params["fecha_desde"] = parsed_desde
    if fecha_hasta:
        parsed_hasta = _parse_date(fecha_hasta)
        if parsed_hasta:
            conditions.append("fecha_inspeccion <= :fecha_hasta")
            params["fecha_hasta"] = parsed_hasta
    if search:
        conditions.append(
            "(CAST(num_cliente AS TEXT) ILIKE :search OR comuna ILIKE :search "
            "OR inspector ILIKE :search OR direccion ILIKE :search "
            "OR medidor_sistema ILIKE :search)"
        )
        params["search"] = f"%{search}%"

    where = " AND ".join(conditions) if conditions else "1=1"
    return where, params


async def get_filtered_data(
    search: Optional[str] = None, zona: Optional[str] = None,
    inspector: Optional[str] = None, estado_medidor: Optional[str] = None,
    comuna: Optional[str] = None, mes: Optional[str] = None,
    anio: Optional[str] = None, fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None, page: int = 1, limit: int = 50,
    sort_by: str = "fecha_inspeccion", order: str = "desc"
) -> Dict[str, Any]:
    where, params = _build_where(
        zona=zona, inspector=inspector, estado_medidor=estado_medidor,
        comuna=comuna, mes=mes, anio=anio, fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta, search=search,
    )

    allowed_sort = {"fecha_inspeccion", "zona", "comuna", "inspector", "estado_medidor"}
    if sort_by not in allowed_sort:
        sort_by = "fecha_inspeccion"
    order_dir = "ASC" if order == "asc" else "DESC"

    total = await execute_scalar(f"SELECT COUNT(*) FROM medidores_cruzados WHERE {where}", params)
    offset = (page - 1) * limit
    params["limit"] = limit
    params["offset"] = offset

    rows = await execute_query(f"""
        SELECT mes, TO_CHAR(fecha_correo, 'YYYY-MM-DD') as fecha_correo,
               num_cliente, encargado_enel, area, etapa_caso,
               TO_CHAR(fecha_asignacion, 'YYYY-MM-DD') as fecha_asignacion,
               TO_CHAR(fecha_analisis, 'YYYY-MM-DD') as fecha_analisis,
               TO_CHAR(fecha_inspeccion, 'YYYY-MM-DD') as fecha_inspeccion,
               direccion, comuna, medidor_sistema, zona, eett,
               observacion_inspector, estado_medidor, inspector,
               resultado_inspeccion, eepp_oca
        FROM medidores_cruzados WHERE {where}
        ORDER BY {sort_by} {order_dir} NULLS LAST
        LIMIT :limit OFFSET :offset
    """, params)

    pages = (total + limit - 1) // limit if total else 0
    return {"items": rows, "total": total or 0, "page": page, "limit": limit, "pages": pages}


@cached(ttl_seconds=60)
async def get_stats(
    zona: Optional[str] = None,
    mes: Optional[str] = None,
    anio: Optional[str] = None,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
) -> Dict[str, Any]:
    where, params = _build_where(
        zona=zona, mes=mes, anio=anio, fecha_desde=fecha_desde, fecha_hasta=fecha_hasta,
    )

    empty_response = {
        "total": 0, "por_zona": {}, "por_inspector": [],
        "por_estado_medidor": {}, "por_resultado": {},
        "por_comuna": [], "por_mes": [], "por_etapa_caso": {},
        "evolucion_mensual": [],
    }

    # Run ALL queries in parallel using asyncio.gather
    (
        total,
        zona_rows,
        insp_rows,
        em_rows,
        res_rows,
        com_rows,
        mes_rows,
        etapa_rows,
        evol_rows,
    ) = await asyncio.gather(
        # Total count
        execute_scalar(
            f"SELECT COUNT(*) FROM medidores_cruzados WHERE {where}", params
        ),
        # Por zona
        execute_query(f"""
            SELECT zona, COUNT(*) as cantidad
            FROM medidores_cruzados WHERE {where} AND zona IS NOT NULL
            GROUP BY zona ORDER BY cantidad DESC
        """, params),
        # Por inspector (top 10)
        execute_query(f"""
            SELECT inspector, COUNT(*) as cantidad,
                COUNT(*) FILTER (WHERE UPPER(resultado_inspeccion) LIKE '%%BIEN%%') as bien
            FROM medidores_cruzados WHERE {where} AND TRIM(COALESCE(inspector,'')) != ''
            GROUP BY inspector ORDER BY cantidad DESC LIMIT 10
        """, params),
        # Por estado medidor
        execute_query(f"""
            SELECT estado_medidor, COUNT(*) as cantidad
            FROM medidores_cruzados WHERE {where} AND TRIM(COALESCE(estado_medidor,'')) != ''
            GROUP BY estado_medidor ORDER BY cantidad DESC LIMIT 10
        """, params),
        # Por resultado
        execute_query(f"""
            SELECT resultado_inspeccion, COUNT(*) as cantidad
            FROM medidores_cruzados WHERE {where} AND TRIM(COALESCE(resultado_inspeccion,'')) != ''
            GROUP BY resultado_inspeccion ORDER BY cantidad DESC
        """, params),
        # Por comuna (top 10)
        execute_query(f"""
            SELECT comuna, COUNT(*) as cantidad
            FROM medidores_cruzados WHERE {where} AND TRIM(COALESCE(comuna,'')) != ''
            GROUP BY comuna ORDER BY cantidad DESC LIMIT 10
        """, params),
        # Por mes
        execute_query(f"""
            SELECT UPPER(mes) as mes_name, COUNT(*) as cantidad
            FROM medidores_cruzados WHERE {where} AND TRIM(COALESCE(mes,'')) != ''
            GROUP BY UPPER(mes)
        """, params),
        # Por etapa caso
        execute_query(f"""
            SELECT etapa_caso, COUNT(*) as cantidad
            FROM medidores_cruzados WHERE {where} AND TRIM(COALESCE(etapa_caso,'')) != ''
            GROUP BY etapa_caso ORDER BY cantidad DESC
        """, params),
        # Evolucion mensual
        execute_query(f"""
            SELECT TO_CHAR(fecha_inspeccion, 'YYYY-MM') as mes_periodo,
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE UPPER(resultado_inspeccion) LIKE '%%BIEN%%') as bien_ejecutados,
                COUNT(*) FILTER (WHERE UPPER(resultado_inspeccion) LIKE '%%MAL%%') as mal_ejecutados
            FROM medidores_cruzados WHERE {where} AND fecha_inspeccion IS NOT NULL
            GROUP BY mes_periodo ORDER BY mes_periodo
        """, params),
    )

    # Early return if no data
    if not total:
        return empty_response

    # Process results
    por_zona = {r["zona"]: r["cantidad"] for r in zona_rows}

    por_inspector = [
        {"inspector": r["inspector"], "cantidad": r["cantidad"],
         "tasa_bien_ejecutado": round(r["bien"] / r["cantidad"] * 100, 1) if r["cantidad"] > 0 else 0}
        for r in insp_rows
    ]

    por_estado_medidor = {r["estado_medidor"]: r["cantidad"] for r in em_rows}

    por_resultado = {r["resultado_inspeccion"]: r["cantidad"] for r in res_rows}

    por_comuna = [{"comuna": r["comuna"], "cantidad": r["cantidad"]} for r in com_rows]

    mes_order = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
                 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
    mes_map = {r["mes_name"]: r["cantidad"] for r in mes_rows}
    por_mes = [{"mes": m, "cantidad": mes_map[m]} for m in mes_order if m in mes_map]

    por_etapa_caso = {r["etapa_caso"]: r["cantidad"] for r in etapa_rows}

    evolucion_mensual = [
        {"mes": r["mes_periodo"], "total": r["total"],
         "bien_ejecutados": r["bien_ejecutados"], "mal_ejecutados": r["mal_ejecutados"],
         "tasa_bien_ejecutado": round(r["bien_ejecutados"] / r["total"] * 100, 1) if r["total"] > 0 else 0}
        for r in evol_rows[-12:]
    ]

    return {
        "total": total, "por_zona": por_zona, "por_inspector": por_inspector,
        "por_estado_medidor": por_estado_medidor, "por_resultado": por_resultado,
        "por_comuna": por_comuna, "por_mes": por_mes, "por_etapa_caso": por_etapa_caso,
        "evolucion_mensual": evolucion_mensual,
    }


@cached(ttl_seconds=300)
async def get_comunas() -> List[str]:
    rows = await execute_query("SELECT DISTINCT TRIM(comuna) as comuna FROM medidores_cruzados WHERE TRIM(COALESCE(comuna,'')) != '' ORDER BY comuna")
    return [r["comuna"] for r in rows]


@cached(ttl_seconds=300)
async def get_zonas() -> List[str]:
    rows = await execute_query("SELECT DISTINCT zona FROM medidores_cruzados WHERE zona IS NOT NULL ORDER BY zona")
    return [r["zona"] for r in rows]


@cached(ttl_seconds=300)
async def get_inspectors() -> List[Dict[str, Any]]:
    rows = await execute_query("""
        SELECT inspector, COUNT(*) as cantidad,
            COUNT(*) FILTER (WHERE UPPER(resultado_inspeccion) LIKE '%%BIEN%%') as bien
        FROM medidores_cruzados WHERE TRIM(COALESCE(inspector,'')) != ''
        GROUP BY inspector ORDER BY cantidad DESC
    """)
    return [
        {"inspector": r["inspector"], "cantidad": r["cantidad"],
         "tasa_bien_ejecutado": round(r["bien"] / r["cantidad"] * 100, 1) if r["cantidad"] > 0 else 0}
        for r in rows
    ]


@cached(ttl_seconds=300)
async def get_estados_medidor() -> List[str]:
    rows = await execute_query("SELECT DISTINCT TRIM(estado_medidor) as estado_medidor FROM medidores_cruzados WHERE TRIM(COALESCE(estado_medidor,'')) != '' ORDER BY estado_medidor")
    return [r["estado_medidor"] for r in rows]


@cached(ttl_seconds=300)
async def get_periodos() -> Dict[str, Any]:
    rows, latest, meses_anio_rows = await asyncio.gather(
        execute_query("""
            SELECT
                ARRAY_AGG(DISTINCT EXTRACT(MONTH FROM fecha_inspeccion)::int ORDER BY EXTRACT(MONTH FROM fecha_inspeccion)::int)
                    FILTER (WHERE fecha_inspeccion IS NOT NULL) as meses,
                ARRAY_AGG(DISTINCT EXTRACT(YEAR FROM fecha_inspeccion)::int ORDER BY EXTRACT(YEAR FROM fecha_inspeccion)::int)
                    FILTER (WHERE fecha_inspeccion IS NOT NULL) as anios
            FROM medidores_cruzados
        """),
        execute_query("""
            SELECT EXTRACT(MONTH FROM fecha_inspeccion)::int as ultimo_mes,
                   EXTRACT(YEAR FROM fecha_inspeccion)::int as ultimo_anio
            FROM medidores_cruzados WHERE fecha_inspeccion IS NOT NULL
            ORDER BY fecha_inspeccion DESC LIMIT 1
        """),
        execute_query("""
            SELECT EXTRACT(YEAR FROM fecha_inspeccion)::int as anio,
                   ARRAY_AGG(DISTINCT EXTRACT(MONTH FROM fecha_inspeccion)::int ORDER BY EXTRACT(MONTH FROM fecha_inspeccion)::int) as meses
            FROM medidores_cruzados WHERE fecha_inspeccion IS NOT NULL
            GROUP BY anio ORDER BY anio
        """),
    )
    result: Dict[str, Any] = {"meses": [], "anios": [], "ultimo_mes": None, "ultimo_anio": None, "meses_por_anio": {}}
    if rows:
        result["meses"] = rows[0]["meses"] or []
        result["anios"] = rows[0]["anios"] or []
    if latest:
        result["ultimo_mes"] = latest[0]["ultimo_mes"]
        result["ultimo_anio"] = latest[0]["ultimo_anio"]
    if meses_anio_rows:
        result["meses_por_anio"] = {str(r["anio"]): r["meses"] or [] for r in meses_anio_rows}
    return result


@cached(ttl_seconds=60)
async def get_dashboard_all(
    zona: Optional[str] = None,
    mes: Optional[str] = None,
    anio: Optional[str] = None,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
) -> Dict[str, Any]:
    """Single endpoint that returns all dashboard data for 3 tabs: overview, inspectores, operacional."""
    where, params = _build_where(
        zona=zona, mes=mes, anio=anio, fecha_desde=fecha_desde, fecha_hasta=fecha_hasta,
    )

    # 12 parallel queries
    (
        kpi_row,
        resultado_por_zona,
        estado_medidor_rows,
        top_comunas_rows,
        evolucion_mensual_rows,
        inspector_ranking_rows,
        tiempos_proceso,
        cuellos_botella,
        casos_pendientes,
        evolucion_tiempos_rows,
        detalle_resultados_row,
        counts_row,
    ) = await asyncio.gather(
        # 1) KPIs principales
        execute_query(f"""
            SELECT
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE UPPER(resultado_inspeccion) LIKE '%%BIEN%%') as bien,
                COUNT(*) FILTER (WHERE UPPER(resultado_inspeccion) LIKE '%%MAL%%') as mal,
                COUNT(*) FILTER (WHERE fecha_inspeccion IS NULL) as pendientes_inspeccion
            FROM medidores_cruzados WHERE {where}
        """, params),
        # 2) Resultado por zona
        execute_query(f"""
            SELECT zona,
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE UPPER(resultado_inspeccion) LIKE '%%BIEN%%') as bien,
                COUNT(*) FILTER (WHERE UPPER(resultado_inspeccion) LIKE '%%MAL%%') as mal,
                COUNT(*) FILTER (
                    WHERE UPPER(resultado_inspeccion) NOT LIKE '%%BIEN%%'
                      AND UPPER(resultado_inspeccion) NOT LIKE '%%MAL%%'
                ) as otros
            FROM medidores_cruzados
            WHERE {where} AND zona IS NOT NULL
            GROUP BY zona ORDER BY total DESC
        """, params),
        # 3) Estado medidor
        execute_query(f"""
            SELECT estado_medidor as estado, COUNT(*) as cantidad
            FROM medidores_cruzados
            WHERE {where} AND TRIM(COALESCE(estado_medidor,'')) != ''
            GROUP BY estado_medidor ORDER BY cantidad DESC
        """, params),
        # 4) Top comunas (>= 3 cases, by tasa_mal)
        execute_query(f"""
            SELECT comuna,
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE UPPER(resultado_inspeccion) LIKE '%%MAL%%') as mal,
                ROUND(
                    COUNT(*) FILTER (WHERE UPPER(resultado_inspeccion) LIKE '%%MAL%%') * 100.0
                    / NULLIF(COUNT(*), 0), 1
                ) as tasa_mal
            FROM medidores_cruzados
            WHERE {where} AND TRIM(COALESCE(comuna,'')) != ''
            GROUP BY comuna
            HAVING COUNT(*) >= 3
            ORDER BY tasa_mal DESC
            LIMIT 5
        """, params),
        # 5) Evolucion mensual (overview)
        execute_query(f"""
            SELECT TO_CHAR(fecha_inspeccion, 'YYYY-MM') as periodo,
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE UPPER(resultado_inspeccion) LIKE '%%BIEN%%') as bien,
                COUNT(*) FILTER (WHERE UPPER(resultado_inspeccion) LIKE '%%MAL%%') as mal,
                ROUND(
                    COUNT(*) FILTER (WHERE UPPER(resultado_inspeccion) LIKE '%%MAL%%') * 100.0
                    / NULLIF(COUNT(*), 0), 1
                ) as tasa_mal
            FROM medidores_cruzados
            WHERE {where} AND fecha_inspeccion IS NOT NULL
            GROUP BY periodo ORDER BY periodo
        """, params),
        # 6) Inspector ranking with MODE for estado_principal
        execute_query(f"""
            SELECT inspector,
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE UPPER(resultado_inspeccion) LIKE '%%BIEN%%') as bien,
                COUNT(*) FILTER (WHERE UPPER(resultado_inspeccion) LIKE '%%MAL%%') as mal,
                ROUND(
                    COUNT(*) FILTER (WHERE UPPER(resultado_inspeccion) LIKE '%%MAL%%') * 100.0
                    / NULLIF(COUNT(*), 0), 1
                ) as tasa_mal,
                COUNT(DISTINCT zona) as zonas,
                COUNT(DISTINCT comuna) as comunas,
                ROUND(AVG(EXTRACT(DAY FROM fecha_inspeccion - fecha_asignacion))::numeric, 1) as dias_prom,
                MODE() WITHIN GROUP (ORDER BY estado_medidor) as estado_principal
            FROM medidores_cruzados
            WHERE {where} AND TRIM(COALESCE(inspector,'')) != ''
            GROUP BY inspector
            ORDER BY total DESC
        """, params),
        # 7) Tiempos de proceso (operacional)
        execute_query(f"""
            SELECT
                ROUND(AVG(EXTRACT(DAY FROM fecha_asignacion - fecha_correo))::numeric, 1) as dias_correo_asignacion,
                ROUND(AVG(EXTRACT(DAY FROM fecha_inspeccion - fecha_asignacion))::numeric, 1) as dias_asignacion_inspeccion,
                ROUND(AVG(EXTRACT(DAY FROM fecha_analisis - fecha_inspeccion))::numeric, 1) as dias_inspeccion_analisis,
                ROUND(AVG(EXTRACT(DAY FROM fecha_analisis - fecha_correo))::numeric, 1) as dias_total,
                MAX(EXTRACT(DAY FROM fecha_analisis - fecha_correo)) as dias_max,
                MIN(EXTRACT(DAY FROM fecha_analisis - fecha_correo)) FILTER (WHERE fecha_analisis > fecha_correo) as dias_min,
                COUNT(*) FILTER (WHERE EXTRACT(DAY FROM fecha_analisis - fecha_correo) > 30) as casos_mayor_30_dias,
                COUNT(*) FILTER (WHERE EXTRACT(DAY FROM fecha_analisis - fecha_correo) > 60) as casos_mayor_60_dias,
                COUNT(*) as total
            FROM medidores_cruzados
            WHERE {where} AND fecha_correo IS NOT NULL AND fecha_analisis IS NOT NULL
        """, params),
        # 8) Cuellos de botella por etapa
        execute_query(f"""
            SELECT etapa_caso,
                COUNT(*) as cantidad,
                COUNT(*) FILTER (WHERE fecha_inspeccion IS NULL) as sin_inspeccion,
                ROUND(AVG(EXTRACT(DAY FROM COALESCE(fecha_inspeccion, CURRENT_DATE) - fecha_correo))::numeric, 1) as dias_promedio
            FROM medidores_cruzados
            WHERE {where} AND TRIM(COALESCE(etapa_caso,'')) != ''
            GROUP BY etapa_caso
            ORDER BY cantidad DESC
        """, params),
        # 9) Casos pendientes
        execute_query(f"""
            SELECT
                COUNT(*) FILTER (WHERE fecha_inspeccion IS NULL) as sin_inspeccion,
                COUNT(*) FILTER (WHERE fecha_asignacion IS NULL AND fecha_inspeccion IS NULL) as sin_asignar,
                COUNT(*) FILTER (WHERE
                    fecha_asignacion IS NOT NULL AND fecha_inspeccion IS NULL AND
                    EXTRACT(DAY FROM CURRENT_DATE - fecha_asignacion) > 15
                ) as asignados_sin_inspeccionar,
                COUNT(*) FILTER (WHERE
                    fecha_correo IS NOT NULL AND fecha_inspeccion IS NULL AND
                    EXTRACT(DAY FROM CURRENT_DATE - fecha_correo) > 30
                ) as estancados_mayor_30_dias,
                COUNT(*) as total
            FROM medidores_cruzados WHERE {where}
        """, params),
        # 10) Evolucion tiempos (operacional)
        execute_query(f"""
            SELECT TO_CHAR(fecha_inspeccion, 'YYYY-MM') as periodo,
                COUNT(*) as total,
                ROUND(AVG(EXTRACT(DAY FROM fecha_analisis - fecha_correo))::numeric, 1) as dias_promedio,
                COUNT(*) FILTER (WHERE UPPER(resultado_inspeccion) LIKE '%%BIEN%%') as bien,
                COUNT(*) FILTER (WHERE UPPER(resultado_inspeccion) LIKE '%%MAL%%') as mal
            FROM medidores_cruzados
            WHERE {where} AND fecha_inspeccion IS NOT NULL AND fecha_correo IS NOT NULL
            GROUP BY periodo
            ORDER BY periodo DESC
            LIMIT 12
        """, params),
        # 11) Detalle resultados (operacional)
        execute_query(f"""
            SELECT
                COUNT(*) FILTER (WHERE UPPER(resultado_inspeccion) LIKE '%%MAL%%') as mal_ejecutados,
                COUNT(*) FILTER (WHERE UPPER(resultado_inspeccion) LIKE '%%BIEN%%') as bien_ejecutados,
                COUNT(*) FILTER (WHERE UPPER(estado_medidor) LIKE '%%NO ENCONTRADO%%' OR UPPER(estado_medidor) LIKE '%%NO SE ENCUENTRA%%') as no_encontrado,
                COUNT(*) FILTER (WHERE UPPER(estado_medidor) LIKE '%%MAL INGRESADO%%' OR UPPER(estado_medidor) LIKE '%%DIFERENTE%%' OR UPPER(estado_medidor) LIKE '%%DISTINTO%%') as mal_ingresado,
                COUNT(*) FILTER (WHERE UPPER(estado_medidor) LIKE '%%CRUZADO%%') as ut_cruzada,
                COUNT(*) FILTER (WHERE UPPER(estado_medidor) LIKE '%%SIN ACCESO%%') as sin_acceso,
                COUNT(*) FILTER (WHERE UPPER(estado_medidor) LIKE '%%NORMAL%%') as normal,
                COUNT(*) FILTER (WHERE TRIM(COALESCE(observacion_inspector,'')) = '') as sin_observacion,
                COUNT(*) as total
            FROM medidores_cruzados WHERE {where}
        """, params),
        # 12) Distinct counts for KPIs
        execute_query(f"""
            SELECT
                COUNT(DISTINCT zona) FILTER (WHERE zona IS NOT NULL) as zonas_count,
                COUNT(DISTINCT comuna) FILTER (WHERE TRIM(COALESCE(comuna,'')) != '') as comunas_count,
                COUNT(DISTINCT inspector) FILTER (WHERE TRIM(COALESCE(inspector,'')) != '') as inspectores_count
            FROM medidores_cruzados WHERE {where}
        """, params),
    )

    # --- OVERVIEW ---
    kpi = kpi_row[0] if kpi_row else {"total": 0, "bien": 0, "mal": 0, "pendientes_inspeccion": 0}
    counts = counts_row[0] if counts_row else {"zonas_count": 0, "comunas_count": 0, "inspectores_count": 0}
    total = kpi["total"] or 0

    overview = {
        "kpis": {
            "total": total,
            "bien": kpi["bien"] or 0,
            "mal": kpi["mal"] or 0,
            "pct_mal": round((kpi["mal"] or 0) / total * 100, 1) if total > 0 else 0,
            "pct_bien": round((kpi["bien"] or 0) / total * 100, 1) if total > 0 else 0,
            "zonas_count": counts["zonas_count"] or 0,
            "comunas_count": counts["comunas_count"] or 0,
            "inspectores_count": counts["inspectores_count"] or 0,
            "pendientes_inspeccion": kpi["pendientes_inspeccion"] or 0,
        },
        "resultado_por_zona": [
            {"zona": r["zona"], "total": r["total"], "bien": r["bien"], "mal": r["mal"], "otros": r["otros"]}
            for r in (resultado_por_zona or [])
        ],
        "estado_medidor": [
            {"estado": r["estado"], "cantidad": r["cantidad"]}
            for r in (estado_medidor_rows or [])
        ],
        "top_comunas": [
            {"comuna": r["comuna"], "total": r["total"], "mal": r["mal"],
             "tasa_mal": float(r["tasa_mal"]) if r["tasa_mal"] else 0}
            for r in (top_comunas_rows or [])
        ],
        "evolucion_mensual": [
            {"periodo": r["periodo"], "total": r["total"], "bien": r["bien"], "mal": r["mal"],
             "tasa_mal": float(r["tasa_mal"]) if r["tasa_mal"] else 0}
            for r in (evolucion_mensual_rows or [])[-12:]
        ],
    }

    # --- INSPECTORES ---
    ranking = []
    scatter = []
    for r in (inspector_ranking_rows or []):
        ranking.append({
            "inspector": r["inspector"],
            "total": r["total"],
            "bien": r["bien"],
            "mal": r["mal"],
            "tasa_mal": float(r["tasa_mal"]) if r["tasa_mal"] else 0,
            "zonas": r["zonas"],
            "comunas": r["comunas"],
            "dias_prom": float(r["dias_prom"]) if r["dias_prom"] else 0,
            "estado_principal": r["estado_principal"] or "",
        })
        scatter.append({
            "inspector": r["inspector"],
            "volumen": r["total"],
            "tasa_mal": float(r["tasa_mal"]) if r["tasa_mal"] else 0,
        })

    inspectores = {
        "ranking": ranking,
        "scatter": scatter,
    }

    # --- OPERACIONAL ---
    # Tiempos
    tiempos = {
        "correo_asignacion": 0, "asignacion_inspeccion": 0, "inspeccion_analisis": 0,
        "total_dias": 0, "max_dias": 0, "min_dias": 0,
        "mayor_30": 0, "mayor_60": 0, "total": 0,
    }
    if tiempos_proceso and tiempos_proceso[0]["total"] > 0:
        t = tiempos_proceso[0]
        tiempos = {
            "correo_asignacion": float(t["dias_correo_asignacion"]) if t["dias_correo_asignacion"] else 0,
            "asignacion_inspeccion": float(t["dias_asignacion_inspeccion"]) if t["dias_asignacion_inspeccion"] else 0,
            "inspeccion_analisis": float(t["dias_inspeccion_analisis"]) if t["dias_inspeccion_analisis"] else 0,
            "total_dias": float(t["dias_total"]) if t["dias_total"] else 0,
            "max_dias": int(t["dias_max"]) if t["dias_max"] else 0,
            "min_dias": int(t["dias_min"]) if t["dias_min"] else 0,
            "mayor_30": t["casos_mayor_30_dias"] or 0,
            "mayor_60": t["casos_mayor_60_dias"] or 0,
            "total": t["total"],
        }

    # Cuellos de botella
    cuellos = []
    for r in (cuellos_botella or []):
        cuellos.append({
            "etapa": r["etapa_caso"],
            "cantidad": r["cantidad"],
            "sin_inspeccion": r["sin_inspeccion"],
            "dias_promedio": float(r["dias_promedio"]) if r["dias_promedio"] else 0,
            "pct_estancado": round(r["sin_inspeccion"] / r["cantidad"] * 100, 1) if r["cantidad"] > 0 else 0,
        })

    # Pendientes
    pendientes = {"sin_inspeccion": 0, "sin_asignar": 0, "asignados_sin_inspeccionar": 0, "estancados": 0, "total": 0}
    if casos_pendientes and casos_pendientes[0]["total"] > 0:
        p = casos_pendientes[0]
        pendientes = {
            "sin_inspeccion": p["sin_inspeccion"] or 0,
            "sin_asignar": p["sin_asignar"] or 0,
            "asignados_sin_inspeccionar": p["asignados_sin_inspeccionar"] or 0,
            "estancados": p["estancados_mayor_30_dias"] or 0,
            "total": p["total"],
        }

    # Evolucion tiempos
    evolucion = []
    for r in sorted(evolucion_tiempos_rows or [], key=lambda x: x["periodo"]):
        evolucion.append({
            "periodo": r["periodo"],
            "total": r["total"],
            "dias_promedio": float(r["dias_promedio"]) if r["dias_promedio"] else 0,
            "bien": r["bien"],
            "mal": r["mal"],
            "tasa_bien": round(r["bien"] / r["total"] * 100, 1) if r["total"] > 0 else 0,
        })

    # Detalle resultados
    detalle = {
        "mal_ejecutados": 0, "bien_ejecutados": 0, "no_encontrado": 0,
        "mal_ingresado": 0, "ut_cruzada": 0, "sin_acceso": 0,
        "normal": 0, "sin_observacion": 0, "total": 0,
    }
    if detalle_resultados_row and detalle_resultados_row[0]["total"] > 0:
        d = detalle_resultados_row[0]
        detalle = {
            "mal_ejecutados": d["mal_ejecutados"] or 0,
            "bien_ejecutados": d["bien_ejecutados"] or 0,
            "no_encontrado": d["no_encontrado"] or 0,
            "mal_ingresado": d["mal_ingresado"] or 0,
            "ut_cruzada": d["ut_cruzada"] or 0,
            "sin_acceso": d["sin_acceso"] or 0,
            "normal": d["normal"] or 0,
            "sin_observacion": d["sin_observacion"] or 0,
            "total": d["total"],
        }

    # Alertas operacionales
    alertas = []
    if tiempos["total_dias"] > 45:
        alertas.append({
            "tipo": "danger",
            "titulo": "Tiempos de proceso criticos",
            "mensaje": f"Promedio de {tiempos['total_dias']} dias desde correo hasta inspeccion.",
        })
    elif tiempos["total_dias"] > 30:
        alertas.append({
            "tipo": "warning",
            "titulo": "Tiempos de proceso elevados",
            "mensaje": f"Promedio de {tiempos['total_dias']} dias desde correo hasta inspeccion.",
        })
    if tiempos["mayor_60"] > 0:
        pct = round(tiempos["mayor_60"] / tiempos["total"] * 100, 1) if tiempos["total"] > 0 else 0
        alertas.append({
            "tipo": "danger" if tiempos["mayor_60"] > 5 else "warning",
            "titulo": f"{tiempos['mayor_60']} casos con mas de 60 dias",
            "mensaje": f"{pct}% de los casos con mas de 60 dias en proceso.",
        })
    if pendientes["estancados"] > 10:
        alertas.append({
            "tipo": "warning" if pendientes["estancados"] <= 20 else "danger",
            "titulo": f"{pendientes['estancados']} casos en espera",
            "mensaje": "Casos pendientes de inspeccion con mas de 30 dias desde el correo.",
        })
    if detalle["total"] > 0 and detalle["mal_ejecutados"] / detalle["total"] > 0.2:
        pct = round(detalle["mal_ejecutados"] / detalle["total"] * 100, 1)
        alertas.append({
            "tipo": "danger" if pct > 30 else "warning",
            "titulo": f"{pct}% de inspecciones para revision",
            "mensaje": f"{detalle['mal_ejecutados']} casos con resultado 'mal ejecutado'.",
        })
    if detalle["sin_observacion"] > detalle["total"] * 0.2:
        alertas.append({
            "tipo": "info",
            "titulo": "Documentacion pendiente",
            "mensaje": f"{detalle['sin_observacion']} inspecciones sin observaciones del inspector.",
        })
    # Inspectores con oportunidad de mejora
    mejora = [i for i in ranking if i["tasa_mal"] > 40 and i["total"] >= 5]
    if mejora:
        nombres = ", ".join([p["inspector"] for p in mejora[:3]])
        alertas.append({
            "tipo": "warning",
            "titulo": "Inspectores con oportunidad de mejora",
            "mensaje": f"Tasa mal > 40%: {nombres}.",
        })

    operacional = {
        "tiempos": tiempos,
        "cuellos_botella": cuellos,
        "pendientes": pendientes,
        "evolucion_tiempos": evolucion,
        "detalle_resultados": detalle,
        "alertas": alertas,
    }

    return {
        "overview": overview,
        "inspectores": inspectores,
        "operacional": operacional,
    }


@cached(ttl_seconds=60)
async def get_medidores_analisis_operacional(
    zona: Optional[str] = None,
    mes: Optional[str] = None,
    anio: Optional[str] = None,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
) -> Dict[str, Any]:
    """Análisis operacional detallado: tiempos, cuellos de botella, inspecciones mal ejecutadas."""
    where, params = _build_where(
        zona=zona, mes=mes, anio=anio, fecha_desde=fecha_desde, fecha_hasta=fecha_hasta,
    )

    (
        tiempos_proceso,
        cuellos_botella,
        mal_ejecutados_detalle,
        ranking_inspectores,
        casos_pendientes,
        evolucion_tiempos,
    ) = await asyncio.gather(
        # 1) Análisis de tiempos de proceso
        execute_query(f"""
            SELECT
                ROUND(AVG(EXTRACT(DAY FROM fecha_asignacion - fecha_correo))::numeric, 1) as dias_correo_asignacion,
                ROUND(AVG(EXTRACT(DAY FROM fecha_inspeccion - fecha_asignacion))::numeric, 1) as dias_asignacion_inspeccion,
                ROUND(AVG(EXTRACT(DAY FROM fecha_analisis - fecha_inspeccion))::numeric, 1) as dias_inspeccion_analisis,
                ROUND(AVG(EXTRACT(DAY FROM fecha_analisis - fecha_correo))::numeric, 1) as dias_total,
                MAX(EXTRACT(DAY FROM fecha_analisis - fecha_correo)) as dias_max,
                MIN(EXTRACT(DAY FROM fecha_analisis - fecha_correo)) FILTER (WHERE fecha_analisis > fecha_correo) as dias_min,
                COUNT(*) FILTER (WHERE EXTRACT(DAY FROM fecha_analisis - fecha_correo) > 30) as casos_mayor_30_dias,
                COUNT(*) FILTER (WHERE EXTRACT(DAY FROM fecha_analisis - fecha_correo) > 60) as casos_mayor_60_dias,
                COUNT(*) as total
            FROM medidores_cruzados
            WHERE {where} AND fecha_correo IS NOT NULL AND fecha_analisis IS NOT NULL
        """, params),
        # 2) Identificar cuellos de botella por etapa
        execute_query(f"""
            SELECT etapa_caso,
                COUNT(*) as cantidad,
                COUNT(*) FILTER (WHERE fecha_inspeccion IS NULL) as sin_inspeccion,
                ROUND(AVG(EXTRACT(DAY FROM COALESCE(fecha_inspeccion, CURRENT_DATE) - fecha_correo))::numeric, 1) as dias_promedio
            FROM medidores_cruzados
            WHERE {where} AND TRIM(COALESCE(etapa_caso,'')) != ''
            GROUP BY etapa_caso
            ORDER BY cantidad DESC
        """, params),
        # 3) Detalle de casos mal ejecutados
        execute_query(f"""
            SELECT
                COUNT(*) FILTER (WHERE UPPER(resultado_inspeccion) LIKE '%%MAL%%') as mal_ejecutados,
                COUNT(*) FILTER (WHERE UPPER(resultado_inspeccion) LIKE '%%BIEN%%') as bien_ejecutados,
                COUNT(*) FILTER (WHERE UPPER(estado_medidor) LIKE '%%NO ENCONTRADO%%' OR UPPER(estado_medidor) LIKE '%%NO SE ENCUENTRA%%') as medidor_no_encontrado,
                COUNT(*) FILTER (WHERE UPPER(estado_medidor) LIKE '%%DIFERENTE%%' OR UPPER(estado_medidor) LIKE '%%DISTINTO%%') as medidor_diferente,
                COUNT(*) FILTER (WHERE UPPER(estado_medidor) LIKE '%%CRUZADO%%') as medidor_cruzado_confirmado,
                COUNT(*) FILTER (WHERE TRIM(COALESCE(observacion_inspector,'')) = '') as sin_observacion,
                COUNT(*) as total
            FROM medidores_cruzados WHERE {where}
        """, params),
        # 4) Ranking de inspectores con métricas detalladas
        execute_query(f"""
            SELECT inspector,
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE UPPER(resultado_inspeccion) LIKE '%%BIEN%%') as bien_ejecutados,
                COUNT(*) FILTER (WHERE UPPER(resultado_inspeccion) LIKE '%%MAL%%') as mal_ejecutados,
                ROUND(AVG(EXTRACT(DAY FROM fecha_inspeccion - fecha_asignacion))::numeric, 1) as dias_promedio,
                COUNT(DISTINCT zona) as zonas_atendidas,
                COUNT(*) FILTER (WHERE TRIM(COALESCE(observacion_inspector,'')) = '') as sin_observacion,
                ROUND(COUNT(*) FILTER (WHERE UPPER(resultado_inspeccion) LIKE '%%BIEN%%') * 100.0 / NULLIF(COUNT(*), 0), 1) as tasa_bien_ejecutado
            FROM medidores_cruzados
            WHERE {where} AND TRIM(COALESCE(inspector,'')) != ''
            GROUP BY inspector
            HAVING COUNT(*) >= 3
            ORDER BY total DESC
        """, params),
        # 5) Casos pendientes o estancados
        execute_query(f"""
            SELECT
                COUNT(*) FILTER (WHERE fecha_inspeccion IS NULL) as sin_inspeccion,
                COUNT(*) FILTER (WHERE fecha_asignacion IS NULL AND fecha_inspeccion IS NULL) as sin_asignar,
                COUNT(*) FILTER (WHERE
                    fecha_asignacion IS NOT NULL AND fecha_inspeccion IS NULL AND
                    EXTRACT(DAY FROM CURRENT_DATE - fecha_asignacion) > 15
                ) as asignados_sin_inspeccionar,
                COUNT(*) FILTER (WHERE
                    fecha_correo IS NOT NULL AND fecha_inspeccion IS NULL AND
                    EXTRACT(DAY FROM CURRENT_DATE - fecha_correo) > 30
                ) as estancados_mayor_30_dias,
                COUNT(*) as total
            FROM medidores_cruzados WHERE {where}
        """, params),
        # 6) Evolución de tiempos de resolución por mes
        execute_query(f"""
            SELECT TO_CHAR(fecha_inspeccion, 'YYYY-MM') as periodo,
                COUNT(*) as total,
                ROUND(AVG(EXTRACT(DAY FROM fecha_analisis - fecha_correo))::numeric, 1) as dias_promedio,
                COUNT(*) FILTER (WHERE UPPER(resultado_inspeccion) LIKE '%%BIEN%%') as bien_ejecutados,
                COUNT(*) FILTER (WHERE UPPER(resultado_inspeccion) LIKE '%%MAL%%') as mal_ejecutados
            FROM medidores_cruzados
            WHERE {where} AND fecha_inspeccion IS NOT NULL AND fecha_correo IS NOT NULL
            GROUP BY periodo
            ORDER BY periodo DESC
            LIMIT 12
        """, params),
    )

    # Procesar tiempos de proceso
    tiempos = {
        "correo_asignacion": 0, "asignacion_inspeccion": 0, "inspeccion_analisis": 0,
        "total_dias": 0, "max_dias": 0, "min_dias": 0,
        "casos_mayor_30": 0, "casos_mayor_60": 0, "total": 0,
    }
    if tiempos_proceso and tiempos_proceso[0]["total"] > 0:
        t = tiempos_proceso[0]
        tiempos = {
            "correo_asignacion": float(t["dias_correo_asignacion"]) if t["dias_correo_asignacion"] else 0,
            "asignacion_inspeccion": float(t["dias_asignacion_inspeccion"]) if t["dias_asignacion_inspeccion"] else 0,
            "inspeccion_analisis": float(t["dias_inspeccion_analisis"]) if t["dias_inspeccion_analisis"] else 0,
            "total_dias": float(t["dias_total"]) if t["dias_total"] else 0,
            "max_dias": int(t["dias_max"]) if t["dias_max"] else 0,
            "min_dias": int(t["dias_min"]) if t["dias_min"] else 0,
            "casos_mayor_30": t["casos_mayor_30_dias"] or 0,
            "casos_mayor_60": t["casos_mayor_60_dias"] or 0,
            "total": t["total"],
        }

    # Procesar cuellos de botella
    cuellos = []
    for r in (cuellos_botella or []):
        cuellos.append({
            "etapa": r["etapa_caso"],
            "cantidad": r["cantidad"],
            "sin_inspeccion": r["sin_inspeccion"],
            "dias_promedio": float(r["dias_promedio"]) if r["dias_promedio"] else 0,
            "pct_estancado": round(r["sin_inspeccion"] / r["cantidad"] * 100, 1) if r["cantidad"] > 0 else 0,
        })

    # Procesar mal ejecutados
    mal_ejec = {
        "mal_ejecutados": 0, "bien_ejecutados": 0, "medidor_no_encontrado": 0,
        "medidor_diferente": 0, "medidor_cruzado": 0, "sin_observacion": 0, "total": 0,
    }
    if mal_ejecutados_detalle and mal_ejecutados_detalle[0]["total"] > 0:
        m = mal_ejecutados_detalle[0]
        mal_ejec = {
            "mal_ejecutados": m["mal_ejecutados"] or 0,
            "bien_ejecutados": m["bien_ejecutados"] or 0,
            "medidor_no_encontrado": m["medidor_no_encontrado"] or 0,
            "medidor_diferente": m["medidor_diferente"] or 0,
            "medidor_cruzado": m["medidor_cruzado_confirmado"] or 0,
            "sin_observacion": m["sin_observacion"] or 0,
            "total": m["total"],
        }

    # Ranking de inspectores
    inspectores = []
    for r in (ranking_inspectores or []):
        inspectores.append({
            "inspector": r["inspector"],
            "total": r["total"],
            "bien_ejecutados": r["bien_ejecutados"],
            "mal_ejecutados": r["mal_ejecutados"],
            "tasa_bien_ejecutado": float(r["tasa_bien_ejecutado"]) if r["tasa_bien_ejecutado"] else 0,
            "dias_promedio": float(r["dias_promedio"]) if r["dias_promedio"] else 0,
            "zonas_atendidas": r["zonas_atendidas"],
            "sin_observacion": r["sin_observacion"],
            "calidad_doc": "buena" if r["sin_observacion"] < r["total"] * 0.1 else "regular" if r["sin_observacion"] < r["total"] * 0.3 else "mala",
        })

    # Procesar casos pendientes
    pendientes = {"sin_inspeccion": 0, "sin_asignar": 0, "asignados_sin_inspeccionar": 0, "estancados": 0, "total": 0}
    if casos_pendientes and casos_pendientes[0]["total"] > 0:
        p = casos_pendientes[0]
        pendientes = {
            "sin_inspeccion": p["sin_inspeccion"] or 0,
            "sin_asignar": p["sin_asignar"] or 0,
            "asignados_sin_inspeccionar": p["asignados_sin_inspeccionar"] or 0,
            "estancados": p["estancados_mayor_30_dias"] or 0,
            "total": p["total"],
        }

    # Evolución de tiempos
    evolucion = []
    for r in sorted(evolucion_tiempos or [], key=lambda x: x["periodo"]):
        evolucion.append({
            "periodo": r["periodo"],
            "total": r["total"],
            "dias_promedio": float(r["dias_promedio"]) if r["dias_promedio"] else 0,
            "bien_ejecutados": r["bien_ejecutados"],
            "mal_ejecutados": r["mal_ejecutados"],
            "tasa_bien": round(r["bien_ejecutados"] / r["total"] * 100, 1) if r["total"] > 0 else 0,
        })

    # Generar alertas operacionales
    alertas = []
    if tiempos["total_dias"] > 30:
        alertas.append({
            "tipo": "info",
            "titulo": "Tiempos de proceso",
            "mensaje": f"Promedio de {tiempos['total_dias']} dias desde correo hasta inspeccion.",
        })
    if tiempos["casos_mayor_60"] > 0:
        pct = round(tiempos["casos_mayor_60"] / tiempos["total"] * 100, 1) if tiempos["total"] > 0 else 0
        alertas.append({
            "tipo": "info",
            "titulo": f"{tiempos['casos_mayor_60']} casos con mas de 60 dias",
            "mensaje": f"{pct}% de los casos con mas de 60 dias en proceso.",
        })
    if pendientes["estancados"] > 10:
        alertas.append({
            "tipo": "info",
            "titulo": f"{pendientes['estancados']} casos en espera",
            "mensaje": "Casos pendientes de inspeccion con mas de 30 dias desde el correo.",
        })
    if mal_ejec["total"] > 0 and mal_ejec["mal_ejecutados"] / mal_ejec["total"] > 0.2:
        pct = round(mal_ejec["mal_ejecutados"] / mal_ejec["total"] * 100, 1)
        alertas.append({
            "tipo": "info",
            "titulo": f"{pct}% de inspecciones para revision",
            "mensaje": f"{mal_ejec['mal_ejecutados']} casos con resultado 'mal ejecutado'.",
        })
    if mal_ejec["sin_observacion"] > mal_ejec["total"] * 0.2:
        alertas.append({
            "tipo": "info",
            "titulo": "Documentacion pendiente",
            "mensaje": f"{mal_ejec['sin_observacion']} inspecciones sin observaciones del inspector.",
        })

    # Identificar inspectores con oportunidad de mejora
    mejora = [i for i in inspectores if i["tasa_bien_ejecutado"] < 60 and i["total"] >= 5]
    if mejora:
        nombres = ", ".join([p["inspector"] for p in mejora[:3]])
        alertas.append({
            "tipo": "info",
            "titulo": "Inspectores con oportunidad de mejora",
            "mensaje": f"Tasa < 60%: {nombres}.",
        })

    return {
        "tiempos_proceso": tiempos,
        "cuellos_botella": cuellos,
        "detalle_resultados": mal_ejec,
        "ranking_inspectores": inspectores,
        "casos_pendientes": pendientes,
        "evolucion_tiempos": evolucion,
        "alertas": alertas,
    }
