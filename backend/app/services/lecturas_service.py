"""
Servicio de datos para el modulo de Lecturas.
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

META_CUMPLIMIENTO_PLAZO = 90


def _build_where(
    sector: Optional[str] = None,
    origen: Optional[str] = None,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
    mes: Optional[int] = None,
    anio: Optional[int] = None,
    search: Optional[str] = None,
    inspector: Optional[str] = None,
    estado_plazo: Optional[str] = None,
    hallazgo: Optional[str] = None,
    comuna: Optional[str] = None,
) -> tuple[str, dict]:
    conditions = []
    params = {}

    if sector:
        conditions.append("UPPER(sector) = UPPER(:sector)")
        params["sector"] = sector
    if origen:
        conditions.append("UPPER(origen) = UPPER(:origen)")
        params["origen"] = origen
    if fecha_desde:
        parsed_desde = _parse_date(fecha_desde)
        if parsed_desde:
            conditions.append("fecha_ingreso >= :fecha_desde")
            params["fecha_desde"] = parsed_desde
    if fecha_hasta:
        parsed_hasta = _parse_date(fecha_hasta)
        if parsed_hasta:
            conditions.append("fecha_ingreso <= :fecha_hasta")
            params["fecha_hasta"] = parsed_hasta
    if mes:
        conditions.append("mes = :mes")
        params["mes"] = mes
    if anio:
        conditions.append("anio = :anio")
        params["anio"] = anio
    if search:
        conditions.append(
            "(CAST(cliente AS TEXT) ILIKE :search OR nombre ILIKE :search "
            "OR comuna ILIKE :search OR inspector ILIKE :search "
            "OR medidor ILIKE :search OR direccion ILIKE :search "
            "OR CAST(orden AS TEXT) ILIKE :search)"
        )
        params["search"] = f"%{search}%"
    if inspector:
        conditions.append("inspector ILIKE :inspector")
        params["inspector"] = f"%{inspector}%"
    if estado_plazo:
        conditions.append("estado_plazo ILIKE :estado_plazo")
        params["estado_plazo"] = f"%{estado_plazo}%"
    if hallazgo:
        conditions.append("hallazgo ILIKE :hallazgo")
        params["hallazgo"] = f"%{hallazgo}%"
    if comuna:
        conditions.append("UPPER(comuna) = UPPER(:comuna)")
        params["comuna"] = comuna

    where = " AND ".join(conditions) if conditions else "1=1"
    return where, params


async def get_lecturas_filtered_data(
    search: Optional[str] = None, sector: Optional[str] = None,
    inspector: Optional[str] = None, estado_plazo: Optional[str] = None,
    hallazgo: Optional[str] = None, origen: Optional[str] = None,
    comuna: Optional[str] = None, fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None, mes: Optional[int] = None,
    anio: Optional[int] = None, page: int = 1, limit: int = 50,
    sort_by: str = "fecha_ingreso", order: str = "desc"
) -> Dict[str, Any]:
    where, params = _build_where(
        sector=sector, origen=origen, fecha_desde=fecha_desde, fecha_hasta=fecha_hasta,
        mes=mes, anio=anio, search=search, inspector=inspector,
        estado_plazo=estado_plazo, hallazgo=hallazgo, comuna=comuna,
    )

    allowed_sort = {"fecha_ingreso", "fecha_inspeccion", "fecha_respuesta",
                    "sector", "inspector", "comuna", "estado_plazo", "hallazgo"}
    if sort_by not in allowed_sort:
        sort_by = "fecha_ingreso"
    order_dir = "ASC" if order == "asc" else "DESC"

    total = await execute_scalar(f"SELECT COUNT(*) FROM lecturas WHERE {where}", params)
    offset = (page - 1) * limit
    params["limit"] = limit
    params["offset"] = offset

    rows = await execute_query(f"""
        SELECT orden, cliente, nombre, direccion, comuna, sector, inspector,
               TO_CHAR(fecha_ingreso, 'YYYY-MM-DD') as fecha_ingreso,
               TO_CHAR(fecha_inspeccion, 'YYYY-MM-DD') as fecha_inspeccion,
               TO_CHAR(fecha_respuesta, 'YYYY-MM-DD') as fecha_respuesta,
               hallazgo, estado_general, estado_plazo, submotivo,
               canal_entrada, gestion, origen, dias_respuesta
        FROM lecturas WHERE {where}
        ORDER BY {sort_by} {order_dir} NULLS LAST
        LIMIT :limit OFFSET :offset
    """, params)

    pages = (total + limit - 1) // limit if total else 0
    return {"items": rows, "total": total or 0, "page": page, "limit": limit, "pages": pages}


@cached(ttl_seconds=60)
async def get_lecturas_stats(
    sector: Optional[str] = None, origen: Optional[str] = None,
    fecha_desde: Optional[str] = None, fecha_hasta: Optional[str] = None,
    mes: Optional[int] = None, anio: Optional[int] = None,
) -> Dict[str, Any]:
    where, params = _build_where(
        sector=sector, origen=origen, fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta, mes=mes, anio=anio,
    )

    empty_response = {
        "total": 0, "inspeccionadas": 0, "pendientes": 0, "tasa_inspeccion": 0,
        "en_plazo": 0, "fuera_plazo": 0, "tasa_cumplimiento_plazo": 0,
        "dias_respuesta_promedio": 0, "dias_respuesta_min": 0, "dias_respuesta_max": 0,
        "por_hallazgo": [], "por_estado_general": [], "por_inspector": [],
        "por_sector": {}, "por_origen": {}, "por_canal": [], "por_submotivo": [],
        "por_gestion": [], "evolucion_diaria": [],
        "comparativas": {
            "inspeccion": {"actual": 0, "anterior": 0, "diferencia": 0},
            "cumplimiento_plazo": {"actual": 0, "anterior": 0, "diferencia": 0},
        },
        "insights": [],
    }

    # Launch ALL queries in parallel via asyncio.gather
    (
        kpis,
        hallazgo_rows,
        eg_rows,
        insp_rows,
        sec_rows,
        ori_rows,
        canal_rows,
        sub_rows,
        gest_rows,
        diaria_rows,
        comp_rows,
    ) = await asyncio.gather(
        # 0: KPIs
        execute_query(f"""
            SELECT
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE fecha_inspeccion IS NOT NULL) as inspeccionadas,
                COUNT(*) FILTER (WHERE estado_plazo ILIKE '%%En el Plazo%%') as en_plazo,
                COUNT(*) FILTER (WHERE estado_plazo ILIKE '%%Fuera%%') as fuera_plazo,
                ROUND(AVG(dias_respuesta)::numeric, 1) as dias_promedio,
                MIN(dias_respuesta) as dias_min,
                MAX(dias_respuesta) as dias_max
            FROM lecturas WHERE {where}
        """, params),
        # 1: Por hallazgo
        execute_query(f"""
            SELECT hallazgo, COUNT(*) as cantidad
            FROM lecturas WHERE {where} AND TRIM(COALESCE(hallazgo,'')) != ''
            GROUP BY hallazgo ORDER BY cantidad DESC
        """, params),
        # 2: Por estado general
        execute_query(f"""
            SELECT estado_general as estado, COUNT(*) as cantidad
            FROM lecturas WHERE {where} AND TRIM(COALESCE(estado_general,'')) != ''
            GROUP BY estado_general ORDER BY cantidad DESC
        """, params),
        # 3: Por inspector (top 10)
        execute_query(f"""
            SELECT inspector, COUNT(*) as cantidad,
                COUNT(*) FILTER (WHERE estado_plazo ILIKE '%%En el Plazo%%') as en_plazo_insp
            FROM lecturas WHERE {where} AND TRIM(COALESCE(inspector,'')) != ''
            GROUP BY inspector ORDER BY cantidad DESC LIMIT 10
        """, params),
        # 4: Por sector
        execute_query(f"""
            SELECT sector, COUNT(*) as cantidad
            FROM lecturas WHERE {where} AND TRIM(COALESCE(sector,'')) != ''
            GROUP BY sector ORDER BY cantidad DESC
        """, params),
        # 5: Por origen
        execute_query(f"""
            SELECT origen, COUNT(*) as cantidad
            FROM lecturas WHERE {where} AND origen IS NOT NULL
            GROUP BY origen ORDER BY cantidad DESC
        """, params),
        # 6: Por canal
        execute_query(f"""
            SELECT canal_entrada as canal, COUNT(*) as cantidad
            FROM lecturas WHERE {where} AND TRIM(COALESCE(canal_entrada,'')) != ''
            GROUP BY canal_entrada ORDER BY cantidad DESC
        """, params),
        # 7: Por submotivo
        execute_query(f"""
            SELECT submotivo, COUNT(*) as cantidad
            FROM lecturas WHERE {where} AND TRIM(COALESCE(submotivo,'')) != ''
            GROUP BY submotivo ORDER BY cantidad DESC
        """, params),
        # 8: Por gestion
        execute_query(f"""
            SELECT gestion, COUNT(*) as cantidad
            FROM lecturas WHERE {where} AND TRIM(COALESCE(gestion,'')) != ''
            GROUP BY gestion ORDER BY cantidad DESC
        """, params),
        # 9: Evolucion diaria (last 30 days)
        execute_query(f"""
            SELECT TO_CHAR(fecha_ingreso, 'YYYY-MM-DD') as dia,
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE fecha_inspeccion IS NOT NULL) as inspeccionadas
            FROM lecturas WHERE {where} AND fecha_ingreso IS NOT NULL
            GROUP BY dia ORDER BY dia DESC LIMIT 30
        """, params),
        # 10: Comparativas (first half vs second half)
        execute_query(f"""
            WITH ranked AS (
                SELECT *,
                    ROW_NUMBER() OVER (ORDER BY fecha_ingreso) as rn,
                    COUNT(*) OVER () as cnt
                FROM lecturas WHERE {where}
            )
            SELECT
                CASE WHEN rn <= cnt/2 THEN 'primera' ELSE 'segunda' END as mitad,
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE fecha_inspeccion IS NOT NULL) as inspeccionadas,
                COUNT(*) FILTER (WHERE estado_plazo ILIKE '%%En el Plazo%%') as en_plazo
            FROM ranked
            GROUP BY mitad ORDER BY mitad
        """, params),
    )

    # --- Process KPIs ---
    if not kpis or kpis[0]["total"] == 0:
        return empty_response

    k = kpis[0]
    total = k["total"]
    inspeccionadas = k["inspeccionadas"]
    pendientes = total - inspeccionadas
    tasa_inspeccion = round(inspeccionadas / total * 100, 1) if total > 0 else 0
    tasa_cumplimiento = round(k["en_plazo"] / total * 100, 1) if total > 0 else 0
    dias_promedio = float(k["dias_promedio"]) if k["dias_promedio"] else 0
    dias_min = int(k["dias_min"]) if k["dias_min"] is not None else 0
    dias_max = int(k["dias_max"]) if k["dias_max"] is not None else 0

    # --- Process breakdown results ---
    por_hallazgo = [{"hallazgo": r["hallazgo"], "cantidad": r["cantidad"]} for r in hallazgo_rows]

    por_estado_general = [{"estado": r["estado"], "cantidad": r["cantidad"]} for r in eg_rows]

    por_inspector = [
        {"inspector": r["inspector"], "cantidad": r["cantidad"],
         "en_plazo": r["en_plazo_insp"],
         "tasa_cumplimiento": round(r["en_plazo_insp"] / r["cantidad"] * 100, 1) if r["cantidad"] > 0 else 0}
        for r in insp_rows
    ]

    por_sector = {r["sector"]: r["cantidad"] for r in sec_rows}

    por_origen = {r["origen"]: r["cantidad"] for r in ori_rows}

    por_canal = [{"canal": r["canal"], "cantidad": r["cantidad"]} for r in canal_rows]

    por_submotivo = [{"submotivo": r["submotivo"], "cantidad": r["cantidad"]} for r in sub_rows]

    por_gestion = [{"gestion": r["gestion"], "cantidad": r["cantidad"]} for r in gest_rows]

    evolucion_diaria = [
        {"dia": r["dia"], "total": r["total"], "inspeccionadas": r["inspeccionadas"]}
        for r in sorted(diaria_rows, key=lambda x: x["dia"])
    ]

    # --- Process comparativas ---
    comparativas = {
        "inspeccion": {"actual": 0, "anterior": 0, "diferencia": 0},
        "cumplimiento_plazo": {"actual": 0, "anterior": 0, "diferencia": 0},
    }
    if total > 10 and len(comp_rows) == 2:
        ant = comp_rows[0]
        act = comp_rows[1]
        tasa_ant_i = round(ant["inspeccionadas"] / ant["total"] * 100, 1) if ant["total"] > 0 else 0
        tasa_act_i = round(act["inspeccionadas"] / act["total"] * 100, 1) if act["total"] > 0 else 0
        comparativas["inspeccion"] = {
            "actual": tasa_act_i, "anterior": tasa_ant_i,
            "diferencia": round(tasa_act_i - tasa_ant_i, 1),
        }
        tasa_ant_p = round(ant["en_plazo"] / ant["total"] * 100, 1) if ant["total"] > 0 else 0
        tasa_act_p = round(act["en_plazo"] / act["total"] * 100, 1) if act["total"] > 0 else 0
        comparativas["cumplimiento_plazo"] = {
            "actual": tasa_act_p, "anterior": tasa_ant_p,
            "diferencia": round(tasa_act_p - tasa_ant_p, 1),
        }

    # --- Insights ---
    insights = []
    if tasa_cumplimiento < META_CUMPLIMIENTO_PLAZO:
        insights.append({"tipo": "warning", "titulo": "Cumplimiento bajo meta",
                         "mensaje": f"Solo {tasa_cumplimiento}% de las ordenes estan en plazo (meta: {META_CUMPLIMIENTO_PLAZO}%)"})
    if pendientes > 0:
        pct = round(pendientes / total * 100, 1)
        if pct > 50:
            insights.append({"tipo": "warning", "titulo": "Alta cantidad de pendientes",
                             "mensaje": f"{pendientes} ordenes ({pct}%) aun no han sido inspeccionadas"})
    if por_hallazgo:
        top = por_hallazgo[0]
        if top["cantidad"] > 20:
            insights.append({"tipo": "info", "titulo": f"Hallazgo frecuente: {top['hallazgo']}",
                             "mensaje": f"{top['cantidad']} casos con este hallazgo"})
    if dias_promedio > 5:
        insights.append({"tipo": "warning", "titulo": "Tiempo de respuesta alto",
                         "mensaje": f"El promedio de dias de respuesta es {dias_promedio} dias"})
    elif 0 < dias_promedio <= 3:
        insights.append({"tipo": "success", "titulo": "Buen tiempo de respuesta",
                         "mensaje": f"Promedio de {dias_promedio} dias de respuesta"})

    return {
        "total": total, "inspeccionadas": inspeccionadas, "pendientes": pendientes,
        "tasa_inspeccion": tasa_inspeccion,
        "en_plazo": k["en_plazo"], "fuera_plazo": k["fuera_plazo"],
        "tasa_cumplimiento_plazo": tasa_cumplimiento,
        "dias_respuesta_promedio": dias_promedio,
        "dias_respuesta_min": dias_min, "dias_respuesta_max": dias_max,
        "por_hallazgo": por_hallazgo, "por_estado_general": por_estado_general,
        "por_inspector": por_inspector, "por_sector": por_sector,
        "por_origen": por_origen, "por_canal": por_canal,
        "por_submotivo": por_submotivo, "por_gestion": por_gestion,
        "evolucion_diaria": evolucion_diaria,
        "comparativas": comparativas, "insights": insights,
    }


@cached(ttl_seconds=300)
async def get_lecturas_sectores() -> List[str]:
    rows = await execute_query("SELECT DISTINCT sector FROM lecturas WHERE TRIM(COALESCE(sector,'')) != '' ORDER BY sector")
    return [r["sector"] for r in rows]


@cached(ttl_seconds=300)
async def get_lecturas_inspectors() -> List[Dict[str, Any]]:
    rows = await execute_query("""
        SELECT inspector, COUNT(*) as cantidad,
            COUNT(*) FILTER (WHERE estado_plazo ILIKE '%%En el Plazo%%') as en_plazo
        FROM lecturas WHERE TRIM(COALESCE(inspector,'')) != ''
        GROUP BY inspector ORDER BY cantidad DESC
    """)
    return [
        {"inspector": r["inspector"], "cantidad": r["cantidad"],
         "tasa_cumplimiento": round(r["en_plazo"] / r["cantidad"] * 100, 1) if r["cantidad"] > 0 else 0}
        for r in rows
    ]


@cached(ttl_seconds=300)
async def get_lecturas_hallazgos() -> List[str]:
    rows = await execute_query("SELECT DISTINCT hallazgo FROM lecturas WHERE TRIM(COALESCE(hallazgo,'')) != '' ORDER BY hallazgo")
    return [r["hallazgo"] for r in rows]


@cached(ttl_seconds=300)
async def get_lecturas_comunas() -> List[str]:
    rows = await execute_query("SELECT DISTINCT comuna FROM lecturas WHERE TRIM(COALESCE(comuna,'')) != '' ORDER BY comuna")
    return [r["comuna"] for r in rows]


@cached(ttl_seconds=300)
async def get_lecturas_periodos() -> Dict[str, Any]:
    rows = await execute_query("""
        SELECT
            ARRAY_AGG(DISTINCT mes ORDER BY mes) FILTER (WHERE mes IS NOT NULL) as meses,
            ARRAY_AGG(DISTINCT anio ORDER BY anio) FILTER (WHERE anio IS NOT NULL) as anios,
            (SELECT mes FROM lecturas WHERE mes IS NOT NULL AND anio IS NOT NULL ORDER BY anio DESC, mes DESC LIMIT 1) as ultimo_mes,
            (SELECT anio FROM lecturas WHERE mes IS NOT NULL AND anio IS NOT NULL ORDER BY anio DESC, mes DESC LIMIT 1) as ultimo_anio
        FROM lecturas
    """)
    if rows:
        return {
            "meses": rows[0]["meses"] or [],
            "anios": rows[0]["anios"] or [],
            "ultimo_mes": rows[0]["ultimo_mes"],
            "ultimo_anio": rows[0]["ultimo_anio"],
        }
    return {"meses": [], "anios": [], "ultimo_mes": None, "ultimo_anio": None}
