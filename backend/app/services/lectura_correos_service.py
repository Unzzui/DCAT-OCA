"""
Servicio para el modulo de Correos/Inspecciones Especiales.
"""

import asyncio
from typing import Optional, Dict, Any, List
from .db_queries import execute_query, execute_scalar
from .cache import cached


def _build_where(
    fuente: Optional[str] = None,
    inspector: Optional[str] = None,
    comuna: Optional[str] = None,
    gestion: Optional[str] = None,
    mes: Optional[int] = None,
    anio: Optional[int] = None,
    search: Optional[str] = None,
) -> tuple[str, dict]:
    """Build WHERE clause and params from filters."""
    conditions = []
    params = {}

    if fuente:
        conditions.append("UPPER(fuente) = UPPER(:fuente)")
        params["fuente"] = fuente
    if inspector:
        conditions.append("UPPER(inspector) = UPPER(:inspector)")
        params["inspector"] = inspector
    if comuna:
        conditions.append("UPPER(comuna) = UPPER(:comuna)")
        params["comuna"] = comuna
    if gestion:
        conditions.append("UPPER(gestion) ILIKE :gestion")
        params["gestion"] = f"%{gestion}%"
    if mes:
        conditions.append("mes = :mes")
        params["mes"] = mes
    if anio:
        conditions.append("anio = :anio")
        params["anio"] = anio
    if search:
        conditions.append(
            "(cliente ILIKE :search OR reclamo ILIKE :search "
            "OR respuesta ILIKE :search OR quien_envio ILIKE :search)"
        )
        params["search"] = f"%{search}%"

    where = " AND ".join(conditions) if conditions else "1=1"
    return where, params


