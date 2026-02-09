"""
Servicio de datos para el modulo de Medidores Cruzados.
Optimizado: queries SQL directas en vez de cargar DataFrames completos.
"""

import asyncio
from typing import Optional, Dict, Any, List
from ..core.config import settings
from .db_queries import execute_query, execute_scalar
from .cache import cached


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
        conditions.append("fecha_inspeccion >= :fecha_desde")
        params["fecha_desde"] = fecha_desde
    if fecha_hasta:
        conditions.append("fecha_inspeccion <= :fecha_hasta")
        params["fecha_hasta"] = fecha_hasta
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
    rows, latest = await asyncio.gather(
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
    )
    result = {"meses": [], "anios": [], "ultimo_mes": None, "ultimo_anio": None}
    if rows:
        result["meses"] = rows[0]["meses"] or []
        result["anios"] = rows[0]["anios"] or []
    if latest:
        result["ultimo_mes"] = latest[0]["ultimo_mes"]
        result["ultimo_anio"] = latest[0]["ultimo_anio"]
    return result
