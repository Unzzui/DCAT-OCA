"""
Servicio de datos para el modulo de NNCC (Nuevas Conexiones).
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
    base: Optional[str] = None,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
    mes: Optional[int] = None,
    anio: Optional[int] = None,
    search: Optional[str] = None,
    inspector: Optional[str] = None,
    estado: Optional[str] = None,
    comuna: Optional[str] = None,
) -> tuple[str, dict]:
    """Build WHERE clause and params from filters."""
    conditions = []
    params = {}

    if zona:
        conditions.append("UPPER(zona) = UPPER(:zona)")
        params["zona"] = zona
    if base:
        conditions.append("base = :base")
        params["base"] = base
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
    if mes:
        conditions.append("mes = :mes")
        params["mes"] = mes
    if anio:
        conditions.append("anio = :anio")
        params["anio"] = anio
    if search:
        conditions.append(
            "(CAST(cliente AS TEXT) ILIKE :search OR comuna ILIKE :search "
            "OR inspector ILIKE :search OR n_medidor ILIKE :search "
            "OR direccion ILIKE :search)"
        )
        params["search"] = f"%{search}%"
    if inspector:
        conditions.append("inspector ILIKE :inspector")
        params["inspector"] = f"%{inspector}%"
    if estado:
        conditions.append("estado_efectividad ILIKE :estado")
        params["estado"] = f"%{estado}%"
    if comuna:
        conditions.append("UPPER(comuna) = UPPER(:comuna)")
        params["comuna"] = comuna

    where = " AND ".join(conditions) if conditions else "1=1"
    return where, params


async def get_filtered_data(
    search: Optional[str] = None,
    zona: Optional[str] = None,
    inspector: Optional[str] = None,
    estado: Optional[str] = None,
    comuna: Optional[str] = None,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
    base: Optional[str] = None,
    mes: Optional[int] = None,
    anio: Optional[int] = None,
    page: int = 1,
    limit: int = 50,
    sort_by: str = "fecha_inspeccion",
    order: str = "desc"
) -> Dict[str, Any]:
    where, params = _build_where(
        zona=zona, base=base, fecha_desde=fecha_desde, fecha_hasta=fecha_hasta,
        mes=mes, anio=anio, search=search, inspector=inspector, estado=estado,
        comuna=comuna,
    )

    # Validate sort column
    allowed_sort = {
        "fecha_inspeccion", "zona", "comuna", "inspector",
        "estado_efectividad", "resultado_inspeccion", "base", "cliente",
    }
    if sort_by not in allowed_sort:
        sort_by = "fecha_inspeccion"
    order_dir = "ASC" if order == "asc" else "DESC"

    total = await execute_scalar(
        f"SELECT COUNT(*) FROM nncc WHERE {where}", params
    )

    offset = (page - 1) * limit
    params["limit"] = limit
    params["offset"] = offset

    rows = await execute_query(
        f"""SELECT vta, cliente, nombre_cliente, direccion, comuna, tarifa,
               zona, base, n_medidor, estado_efectividad, resultado_inspeccion,
               multa, observaciones_multa,
               TO_CHAR(fecha_inspeccion, 'YYYY-MM-DD') as fecha_inspeccion,
               inspector, estado_contratista, resultado_normalizacion,
               cumple_norma_cc, cliente_conforme, estado_empalme,
               tipo_inspeccion, voltaje, mes, anio, link_formulario
        FROM nncc WHERE {where}
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