@cached(ttl_seconds=60)
async def get_correos_stats(
    fuente: Optional[str] = None,
    inspector: Optional[str] = None,
    comuna: Optional[str] = None,
    mes: Optional[int] = None,
    anio: Optional[int] = None,
) -> Dict[str, Any]:
    """Get aggregated statistics for correos/inspecciones especiales."""
    where, params = _build_where(
        fuente=fuente, inspector=inspector, comuna=comuna, mes=mes, anio=anio
    )

    empty_response = {
        "total": 0,
        "respondidos": 0,
        "pendientes": 0,
        "tasa_respuesta": 0,
        "dias_respuesta_promedio": 0,
        "por_fuente": {},
        "por_inspector": [],
        "por_comuna": [],
        "por_gestion": [],
        "evolucion_mensual": [],
        "insights": [],
    }

    # Run queries in parallel
    kpis, fuente_rows, inspector_rows, comuna_rows, gestion_rows, evolucion_rows = await asyncio.gather(
        execute_query(f"""
            SELECT
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE fecha_respuesta IS NOT NULL) as respondidos,
                COUNT(*) FILTER (WHERE fecha_respuesta IS NULL) as pendientes,
                AVG(dias_respuesta) FILTER (WHERE dias_respuesta IS NOT NULL AND dias_respuesta >= 0) as dias_promedio,
                MIN(dias_respuesta) FILTER (WHERE dias_respuesta IS NOT NULL AND dias_respuesta >= 0) as dias_min,
                MAX(dias_respuesta) FILTER (WHERE dias_respuesta IS NOT NULL AND dias_respuesta >= 0) as dias_max
            FROM inspecciones_correos WHERE {where}
        """, params),
        execute_query(f"""
            SELECT fuente, COUNT(*) as cantidad,
                COUNT(*) FILTER (WHERE fecha_respuesta IS NOT NULL) as respondidos
            FROM inspecciones_correos WHERE {where} AND fuente IS NOT NULL
            GROUP BY fuente ORDER BY cantidad DESC
        """, params),
        execute_query(f"""
            SELECT inspector, COUNT(*) as cantidad,
                COUNT(*) FILTER (WHERE fecha_respuesta IS NOT NULL) as respondidos,
                AVG(dias_respuesta) FILTER (WHERE dias_respuesta IS NOT NULL AND dias_respuesta >= 0) as dias_promedio
            FROM inspecciones_correos WHERE {where} AND inspector IS NOT NULL AND TRIM(inspector) != ''
            GROUP BY inspector ORDER BY cantidad DESC LIMIT 10
        """, params),
        execute_query(f"""
            SELECT comuna, COUNT(*) as cantidad
            FROM inspecciones_correos WHERE {where} AND comuna IS NOT NULL AND TRIM(comuna) != ''
            GROUP BY comuna ORDER BY cantidad DESC LIMIT 10
        """, params),
        execute_query(f"""
            SELECT
                COALESCE(NULLIF(TRIM(gestion), ''), 'Sin Gestion') as gestion,
                COUNT(*) as cantidad
            FROM inspecciones_correos WHERE {where}
            GROUP BY gestion ORDER BY cantidad DESC LIMIT 10
        """, params),
        execute_query(f"""
            SELECT
                anio || '-' || LPAD(mes::text, 2, '0') as periodo,
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE fecha_respuesta IS NOT NULL) as respondidos,
                AVG(dias_respuesta) FILTER (WHERE dias_respuesta IS NOT NULL AND dias_respuesta >= 0) as dias_promedio
            FROM inspecciones_correos WHERE {where} AND mes IS NOT NULL AND anio IS NOT NULL
            GROUP BY anio, mes ORDER BY anio, mes
        """, params),
    )

    if not kpis or kpis[0]["total"] == 0:
        return empty_response

    k = kpis[0]
    total = k["total"]
    respondidos = k["respondidos"]
    pendientes = k["pendientes"]
    tasa_respuesta = round(respondidos / total * 100, 1) if total > 0 else 0

    por_fuente = {r["fuente"]: {"cantidad": r["cantidad"], "respondidos": r["respondidos"]} for r in fuente_rows}

    por_inspector = [
        {
            "inspector": r["inspector"],
            "cantidad": r["cantidad"],
            "respondidos": r["respondidos"],
            "tasa_respuesta": round(r["respondidos"] / r["cantidad"] * 100, 1) if r["cantidad"] > 0 else 0,
            "dias_promedio": round(r["dias_promedio"], 1) if r["dias_promedio"] else 0,
        }
        for r in inspector_rows
    ]

    por_comuna = [
        {"comuna": r["comuna"], "cantidad": r["cantidad"]}
        for r in comuna_rows
    ]

    por_gestion = [
        {"gestion": r["gestion"], "cantidad": r["cantidad"]}
        for r in gestion_rows
    ]

    evolucion_mensual = [
        {
            "periodo": r["periodo"],
            "total": r["total"],
            "respondidos": r["respondidos"],
            "tasa": round(r["respondidos"] / r["total"] * 100, 1) if r["total"] > 0 else 0,
            "dias_promedio": round(r["dias_promedio"], 1) if r["dias_promedio"] else 0,
        }
        for r in evolucion_rows[-12:]
    ]

    # Generate insights
    insights = []
    dias_prom = round(k["dias_promedio"], 1) if k["dias_promedio"] else 0

    if tasa_respuesta >= 95:
        insights.append({
            "tipo": "success",
            "titulo": "Alta tasa de respuesta",
            "mensaje": f"El {tasa_respuesta}% de los correos han sido respondidos"
        })
    elif tasa_respuesta < 80:
        insights.append({
            "tipo": "warning",
            "titulo": "Correos pendientes",
            "mensaje": f"Hay {pendientes} correos sin responder ({100-tasa_respuesta}%)"
        })

    if dias_prom > 0:
        if dias_prom <= 3:
            insights.append({
                "tipo": "success",
                "titulo": "Tiempo de respuesta rapido",
                "mensaje": f"Promedio de {dias_prom} dias para responder"
            })
        elif dias_prom > 7:
            insights.append({
                "tipo": "warning",
                "titulo": "Tiempo de respuesta elevado",
                "mensaje": f"Promedio de {dias_prom} dias para responder"
            })

    if por_inspector:
        mejor_inspector = min([i for i in por_inspector if i["dias_promedio"] > 0], key=lambda x: x["dias_promedio"], default=None)
        if mejor_inspector:
            insights.append({
                "tipo": "info",
                "titulo": "Inspector mas rapido",
                "mensaje": f"{mejor_inspector['inspector']} responde en {mejor_inspector['dias_promedio']} dias promedio"
            })

    return {
        "total": total,
        "respondidos": respondidos,
        "pendientes": pendientes,
        "tasa_respuesta": tasa_respuesta,
        "dias_respuesta_promedio": dias_prom,
        "dias_respuesta_min": int(k["dias_min"]) if k["dias_min"] else 0,
        "dias_respuesta_max": int(k["dias_max"]) if k["dias_max"] else 0,
        "por_fuente": por_fuente,
        "por_inspector": por_inspector,
        "por_comuna": por_comuna,
        "por_gestion": por_gestion,
        "evolucion_mensual": evolucion_mensual,
        "insights": insights,
    }


