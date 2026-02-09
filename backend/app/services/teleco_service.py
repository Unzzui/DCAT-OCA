"""
Servicio de datos para el modulo de Telecomunicaciones.
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

META_APROBACION = 50


def _build_where(
    empresa: Optional[str] = None,
    comuna: Optional[str] = None,
    inspector: Optional[str] = None,
    resultado: Optional[str] = None,
    tiene_plano: Optional[str] = None,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
    mes: Optional[int] = None,
    anio: Optional[int] = None,
    search: Optional[str] = None,
) -> tuple[str, dict]:
    conditions = []
    params = {}

    if empresa:
        conditions.append("UPPER(empresa_corta) = UPPER(:empresa)")
        params["empresa"] = empresa
    if comuna:
        conditions.append("UPPER(comuna) = UPPER(:comuna)")
        params["comuna"] = comuna
    if inspector:
        conditions.append("inspector ILIKE :inspector")
        params["inspector"] = f"%{inspector}%"
    if resultado:
        conditions.append("UPPER(resultado) = UPPER(:resultado)")
        params["resultado"] = resultado
    if tiene_plano:
        conditions.append("UPPER(tiene_plano_norm) = UPPER(:tiene_plano)")
        params["tiene_plano"] = tiene_plano
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
            "(empresa ILIKE :search OR comuna ILIKE :search "
            "OR inspector ILIKE :search OR observacion ILIKE :search "
            "OR CAST(numero_caso AS TEXT) ILIKE :search)"
        )
        params["search"] = f"%{search}%"

    where = " AND ".join(conditions) if conditions else "1=1"
    return where, params


async def get_teleco_filtered_data(
    search: Optional[str] = None, empresa: Optional[str] = None,
    comuna: Optional[str] = None, inspector: Optional[str] = None,
    resultado: Optional[str] = None, tiene_plano: Optional[str] = None,
    fecha_desde: Optional[str] = None, fecha_hasta: Optional[str] = None,
    mes: Optional[int] = None, anio: Optional[int] = None,
    page: int = 1, limit: int = 50,
    sort_by: str = "fecha_inspeccion", order: str = "desc"
) -> Dict[str, Any]:
    where, params = _build_where(
        empresa=empresa, comuna=comuna, inspector=inspector, resultado=resultado,
        tiene_plano=tiene_plano, fecha_desde=fecha_desde, fecha_hasta=fecha_hasta,
        mes=mes, anio=anio, search=search,
    )

    allowed_sort = {"fecha_inspeccion", "empresa_corta", "comuna", "inspector", "resultado"}
    if sort_by not in allowed_sort:
        sort_by = "fecha_inspeccion"
    order_dir = "ASC" if order == "asc" else "DESC"

    total = await execute_scalar(f"SELECT COUNT(*) FROM telecomunicaciones WHERE {where}", params)
    offset = (page - 1) * limit
    params["limit"] = limit
    params["offset"] = offset

    rows = await execute_query(f"""
        SELECT numero_caso, family_case, empresa_corta, comuna,
               cantidad_postes,
               TO_CHAR(fecha_inspeccion, 'YYYY-MM-DD') as fecha_inspeccion,
               resultado, tiene_plano_norm, inspector, observacion, estado_simple
        FROM telecomunicaciones WHERE {where}
        ORDER BY {sort_by} {order_dir} NULLS LAST
        LIMIT :limit OFFSET :offset
    """, params)

    pages = (total + limit - 1) // limit if total else 0
    return {"items": rows, "total": total or 0, "page": page, "limit": limit, "pages": pages}


@cached(ttl_seconds=60)
async def get_teleco_stats(
    empresa: Optional[str] = None, comuna: Optional[str] = None,
    fecha_desde: Optional[str] = None, fecha_hasta: Optional[str] = None,
    mes: Optional[int] = None, anio: Optional[int] = None,
) -> Dict[str, Any]:
    where, params = _build_where(
        empresa=empresa, comuna=comuna, fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta, mes=mes, anio=anio,
    )

    empty_response = {
        "total": 0, "aprobados": 0, "rechazados": 0, "tasa_aprobacion": 0,
        "total_postes": 0, "promedio_postes": 0,
        "con_plano": 0, "sin_plano": 0, "plano_incompleto": 0,
        "por_empresa": [], "por_comuna": [], "por_inspector": [],
        "por_resultado": {}, "por_mes": [], "por_tiene_plano": [],
        "motivos_rechazo": [], "evolucion_mensual": [],
        "comparativas": {"aprobacion": {"actual": 0, "anterior": 0, "diferencia": 0}},
        "insights": [],
    }

    # --- Launch ALL independent queries in parallel ---
    (
        kpis,
        emp_rows,
        com_rows,
        insp_rows,
        res_rows,
        plano_rows,
        mes_rows,
        evol_rows,
        comp_rows,
        motivos_row,
    ) = await asyncio.gather(
        # 1) KPIs
        execute_query(f"""
            SELECT
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE UPPER(resultado) = 'APROBADO') as aprobados,
                COUNT(*) FILTER (WHERE UPPER(resultado) = 'RECHAZADO') as rechazados,
                COALESCE(SUM(cantidad_postes), 0) as total_postes,
                ROUND(AVG(cantidad_postes)::numeric, 1) as promedio_postes,
                COUNT(*) FILTER (WHERE UPPER(tiene_plano_norm) = 'SI') as con_plano,
                COUNT(*) FILTER (WHERE UPPER(tiene_plano_norm) = 'NO') as sin_plano,
                COUNT(*) FILTER (WHERE UPPER(tiene_plano_norm) IN ('INCOMPLETO','PARCIAL')) as plano_incompleto
            FROM telecomunicaciones WHERE {where}
        """, params),
        # 2) Por empresa
        execute_query(f"""
            SELECT empresa_corta as empresa, COUNT(*) as cantidad,
                COUNT(*) FILTER (WHERE UPPER(resultado) = 'APROBADO') as aprobados,
                COALESCE(SUM(cantidad_postes), 0) as postes
            FROM telecomunicaciones WHERE {where} AND TRIM(COALESCE(empresa_corta,'')) != ''
            GROUP BY empresa_corta ORDER BY cantidad DESC LIMIT 10
        """, params),
        # 3) Por comuna
        execute_query(f"""
            SELECT comuna, COUNT(*) as cantidad
            FROM telecomunicaciones WHERE {where} AND TRIM(COALESCE(comuna,'')) != ''
            GROUP BY comuna ORDER BY cantidad DESC LIMIT 15
        """, params),
        # 4) Por inspector
        execute_query(f"""
            SELECT inspector, COUNT(*) as cantidad,
                COUNT(*) FILTER (WHERE UPPER(resultado) = 'APROBADO') as aprobados,
                COALESCE(SUM(cantidad_postes), 0) as postes
            FROM telecomunicaciones WHERE {where} AND TRIM(COALESCE(inspector,'')) != ''
            GROUP BY inspector ORDER BY cantidad DESC
        """, params),
        # 5) Por resultado
        execute_query(f"""
            SELECT resultado, COUNT(*) as cantidad
            FROM telecomunicaciones WHERE {where} AND TRIM(COALESCE(resultado,'')) != ''
            GROUP BY resultado ORDER BY cantidad DESC
        """, params),
        # 6) Por tiene plano
        execute_query(f"""
            SELECT tiene_plano_norm as tipo, COUNT(*) as cantidad
            FROM telecomunicaciones WHERE {where} AND tiene_plano_norm IS NOT NULL
            GROUP BY tiene_plano_norm ORDER BY cantidad DESC
        """, params),
        # 7) Por mes
        execute_query(f"""
            SELECT mes, COUNT(*) as cantidad,
                COUNT(*) FILTER (WHERE UPPER(resultado) = 'APROBADO') as aprobados
            FROM telecomunicaciones WHERE {where} AND mes IS NOT NULL
            GROUP BY mes ORDER BY mes
        """, params),
        # 8) Evolucion mensual
        execute_query(f"""
            SELECT TO_CHAR(fecha_inspeccion, 'YYYY-MM') as periodo,
                COUNT(*) as casos,
                COALESCE(SUM(cantidad_postes), 0) as postes,
                COUNT(*) FILTER (WHERE UPPER(resultado) = 'APROBADO') as aprobados
            FROM telecomunicaciones WHERE {where} AND fecha_inspeccion IS NOT NULL
            GROUP BY periodo ORDER BY periodo
        """, params),
        # 9) Comparativas
        execute_query(f"""
            WITH ranked AS (
                SELECT *, ROW_NUMBER() OVER (ORDER BY fecha_inspeccion) as rn,
                    COUNT(*) OVER () as cnt
                FROM telecomunicaciones WHERE {where} AND fecha_inspeccion IS NOT NULL
            )
            SELECT
                CASE WHEN rn <= cnt/2 THEN 'primera' ELSE 'segunda' END as mitad,
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE UPPER(resultado) = 'APROBADO') as aprobados
            FROM ranked GROUP BY mitad ORDER BY mitad
        """, params),
        # 10) Motivos de rechazo - single query with CASE WHEN / FILTER
        execute_query(f"""
            SELECT
                COUNT(*) FILTER (WHERE LOWER(observacion) LIKE '%%saturacion%%' OR LOWER(observacion) LIKE '%%saturado%%' OR LOWER(observacion) LIKE '%%espacio aereo%%') as saturacion,
                COUNT(*) FILTER (WHERE LOWER(observacion) LIKE '%%vanos fuera%%' OR LOWER(observacion) LIKE '%%vano fuera%%' OR LOWER(observacion) LIKE '%%distancia%%') as vanos_fuera,
                COUNT(*) FILTER (WHERE LOWER(observacion) LIKE '%%escombro%%') as escombro,
                COUNT(*) FILTER (WHERE LOWER(observacion) LIKE '%%vegetacion%%' OR LOWER(observacion) LIKE '%%poda%%' OR LOWER(observacion) LIKE '%%arbol%%') as vegetacion,
                COUNT(*) FILTER (WHERE LOWER(observacion) LIKE '%%solucion mecanica%%' OR LOWER(observacion) LIKE '%%mecanica%%') as solucion_mecanica,
                COUNT(*) FILTER (WHERE LOWER(observacion) LIKE '%%ya realizados%%' OR LOWER(observacion) LIKE '%%realizados en terreno%%') as ya_realizados,
                COUNT(*) FILTER (WHERE LOWER(observacion) LIKE '%%reserva tecnica%%') as reserva_tecnica,
                COUNT(*) FILTER (WHERE LOWER(observacion) LIKE '%%cruceta%%' OR LOWER(observacion) LIKE '%%mal estado%%') as crucetas,
                COUNT(*) FILTER (WHERE LOWER(observacion) LIKE '%%apoyos%%' OR LOWER(observacion) LIKE '%%mas de 10%%' OR LOWER(observacion) LIKE '%%mas de 13%%') as sobrecarga
            FROM telecomunicaciones WHERE {where} AND UPPER(resultado) = 'RECHAZADO'
        """, params),
    )

    # --- Process results ---

    if not kpis or kpis[0]["total"] == 0:
        return empty_response

    k = kpis[0]
    total = k["total"]
    aprobados = k["aprobados"]
    rechazados = k["rechazados"]
    total_con_resultado = aprobados + rechazados
    tasa_aprobacion = round(aprobados / total_con_resultado * 100, 1) if total_con_resultado > 0 else 0
    promedio_postes = float(k["promedio_postes"]) if k["promedio_postes"] else 0

    por_empresa = [
        {"empresa": r["empresa"], "cantidad": r["cantidad"], "aprobados": r["aprobados"],
         "tasa_aprobacion": round(r["aprobados"] / r["cantidad"] * 100, 1) if r["cantidad"] > 0 else 0,
         "postes": r["postes"]}
        for r in emp_rows
    ]

    por_comuna = [{"comuna": r["comuna"], "cantidad": r["cantidad"]} for r in com_rows]

    por_inspector = [
        {"inspector": r["inspector"], "cantidad": r["cantidad"], "aprobados": r["aprobados"],
         "tasa_aprobacion": round(r["aprobados"] / r["cantidad"] * 100, 1) if r["cantidad"] > 0 else 0,
         "postes": r["postes"]}
        for r in insp_rows
    ]

    por_resultado = {r["resultado"]: r["cantidad"] for r in res_rows}

    por_tiene_plano = [{"tipo": r["tipo"], "cantidad": r["cantidad"]} for r in plano_rows]

    por_mes = [
        {"mes": str(r["mes"]), "cantidad": r["cantidad"], "aprobados": r["aprobados"],
         "tasa_aprobacion": round(r["aprobados"] / r["cantidad"] * 100, 1) if r["cantidad"] > 0 else 0}
        for r in mes_rows
    ]

    evolucion_mensual = [
        {"periodo": r["periodo"], "casos": r["casos"], "postes": r["postes"], "aprobados": r["aprobados"]}
        for r in evol_rows[-12:]
    ]

    # Comparativas
    comparativas = {"aprobacion": {"actual": 0, "anterior": 0, "diferencia": 0}}
    if total > 10 and len(comp_rows) == 2:
        ant = comp_rows[0]
        act = comp_rows[1]
        tasa_ant = round(ant["aprobados"] / ant["total"] * 100, 1) if ant["total"] > 0 else 0
        tasa_act = round(act["aprobados"] / act["total"] * 100, 1) if act["total"] > 0 else 0
        comparativas["aprobacion"] = {
            "actual": tasa_act, "anterior": tasa_ant,
            "diferencia": round(tasa_act - tasa_ant, 1),
        }

    # Motivos de rechazo
    motivos_rechazo = []
    if rechazados > 0 and motivos_row:
        m = motivos_row[0]
        motivos_mapping = [
            ("SATURACION ESPACIO AEREO", m["saturacion"]),
            ("VANOS FUERA DE NORMA", m["vanos_fuera"]),
            ("ESCOMBRO AEREO", m["escombro"]),
            ("VEGETACION EN LINEAS", m["vegetacion"]),
            ("FALTA SOLUCION MECANICA", m["solucion_mecanica"]),
            ("TRABAJOS YA REALIZADOS", m["ya_realizados"]),
            ("RESERVA TECNICA FUERA DE NORMA", m["reserva_tecnica"]),
            ("CRUCETAS EN MAL ESTADO", m["crucetas"]),
            ("SOBRECARGA DE APOYOS", m["sobrecarga"]),
        ]
        for motivo, count in motivos_mapping:
            if count and count > 0:
                motivos_rechazo.append({
                    "motivo": motivo, "cantidad": count,
                    "porcentaje": round(count / rechazados * 100, 1),
                })
        motivos_rechazo.sort(key=lambda x: x["cantidad"], reverse=True)

    # Insights
    insights = []
    if tasa_aprobacion < META_APROBACION:
        insights.append({"tipo": "warning", "titulo": "Tasa de aprobacion baja",
                         "mensaje": f"Solo {tasa_aprobacion}% de los casos fueron aprobados (meta: {META_APROBACION}%)"})
    elif tasa_aprobacion >= 60:
        insights.append({"tipo": "success", "titulo": "Buena tasa de aprobacion",
                         "mensaje": f"{tasa_aprobacion}% de los casos fueron aprobados"})

    if rechazados > aprobados:
        insights.append({"tipo": "warning", "titulo": "Mas rechazos que aprobaciones",
                         "mensaje": f"{rechazados} rechazados vs {aprobados} aprobados"})

    sin_plano = k["sin_plano"]
    plano_inc = k["plano_incompleto"]
    con_plano = k["con_plano"]
    if sin_plano + plano_inc > con_plano * 0.2:
        insights.append({"tipo": "info", "titulo": "Casos sin plano completo",
                         "mensaje": f"{sin_plano + plano_inc} casos sin plano o con plano incompleto"})

    if por_empresa:
        top = por_empresa[0]
        insights.append({"tipo": "info", "titulo": f"Principal cliente: {top['empresa']}",
                         "mensaje": f"{top['cantidad']} casos ({top['postes']} postes)"})

    total_postes = k["total_postes"]
    if total_postes > 0:
        insights.append({"tipo": "info", "titulo": f"Total postes evaluados: {total_postes:,}",
                         "mensaje": f"Promedio de {promedio_postes} postes por caso"})

    return {
        "total": total, "aprobados": aprobados, "rechazados": rechazados,
        "tasa_aprobacion": tasa_aprobacion,
        "total_postes": total_postes, "promedio_postes": promedio_postes,
        "con_plano": con_plano, "sin_plano": sin_plano, "plano_incompleto": plano_inc,
        "por_empresa": por_empresa, "por_comuna": por_comuna, "por_inspector": por_inspector,
        "por_resultado": por_resultado, "por_mes": por_mes, "por_tiene_plano": por_tiene_plano,
        "motivos_rechazo": motivos_rechazo, "evolucion_mensual": evolucion_mensual,
        "comparativas": comparativas, "insights": insights,
    }


@cached(ttl_seconds=60)
async def get_teleco_analisis_operacional(
    empresa: Optional[str] = None, comuna: Optional[str] = None,
    fecha_desde: Optional[str] = None, fecha_hasta: Optional[str] = None,
    mes: Optional[int] = None, anio: Optional[int] = None,
) -> Dict[str, Any]:
    """Análisis operacional detallado: rechazos, reinspecciones, responsabilidades."""
    where, params = _build_where(
        empresa=empresa, comuna=comuna, fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta, mes=mes, anio=anio,
    )

    (
        rechazos_resp,
        reinspecciones,
        calidad_plano,
        inspector_ranking,
        empresa_tiempos,
        obs_vacias,
    ) = await asyncio.gather(
        # 1) Clasificación de rechazos por responsabilidad
        execute_query(f"""
            SELECT
                COUNT(*) FILTER (WHERE
                    LOWER(observacion) LIKE '%%saturacion%%' OR
                    LOWER(observacion) LIKE '%%espacio aereo%%' OR
                    LOWER(observacion) LIKE '%%sobrecarga%%' OR
                    LOWER(observacion) LIKE '%%mas de 10%%' OR
                    LOWER(observacion) LIKE '%%mas de 13%%'
                ) as resp_red,
                COUNT(*) FILTER (WHERE
                    LOWER(observacion) LIKE '%%sin plano%%' OR
                    LOWER(observacion) LIKE '%%plano incompleto%%' OR
                    LOWER(observacion) LIKE '%%falta documentacion%%' OR
                    LOWER(observacion) LIKE '%%ya realizados%%' OR
                    UPPER(tiene_plano_norm) = 'NO'
                ) as resp_cliente,
                COUNT(*) FILTER (WHERE
                    LOWER(observacion) LIKE '%%vegetacion%%' OR
                    LOWER(observacion) LIKE '%%poda%%' OR
                    LOWER(observacion) LIKE '%%escombro%%' OR
                    LOWER(observacion) LIKE '%%cruceta%%' OR
                    LOWER(observacion) LIKE '%%mal estado%%'
                ) as resp_mantenimiento,
                COUNT(*) as total_rechazados
            FROM telecomunicaciones
            WHERE {where} AND UPPER(resultado) = 'RECHAZADO'
        """, params),
        # 2) Casos con múltiples inspecciones (reinspecciones)
        execute_query(f"""
            WITH casos_multiples AS (
                SELECT family_case, COUNT(*) as inspecciones,
                    COUNT(*) FILTER (WHERE UPPER(resultado) = 'APROBADO') as aprobados,
                    COUNT(*) FILTER (WHERE UPPER(resultado) = 'RECHAZADO') as rechazados,
                    MAX(fecha_inspeccion) as ultima_inspeccion,
                    MIN(fecha_inspeccion) as primera_inspeccion
                FROM telecomunicaciones
                WHERE {where} AND family_case IS NOT NULL
                GROUP BY family_case
                HAVING COUNT(*) > 1
            )
            SELECT
                COUNT(*) as casos_reinspeccionados,
                SUM(inspecciones) as total_inspecciones,
                ROUND(AVG(inspecciones)::numeric, 1) as promedio_reinspecciones,
                COUNT(*) FILTER (WHERE aprobados = 0) as nunca_aprobados,
                COUNT(*) FILTER (WHERE rechazados >= 2) as multiples_rechazos
            FROM casos_multiples
        """, params),
        # 3) Calidad de planos por empresa
        execute_query(f"""
            SELECT empresa_corta as empresa,
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE UPPER(tiene_plano_norm) = 'SI') as con_plano,
                COUNT(*) FILTER (WHERE UPPER(tiene_plano_norm) = 'NO') as sin_plano,
                COUNT(*) FILTER (WHERE UPPER(tiene_plano_norm) IN ('INCOMPLETO','PARCIAL')) as incompleto,
                ROUND(COUNT(*) FILTER (WHERE UPPER(tiene_plano_norm) = 'SI') * 100.0 / NULLIF(COUNT(*), 0), 1) as pct_con_plano
            FROM telecomunicaciones
            WHERE {where} AND TRIM(COALESCE(empresa_corta,'')) != ''
            GROUP BY empresa_corta
            ORDER BY total DESC
            LIMIT 10
        """, params),
        # 4) Ranking de inspectores (mejores y peores)
        execute_query(f"""
            SELECT inspector,
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE UPPER(resultado) = 'APROBADO') as aprobados,
                COUNT(*) FILTER (WHERE UPPER(resultado) = 'RECHAZADO') as rechazados,
                ROUND(COUNT(*) FILTER (WHERE UPPER(resultado) = 'APROBADO') * 100.0 / NULLIF(COUNT(*), 0), 1) as tasa_aprobacion,
                COALESCE(SUM(cantidad_postes), 0) as postes,
                COUNT(*) FILTER (WHERE TRIM(COALESCE(observacion,'')) = '') as obs_vacias
            FROM telecomunicaciones
            WHERE {where} AND TRIM(COALESCE(inspector,'')) != ''
            GROUP BY inspector
            HAVING COUNT(*) >= 5
            ORDER BY tasa_aprobacion DESC
        """, params),
        # 5) Tiempos promedio por empresa (días entre primera y última inspección del caso)
        execute_query(f"""
            WITH tiempos AS (
                SELECT empresa_corta,
                    family_case,
                    EXTRACT(DAY FROM MAX(fecha_inspeccion) - MIN(fecha_inspeccion)) as dias
                FROM telecomunicaciones
                WHERE {where} AND family_case IS NOT NULL AND fecha_inspeccion IS NOT NULL
                GROUP BY empresa_corta, family_case
                HAVING COUNT(*) > 1
            )
            SELECT empresa_corta as empresa,
                COUNT(DISTINCT family_case) as casos,
                ROUND(AVG(dias)::numeric, 1) as dias_promedio,
                MAX(dias) as dias_max
            FROM tiempos
            WHERE TRIM(COALESCE(empresa_corta,'')) != ''
            GROUP BY empresa_corta
            ORDER BY casos DESC
            LIMIT 10
        """, params),
        # 6) Observaciones vacías o genéricas
        execute_query(f"""
            SELECT
                COUNT(*) FILTER (WHERE TRIM(COALESCE(observacion,'')) = '') as sin_observacion,
                COUNT(*) FILTER (WHERE
                    LOWER(observacion) LIKE '%%sin novedad%%' OR
                    LOWER(observacion) LIKE '%%ok%%' OR
                    LOWER(observacion) = 'aprobado' OR
                    LOWER(observacion) = 'rechazado' OR
                    LENGTH(TRIM(COALESCE(observacion,''))) < 10
                ) as observacion_generica,
                COUNT(*) as total
            FROM telecomunicaciones WHERE {where}
        """, params),
    )

    # Procesar responsabilidad de rechazos
    resp_rechazos = {"red": 0, "cliente": 0, "mantenimiento": 0, "otros": 0}
    if rechazos_resp and rechazos_resp[0]["total_rechazados"] > 0:
        r = rechazos_resp[0]
        total_rech = r["total_rechazados"]
        resp_rechazos = {
            "red": r["resp_red"] or 0,
            "cliente": r["resp_cliente"] or 0,
            "mantenimiento": r["resp_mantenimiento"] or 0,
            "otros": max(0, total_rech - (r["resp_red"] or 0) - (r["resp_cliente"] or 0) - (r["resp_mantenimiento"] or 0)),
            "total": total_rech,
        }

    # Procesar reinspecciones
    reins = {"casos": 0, "inspecciones": 0, "promedio": 0, "nunca_aprobados": 0, "multiples_rechazos": 0}
    if reinspecciones and reinspecciones[0]["casos_reinspeccionados"]:
        ri = reinspecciones[0]
        reins = {
            "casos": ri["casos_reinspeccionados"] or 0,
            "inspecciones": ri["total_inspecciones"] or 0,
            "promedio": float(ri["promedio_reinspecciones"]) if ri["promedio_reinspecciones"] else 0,
            "nunca_aprobados": ri["nunca_aprobados"] or 0,
            "multiples_rechazos": ri["multiples_rechazos"] or 0,
        }

    # Ranking de inspectores
    ranking = []
    for r in (inspector_ranking or []):
        ranking.append({
            "inspector": r["inspector"],
            "total": r["total"],
            "aprobados": r["aprobados"],
            "rechazados": r["rechazados"],
            "tasa_aprobacion": float(r["tasa_aprobacion"]) if r["tasa_aprobacion"] else 0,
            "postes": r["postes"],
            "obs_vacias": r["obs_vacias"],
            "calidad_doc": "buena" if r["obs_vacias"] < r["total"] * 0.1 else "regular" if r["obs_vacias"] < r["total"] * 0.3 else "mala",
        })

    # Calidad de planos por empresa
    calidad = []
    for r in (calidad_plano or []):
        calidad.append({
            "empresa": r["empresa"],
            "total": r["total"],
            "con_plano": r["con_plano"],
            "sin_plano": r["sin_plano"],
            "incompleto": r["incompleto"],
            "pct_con_plano": float(r["pct_con_plano"]) if r["pct_con_plano"] else 0,
        })

    # Tiempos de resolución
    tiempos = []
    for r in (empresa_tiempos or []):
        tiempos.append({
            "empresa": r["empresa"],
            "casos": r["casos"],
            "dias_promedio": float(r["dias_promedio"]) if r["dias_promedio"] else 0,
            "dias_max": r["dias_max"] or 0,
        })

    # Calidad de documentación
    doc = {"sin_observacion": 0, "observacion_generica": 0, "total": 0, "pct_problemas": 0}
    if obs_vacias and obs_vacias[0]["total"] > 0:
        o = obs_vacias[0]
        problemas = (o["sin_observacion"] or 0) + (o["observacion_generica"] or 0)
        doc = {
            "sin_observacion": o["sin_observacion"] or 0,
            "observacion_generica": o["observacion_generica"] or 0,
            "total": o["total"],
            "pct_problemas": round(problemas / o["total"] * 100, 1) if o["total"] > 0 else 0,
        }

    # Generar alertas operacionales
    alertas = []
    if reins["nunca_aprobados"] > 5:
        alertas.append({
            "tipo": "danger",
            "titulo": f"{reins['nunca_aprobados']} casos nunca aprobados",
            "mensaje": "Casos con múltiples inspecciones que nunca han sido aprobados. Requieren revisión.",
        })
    if resp_rechazos.get("cliente", 0) > resp_rechazos.get("total", 1) * 0.3:
        alertas.append({
            "tipo": "warning",
            "titulo": "Alto % de rechazos por cliente",
            "mensaje": f"{resp_rechazos['cliente']} rechazos por documentación incompleta o trabajos ya realizados.",
        })
    if doc["pct_problemas"] > 20:
        alertas.append({
            "tipo": "warning",
            "titulo": "Calidad de documentación baja",
            "mensaje": f"{doc['pct_problemas']}% de inspecciones con observaciones vacías o genéricas.",
        })

    # Identificar peores inspectores
    peores = [r for r in ranking if r["tasa_aprobacion"] < 40 and r["total"] >= 10]
    if peores:
        nombres = ", ".join([p["inspector"] for p in peores[:3]])
        alertas.append({
            "tipo": "warning",
            "titulo": "Inspectores con baja aprobación",
            "mensaje": f"Inspectores con tasa < 40%: {nombres}. Revisar capacitación.",
        })

    return {
        "responsabilidad_rechazos": resp_rechazos,
        "reinspecciones": reins,
        "calidad_planos_empresa": calidad,
        "ranking_inspectores": ranking,
        "tiempos_resolucion": tiempos,
        "calidad_documentacion": doc,
        "alertas": alertas,
    }


@cached(ttl_seconds=300)
async def get_teleco_empresas() -> List[str]:
    rows = await execute_query("SELECT DISTINCT empresa_corta FROM telecomunicaciones WHERE TRIM(COALESCE(empresa_corta,'')) != '' ORDER BY empresa_corta")
    return [r["empresa_corta"] for r in rows]


@cached(ttl_seconds=300)
async def get_teleco_comunas() -> List[str]:
    rows = await execute_query("SELECT DISTINCT comuna FROM telecomunicaciones WHERE TRIM(COALESCE(comuna,'')) != '' ORDER BY comuna")
    return [r["comuna"] for r in rows]


@cached(ttl_seconds=300)
async def get_teleco_inspectors() -> List[Dict[str, Any]]:
    rows = await execute_query("""
        SELECT inspector, COUNT(*) as cantidad,
            COUNT(*) FILTER (WHERE UPPER(resultado) = 'APROBADO') as aprobados,
            COALESCE(SUM(cantidad_postes), 0) as postes
        FROM telecomunicaciones WHERE TRIM(COALESCE(inspector,'')) != ''
        GROUP BY inspector ORDER BY cantidad DESC
    """)
    return [
        {"inspector": r["inspector"], "cantidad": r["cantidad"], "aprobados": r["aprobados"],
         "tasa_aprobacion": round(r["aprobados"] / r["cantidad"] * 100, 1) if r["cantidad"] > 0 else 0,
         "postes": r["postes"]}
        for r in rows
    ]


@cached(ttl_seconds=300)
async def get_teleco_periodos() -> Dict[str, Any]:
    rows = await execute_query("""
        SELECT
            ARRAY_AGG(DISTINCT mes ORDER BY mes) FILTER (WHERE mes IS NOT NULL) as meses,
            ARRAY_AGG(DISTINCT anio ORDER BY anio) FILTER (WHERE anio IS NOT NULL) as anios,
            (SELECT mes FROM telecomunicaciones WHERE mes IS NOT NULL AND anio IS NOT NULL ORDER BY anio DESC, mes DESC LIMIT 1) as ultimo_mes,
            (SELECT anio FROM telecomunicaciones WHERE mes IS NOT NULL AND anio IS NOT NULL ORDER BY anio DESC, mes DESC LIMIT 1) as ultimo_anio
        FROM telecomunicaciones
    """)
    if rows:
        return {
            "meses": rows[0]["meses"] or [],
            "anios": rows[0]["anios"] or [],
            "ultimo_mes": rows[0]["ultimo_mes"],
            "ultimo_anio": rows[0]["ultimo_anio"],
        }
    return {"meses": [], "anios": [], "ultimo_mes": None, "ultimo_anio": None}