@cached(ttl_seconds=60)
async def get_stats(
    zona: Optional[str] = None,
    base: Optional[str] = None,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
    mes: Optional[int] = None,
    anio: Optional[int] = None,
) -> Dict[str, Any]:
    where, params = _build_where(
        zona=zona, base=base, fecha_desde=fecha_desde, fecha_hasta=fecha_hasta,
        mes=mes, anio=anio,
    )

    empty_response = {
        "total": 0, "efectivas": 0, "no_efectivas": 0,
        "bien_ejecutados": 0, "mal_ejecutados": 0, "tasa_efectividad": 0,
        "por_zona": {}, "por_inspector": [], "por_mes": [],
        "con_multa": 0, "pendientes_normalizar": 0,
        "cliente_conforme": {"conforme": 0, "disconforme": 0, "sin_dato": 0, "sin_inspeccionar": 0},
        "estado_empalme": {},
        "cumple_norma_cc": {"cumple": 0, "no_cumple": 0, "sin_dato": 0, "sin_inspeccionar": 0},
        "evolucion_mensual": [],
        "comparativas": {
            "efectividad": {"actual": 0, "anterior": 0, "diferencia": 0},
            "bien_ejecutado": {"actual": 0, "anterior": 0, "diferencia": 0},
            "conformidad": {"actual": 0, "anterior": 0, "diferencia": 0},
            "cumple_norma_cc": {"actual": 0, "anterior": 0, "diferencia": 0},
        },
        "top_comunas_problemas": [], "insights": [],
    }

    # Run ALL queries in parallel — biggest perf win (6 round-trips → 1)
    kpis, zona_rows, inspector_rows, evolucion_rows, empalme_rows, comunas_rows = await asyncio.gather(
        execute_query(f"""
            SELECT
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE estado_efectividad ILIKE '%%EFECTIVA%%'
                                 AND estado_efectividad NOT ILIKE '%%NO EFECTIVA%%') as efectivas,
                COUNT(*) FILTER (WHERE estado_efectividad ILIKE '%%NO EFECTIVA%%') as no_efectivas,
                COUNT(*) FILTER (WHERE resultado_inspeccion ILIKE '%%BIEN%%') as bien_ejecutados,
                COUNT(*) FILTER (WHERE resultado_inspeccion ILIKE '%%MAL%%') as mal_ejecutados,
                COUNT(*) FILTER (WHERE UPPER(multa) = 'SI') as con_multa,
                COUNT(*) FILTER (WHERE resultado_normalizacion ILIKE '%%PENDIENTE%%') as pendientes_normalizar,
                COUNT(*) FILTER (WHERE UPPER(TRIM(COALESCE(cliente_conforme,''))) LIKE '%%CONFORME%%'
                                 AND UPPER(TRIM(COALESCE(cliente_conforme,''))) NOT LIKE '%%DISCONFORME%%') as cc_conforme,
                COUNT(*) FILTER (WHERE UPPER(TRIM(COALESCE(cliente_conforme,''))) LIKE '%%DISCONFORME%%') as cc_disconforme,
                COUNT(*) FILTER (WHERE UPPER(TRIM(COALESCE(cliente_conforme,''))) IN ('S/N','#N/D')) as cc_sin_dato,
                COUNT(*) FILTER (WHERE TRIM(COALESCE(cliente_conforme,'')) = '') as cc_sin_inspeccionar,
                COUNT(*) FILTER (WHERE UPPER(TRIM(COALESCE(cumple_norma_cc,''))) LIKE '%%CUMPLE%%'
                                 AND UPPER(TRIM(COALESCE(cumple_norma_cc,''))) NOT LIKE '%%NO CUMPLE%%') as nc_cumple,
                COUNT(*) FILTER (WHERE UPPER(TRIM(COALESCE(cumple_norma_cc,''))) LIKE '%%NO CUMPLE%%') as nc_no_cumple,
                COUNT(*) FILTER (WHERE UPPER(TRIM(COALESCE(cumple_norma_cc,''))) IN ('S/N','#N/D')) as nc_sin_dato,
                COUNT(*) FILTER (WHERE TRIM(COALESCE(cumple_norma_cc,'')) = '') as nc_sin_inspeccionar
            FROM nncc WHERE {where}
        """, params),
        execute_query(f"""
            SELECT zona, COUNT(*) as cantidad
            FROM nncc WHERE {where} AND zona IS NOT NULL
            GROUP BY zona ORDER BY cantidad DESC
        """, params),
        execute_query(f"""
            SELECT inspector, COUNT(*) as cantidad,
                COUNT(*) FILTER (WHERE estado_efectividad ILIKE '%%EFECTIVA%%'
                                 AND estado_efectividad NOT ILIKE '%%NO EFECTIVA%%') as efectivas_insp
            FROM nncc WHERE {where} AND TRIM(COALESCE(inspector,'')) != ''
            GROUP BY inspector ORDER BY cantidad DESC LIMIT 10
        """, params),
        execute_query(f"""
            SELECT TO_CHAR(fecha_inspeccion, 'YYYY-MM') as mes_periodo,
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE estado_efectividad ILIKE '%%EFECTIVA%%'
                                 AND estado_efectividad NOT ILIKE '%%NO EFECTIVA%%') as efectivas,
                COUNT(*) FILTER (WHERE resultado_inspeccion ILIKE '%%BIEN%%') as bien_ejecutados,
                COUNT(*) FILTER (WHERE UPPER(TRIM(COALESCE(cliente_conforme,''))) LIKE '%%CONFORME%%'
                                 AND UPPER(TRIM(COALESCE(cliente_conforme,''))) NOT LIKE '%%DISCONFORME%%') as cc_conforme,
                COUNT(*) FILTER (WHERE UPPER(TRIM(COALESCE(cliente_conforme,''))) LIKE '%%DISCONFORME%%') as cc_disconforme,
                COUNT(*) FILTER (WHERE UPPER(TRIM(COALESCE(cumple_norma_cc,''))) LIKE '%%CUMPLE%%'
                                 AND UPPER(TRIM(COALESCE(cumple_norma_cc,''))) NOT LIKE '%%NO CUMPLE%%') as nc_cumple,
                COUNT(*) FILTER (WHERE UPPER(TRIM(COALESCE(cumple_norma_cc,''))) LIKE '%%NO CUMPLE%%') as nc_no_cumple
            FROM nncc WHERE {where} AND fecha_inspeccion IS NOT NULL
            GROUP BY mes_periodo ORDER BY mes_periodo
        """, params),
        execute_query(f"""
            SELECT
                CASE
                    WHEN TRIM(COALESCE(estado_empalme,'')) = '' OR estado_empalme IS NULL THEN 'Sin Inspeccionar'
                    WHEN UPPER(TRIM(estado_empalme)) IN ('#N/D','S/N','#N/A','N/A') THEN 'Sin Dato'
                    WHEN UPPER(TRIM(estado_empalme)) IN ('BUENO','BUEN','BIEN') THEN 'Bueno'
                    WHEN UPPER(TRIM(estado_empalme)) IN ('MALO','MAL') THEN 'Malo'
                    WHEN UPPER(TRIM(estado_empalme)) = 'REGULAR' THEN 'Regular'
                    ELSE INITCAP(TRIM(estado_empalme))
                END as estado,
                COUNT(*) as cantidad
            FROM nncc WHERE {where}
            GROUP BY estado ORDER BY cantidad DESC
        """, params),
        execute_query(f"""
            SELECT comuna, COUNT(*) as total,
                COUNT(*) FILTER (WHERE resultado_inspeccion ILIKE '%%MAL%%') as mal_ejecutados,
                COUNT(*) FILTER (WHERE UPPER(TRIM(COALESCE(cliente_conforme,''))) LIKE '%%DISCONFORME%%') as disconformes,
                COUNT(*) FILTER (WHERE UPPER(TRIM(COALESCE(cumple_norma_cc,''))) LIKE '%%NO CUMPLE%%') as no_cumple_norma
            FROM nncc WHERE {where} AND comuna IS NOT NULL
            GROUP BY comuna HAVING COUNT(*) >= 5
            ORDER BY (COUNT(*) FILTER (WHERE resultado_inspeccion ILIKE '%%MAL%%')
                    + COUNT(*) FILTER (WHERE UPPER(TRIM(COALESCE(cliente_conforme,''))) LIKE '%%DISCONFORME%%')
                    + COUNT(*) FILTER (WHERE UPPER(TRIM(COALESCE(cumple_norma_cc,''))) LIKE '%%NO CUMPLE%%')) DESC
            LIMIT 5
        """, params),
    )

    if not kpis or kpis[0]["total"] == 0:
        return empty_response

    k = kpis[0]
    total = k["total"]
    efectivas = k["efectivas"]
    tasa_efectividad = round(efectivas / total * 100, 1) if total > 0 else 0

    por_zona = {r["zona"]: r["cantidad"] for r in zona_rows}

    por_inspector = [
        {
            "inspector": r["inspector"],
            "cantidad": r["cantidad"],
            "efectividad": round(r["efectivas_insp"] / r["cantidad"] * 100, 1) if r["cantidad"] > 0 else 0,
        }
        for r in inspector_rows
    ]

    evolucion_mensual = []
    for r in evolucion_rows[-12:]:
        t = r["total"]
        e = r["efectivas"]
        tasa_e = round(e / t * 100, 1) if t > 0 else 0
        tasa_bien = round(r["bien_ejecutados"] / e * 100, 1) if e > 0 else 0
        con_resp_cc = r["cc_conforme"] + r["cc_disconforme"]
        tasa_conf = round(r["cc_conforme"] / con_resp_cc * 100, 1) if con_resp_cc > 0 else 0
        con_resp_nc = r["nc_cumple"] + r["nc_no_cumple"]
        tasa_nc = round(r["nc_cumple"] / con_resp_nc * 100, 1) if con_resp_nc > 0 else 0

        evolucion_mensual.append({
            "mes": r["mes_periodo"],
            "total": t,
            "efectivas": e,
            "efectividad": tasa_e,
            "bien_ejecutados": r["bien_ejecutados"],
            "tasa_bien_ejecutado": tasa_bien,
            "cliente_conforme": r["cc_conforme"],
            "tasa_conformidad": tasa_conf,
            "cumple_norma_cc": r["nc_cumple"],
            "tasa_cumple_cc": tasa_nc,
        })

    # por_mes (same structure as evolucion but simpler)
    por_mes = [
        {"mes": e["mes"], "cantidad": e["total"], "efectividad": e["efectividad"]}
        for e in evolucion_mensual
    ]

    # Comparativas
    comparativas = {
        "efectividad": {"actual": 0, "anterior": 0, "diferencia": 0},
        "bien_ejecutado": {"actual": 0, "anterior": 0, "diferencia": 0},
        "conformidad": {"actual": 0, "anterior": 0, "diferencia": 0},
        "cumple_norma_cc": {"actual": 0, "anterior": 0, "diferencia": 0},
    }
    if len(evolucion_mensual) >= 2:
        actual = evolucion_mensual[-1]
        anterior = evolucion_mensual[-2]
        comparativas["efectividad"] = {
            "actual": actual["efectividad"],
            "anterior": anterior["efectividad"],
            "diferencia": round(actual["efectividad"] - anterior["efectividad"], 1),
        }
        comparativas["bien_ejecutado"] = {
            "actual": actual["tasa_bien_ejecutado"],
            "anterior": anterior["tasa_bien_ejecutado"],
            "diferencia": round(actual["tasa_bien_ejecutado"] - anterior["tasa_bien_ejecutado"], 1),
        }
        comparativas["conformidad"] = {
            "actual": actual["tasa_conformidad"],
            "anterior": anterior["tasa_conformidad"],
            "diferencia": round(actual["tasa_conformidad"] - anterior["tasa_conformidad"], 1),
        }
        comparativas["cumple_norma_cc"] = {
            "actual": actual["tasa_cumple_cc"],
            "anterior": anterior["tasa_cumple_cc"],
            "diferencia": round(actual["tasa_cumple_cc"] - anterior["tasa_cumple_cc"], 1),
        }
    elif len(evolucion_mensual) == 1:
        actual = evolucion_mensual[-1]
        comparativas["efectividad"]["actual"] = actual["efectividad"]
        comparativas["bien_ejecutado"]["actual"] = actual["tasa_bien_ejecutado"]
        comparativas["conformidad"]["actual"] = actual["tasa_conformidad"]
        comparativas["cumple_norma_cc"]["actual"] = actual["tasa_cumple_cc"]

    estado_empalme = {r["estado"]: r["cantidad"] for r in empalme_rows}

    top_comunas_problemas = [
        {
            "comuna": r["comuna"],
            "total": r["total"],
            "mal_ejecutados": r["mal_ejecutados"],
            "tasa_mal_ejecutado": round(r["mal_ejecutados"] / r["total"] * 100, 1) if r["total"] > 0 else 0,
            "disconformes": r["disconformes"],
            "no_cumple_norma": r["no_cumple_norma"],
            "score_problemas": r["mal_ejecutados"] + r["disconformes"] + r["no_cumple_norma"],
        }
        for r in comunas_rows
    ]

    # Insights
    insights = []
    if tasa_efectividad < 95:
        insights.append({"tipo": "info", "titulo": "Efectividad actual",
                         "mensaje": f"La efectividad actual es de {tasa_efectividad}% (meta: 95%)"})
    elif tasa_efectividad >= 98:
        insights.append({"tipo": "success", "titulo": "Excelente efectividad",
                         "mensaje": f"La efectividad actual ({tasa_efectividad}%) supera ampliamente la meta"})

    if len(evolucion_mensual) >= 2:
        diff = comparativas["efectividad"]["diferencia"]
        if diff >= 3:
            insights.append({"tipo": "success", "titulo": "Tendencia positiva",
                             "mensaje": f"La efectividad mejoro {diff}% respecto al mes anterior"})
        elif diff <= -3:
            insights.append({"tipo": "info", "titulo": "Variacion de efectividad",
                             "mensaje": f"La efectividad vario {abs(diff)}% respecto al mes anterior"})

    total_resp = k["cc_conforme"] + k["cc_disconforme"]
    if total_resp > 0:
        tasa_conf = k["cc_conforme"] / total_resp * 100
        if tasa_conf < 90:
            insights.append({"tipo": "info", "titulo": "Satisfaccion del cliente",
                             "mensaje": f"{round(tasa_conf, 1)}% de clientes estan conformes"})

    if top_comunas_problemas and top_comunas_problemas[0]["score_problemas"] > 10:
        tc = top_comunas_problemas[0]
        insights.append({"tipo": "info", "titulo": "Comuna con más incidencias",
                         "mensaje": f"{tc['comuna']} concentra {tc['mal_ejecutados']} trabajos mal ejecutados"})

    if not zona and por_zona:
        vals = list(por_zona.values())
        keys = list(por_zona.keys())
        max_idx = vals.index(max(vals))
        min_idx = vals.index(min(vals))
        if vals[max_idx] > vals[min_idx] * 2:
            insights.append({"tipo": "info", "titulo": "Distribución desigual",
                             "mensaje": f"Zona {keys[max_idx]} tiene {vals[max_idx]} inspecciones vs {vals[min_idx]} en {keys[min_idx]}"})

    return {
        "total": total,
        "efectivas": efectivas,
        "no_efectivas": k["no_efectivas"],
        "bien_ejecutados": k["bien_ejecutados"],
        "mal_ejecutados": k["mal_ejecutados"],
        "tasa_efectividad": tasa_efectividad,
        "por_zona": por_zona,
        "por_inspector": por_inspector,
        "por_mes": por_mes,
        "con_multa": k["con_multa"],
        "pendientes_normalizar": k["pendientes_normalizar"],
        "cliente_conforme": {
            "conforme": k["cc_conforme"], "disconforme": k["cc_disconforme"],
            "sin_dato": k["cc_sin_dato"], "sin_inspeccionar": k["cc_sin_inspeccionar"],
        },
        "estado_empalme": estado_empalme,
        "cumple_norma_cc": {
            "cumple": k["nc_cumple"], "no_cumple": k["nc_no_cumple"],
            "sin_dato": k["nc_sin_dato"], "sin_inspeccionar": k["nc_sin_inspeccionar"],
        },
        "evolucion_mensual": evolucion_mensual,
        "comparativas": comparativas,
        "top_comunas_problemas": top_comunas_problemas,
        "insights": insights,
    }