async def get_correos_filtered_data(
    search: Optional[str] = None,
    fuente: Optional[str] = None,
    inspector: Optional[str] = None,
    comuna: Optional[str] = None,
    gestion: Optional[str] = None,
    mes: Optional[int] = None,
    anio: Optional[int] = None,
    page: int = 1,
    limit: int = 50,
    sort_by: str = "fecha_recepcion",
    order: str = "desc",
) -> Dict[str, Any]:
    """Get paginated list of correos/inspecciones."""
    where, params = _build_where(
        fuente=fuente, inspector=inspector, comuna=comuna,
        gestion=gestion, mes=mes, anio=anio, search=search,
    )

    allowed_sort = {"id", "fecha_recepcion", "cliente", "inspector", "comuna", "dias_respuesta"}
    if sort_by not in allowed_sort:
        sort_by = "fecha_recepcion"
    order_dir = "ASC" if order == "asc" else "DESC"

    total = await execute_scalar(
        f"SELECT COUNT(*) FROM inspecciones_correos WHERE {where}", params
    )

    offset = (page - 1) * limit
    params["limit"] = limit
    params["offset"] = offset

    rows = await execute_query(
        f"""SELECT id, fuente, TO_CHAR(fecha_recepcion, 'YYYY-MM-DD') as fecha_recepcion,
               cliente, quien_envio, reclamo,
               TO_CHAR(fecha_terreno, 'YYYY-MM-DD') as fecha_terreno,
               respuesta, TO_CHAR(fecha_respuesta, 'YYYY-MM-DD') as fecha_respuesta,
               inspector, comuna, tarifa, gestion, sector,
               TO_CHAR(fecha_inspeccion, 'YYYY-MM-DD') as fecha_inspeccion,
               dias_respuesta, mes, anio
        FROM inspecciones_correos WHERE {where}
        ORDER BY {sort_by} {order_dir} NULLS LAST
        LIMIT :limit OFFSET :offset""",
        params,
    )

    pages = (total + limit - 1) // limit if total else 0

    return {
        "items": rows,
        "total": total or 0,
        "page": page,
        "limit": limit,
        "pages": pages,
    }


@cached(ttl_seconds=300)
async def get_correos_fuentes() -> List[str]:
    """Get list of unique fuentes."""
    rows = await execute_query(
        "SELECT DISTINCT fuente FROM inspecciones_correos WHERE fuente IS NOT NULL ORDER BY fuente"
    )
    return [r["fuente"] for r in rows]


@cached(ttl_seconds=300)
async def get_correos_inspectores() -> List[Dict[str, Any]]:
    """Get list of inspectors with stats."""
    rows = await execute_query("""
        SELECT inspector, COUNT(*) as cantidad,
            AVG(dias_respuesta) FILTER (WHERE dias_respuesta IS NOT NULL AND dias_respuesta >= 0) as dias_promedio
        FROM inspecciones_correos WHERE inspector IS NOT NULL AND TRIM(inspector) != ''
        GROUP BY inspector ORDER BY cantidad DESC
    """)
    return [
        {
            "inspector": r["inspector"],
            "cantidad": r["cantidad"],
            "dias_promedio": round(r["dias_promedio"], 1) if r["dias_promedio"] else 0,
        }
        for r in rows
    ]


@cached(ttl_seconds=300)
async def get_correos_comunas() -> List[str]:
    """Get list of unique comunas."""
    rows = await execute_query(
        "SELECT DISTINCT comuna FROM inspecciones_correos WHERE comuna IS NOT NULL AND TRIM(comuna) != '' ORDER BY comuna"
    )
    return [r["comuna"] for r in rows]


@cached(ttl_seconds=300)
async def get_correos_periodos() -> Dict[str, Any]:
    """Get available months and years."""
    rows = await execute_query("""
        SELECT
            ARRAY_AGG(DISTINCT mes ORDER BY mes) FILTER (WHERE mes IS NOT NULL) as meses,
            ARRAY_AGG(DISTINCT anio ORDER BY anio) FILTER (WHERE anio IS NOT NULL) as anios,
            (SELECT mes FROM inspecciones_correos WHERE mes IS NOT NULL AND anio IS NOT NULL ORDER BY anio DESC, mes DESC LIMIT 1) as ultimo_mes,
            (SELECT anio FROM inspecciones_correos WHERE mes IS NOT NULL AND anio IS NOT NULL ORDER BY anio DESC, mes DESC LIMIT 1) as ultimo_anio
        FROM inspecciones_correos
    """)
    if rows:
        return {
            "meses": rows[0]["meses"] or [],
            "anios": rows[0]["anios"] or [],
            "ultimo_mes": rows[0]["ultimo_mes"],
            "ultimo_anio": rows[0]["ultimo_anio"],
        }
    return {"meses": [], "anios": [], "ultimo_mes": None, "ultimo_anio": None}