@cached(ttl_seconds=300)
async def get_comunas() -> List[str]:
    rows = await execute_query("SELECT DISTINCT comuna FROM nncc WHERE comuna IS NOT NULL ORDER BY comuna")
    return [r["comuna"] for r in rows]


@cached(ttl_seconds=300)
async def get_zonas() -> List[str]:
    rows = await execute_query("SELECT DISTINCT zona FROM nncc WHERE zona IS NOT NULL ORDER BY zona")
    return [r["zona"] for r in rows]


@cached(ttl_seconds=300)
async def get_inspectors() -> List[Dict[str, Any]]:
    rows = await execute_query("""
        SELECT inspector, COUNT(*) as cantidad,
            COUNT(*) FILTER (WHERE estado_efectividad ILIKE '%%EFECTIVA%%'
                             AND estado_efectividad NOT ILIKE '%%NO EFECTIVA%%') as efectivas_insp
        FROM nncc WHERE TRIM(COALESCE(inspector,'')) != ''
        GROUP BY inspector ORDER BY cantidad DESC
    """)
    return [
        {
            "inspector": r["inspector"],
            "cantidad": r["cantidad"],
            "efectividad": round(r["efectivas_insp"] / r["cantidad"] * 100, 1) if r["cantidad"] > 0 else 0,
        }
        for r in rows
    ]


@cached(ttl_seconds=300)
async def get_bases() -> List[str]:
    rows = await execute_query("SELECT DISTINCT base FROM nncc WHERE base IS NOT NULL ORDER BY base DESC")
    return [r["base"] for r in rows]


@cached(ttl_seconds=300)
async def get_periodos() -> Dict[str, Any]:
    rows = await execute_query("""
        SELECT
            ARRAY_AGG(DISTINCT mes ORDER BY mes) FILTER (WHERE mes IS NOT NULL) as meses,
            ARRAY_AGG(DISTINCT anio ORDER BY anio) FILTER (WHERE anio IS NOT NULL) as anios,
            (SELECT mes FROM nncc WHERE mes IS NOT NULL AND anio IS NOT NULL ORDER BY anio DESC, mes DESC LIMIT 1) as ultimo_mes,
            (SELECT anio FROM nncc WHERE mes IS NOT NULL AND anio IS NOT NULL ORDER BY anio DESC, mes DESC LIMIT 1) as ultimo_anio
        FROM nncc
    """)
    if rows:
        return {
            "meses": rows[0]["meses"] or [],
            "anios": rows[0]["anios"] or [],
            "ultimo_mes": rows[0]["ultimo_mes"],
            "ultimo_anio": rows[0]["ultimo_anio"],
        }
    return {"meses": [], "anios": [], "ultimo_mes": None, "ultimo_anio": None}
