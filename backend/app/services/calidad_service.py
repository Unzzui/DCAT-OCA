"""
Servicio de datos para el modulo de Control de Perdidas (Calidad).
Optimizado: queries SQL directas en vez de cargar DataFrames completos.
"""

import asyncio
from typing import Optional, Dict, Any, List
from ..core.config import settings
from .db_queries import execute_query, execute_scalar
from .cache import cached


def _build_where(
    tipo_sistema: Optional[str] = None,
    comuna: Optional[str] = None,
    contratista: Optional[str] = None,
    inspector: Optional[str] = None,
    tipo_resultado: Optional[str] = None,
    mes: Optional[int] = None,
    anio: Optional[int] = None,
    search: Optional[str] = None,
    table_prefix: str = "",
) -> tuple[str, dict]:
    conditions = []
    params = {}
    p = f"{table_prefix}." if table_prefix else ""

    if comuna:
        conditions.append(f"UPPER({p}comuna) = UPPER(:comuna)")
        params["comuna"] = comuna
    if contratista:
        conditions.append(f"UPPER({p}contratista) = UPPER(:contratista)")
        params["contratista"] = contratista
    if inspector:
        conditions.append(f"{p}inspector ILIKE :inspector")
        params["inspector"] = f"%{inspector}%"
    if tipo_resultado:
        conditions.append(f"{p}tipo_resultado ILIKE :tipo_resultado")
        params["tipo_resultado"] = f"%{tipo_resultado}%"
    if mes:
        conditions.append(f"{p}mes = :mes")
        params["mes"] = mes
    if anio:
        conditions.append(f"{p}anio = :anio")
        params["anio"] = anio
    if search:
        conditions.append(
            f"(CAST({p}cliente AS TEXT) ILIKE :search OR {p}nombre_cliente ILIKE :search "
            f"OR {p}direccion ILIKE :search OR {p}comuna ILIKE :search "
            f"OR {p}medidor ILIKE :search OR {p}inspector ILIKE :search)"
        )
        params["search"] = f"%{search}%"

    where = " AND ".join(conditions) if conditions else "1=1"
    return where, params


@cached(ttl_seconds=60)
async def get_calidad_stats(
    tipo_sistema: Optional[str] = None,
    comuna: Optional[str] = None,
    contratista: Optional[str] = None,
    mes: Optional[int] = None,
    anio: Optional[int] = None,
) -> Dict[str, Any]:
    where, params = _build_where(comuna=comuna, contratista=contratista, mes=mes, anio=anio)

    empty_response = {
        "total_solicitadas": 0, "total_ejecutadas": 0, "pendientes": 0, "tasa_ejecucion": 0,
        "monofasico": {"solicitadas": 0, "ejecutadas": 0, "tasa": 0},
        "trifasico": {"solicitadas": 0, "ejecutadas": 0, "tasa": 0},
        "por_resultado": [], "por_estado_propiedad": [], "por_estado_suministro": [],
        "por_comuna": [], "por_inspector": [], "por_contratista": [], "por_giro": [],
        "anomalias": {"modelo_no_corresponde": 0, "medidor_no_corresponde": 0,
                      "requiere_normalizacion": 0, "perno_no_normalizado": 0},
        "calidad_instalacion": {"acometida_normal": 0, "acometida_anormal": 0,
                                "caja_normal": 0, "caja_anormal": 0,
                                "tapa_normal": 0, "tapa_anormal": 0},
        "metricas_electricas": {"voltaje_promedio": 0, "amperaje_promedio": 0,
                                "error_promedio": 0, "error_max": 0,
                                "factor_potencia_promedio": 0},
        "insights": [],
    }

    # Build tipo_sistema filter
    tipo_filter = ""
    if tipo_sistema:
        if tipo_sistema.upper() == "MONOFASICO":
            tipo_filter = "AND tipo_sistema = 'MONOFASICO'"
        elif tipo_sistema.upper() == "TRIFASICO":
            tipo_filter = "AND tipo_sistema = 'TRIFASICO'"

    # Fire ALL independent queries in parallel using asyncio.gather
    (
        insp_mono,
        insp_tri,
        kpis,
        res_rows,
        ep_rows,
        es_rows,
        com_rows,
        insp_rows,
        cont_rows,
    ) = await asyncio.gather(
        # Inspecciones counts (solicitadas)
        execute_scalar("SELECT COUNT(*) FROM calidad_mono_inspecciones"),
        execute_scalar("SELECT COUNT(*) FROM calidad_tri_inspecciones"),
        # KPIs from combined base tables
        # Note: requiere_normalizacion is text in mono but double precision in tri — cast to text
        execute_query(f"""
            WITH combined AS (
                SELECT tipo_sistema, tipo_resultado, modelo_corresponde, medidor_corresponde,
                       requiere_normalizacion, perno_normalizado, estado_acometida, estado_caja, estado_tapa,
                       voltaje, amperaje, error_porcentaje, NULL::double precision as factor_potencia,
                       comuna, inspector, contratista, mes, anio
                FROM calidad_mono_base
                UNION ALL
                SELECT tipo_sistema, tipo_resultado, NULL::text as modelo_corresponde, NULL::text as medidor_corresponde,
                       requiere_normalizacion::text, perno_normalizado, estado_acometida, estado_caja, estado_tapa,
                       voltaje, NULL::double precision as amperaje, error_porcentaje, factor_potencia,
                       comuna, inspector, contratista, mes, anio
                FROM calidad_tri_base
            )
            SELECT
                COUNT(*) as total_ejecutadas,
                COUNT(*) FILTER (WHERE tipo_sistema = 'MONOFASICO') as ejecutadas_mono,
                COUNT(*) FILTER (WHERE tipo_sistema = 'TRIFASICO') as ejecutadas_tri,
                COUNT(*) FILTER (WHERE UPPER(modelo_corresponde) LIKE '%%NO%%') as modelo_no_corresponde,
                COUNT(*) FILTER (WHERE UPPER(medidor_corresponde) LIKE '%%NO%%') as medidor_no_corresponde,
                COUNT(*) FILTER (WHERE requiere_normalizacion IS NOT NULL AND TRIM(COALESCE(requiere_normalizacion,'')) != '') as requiere_normalizacion,
                COUNT(*) FILTER (WHERE UPPER(perno_normalizado) LIKE '%%NO%%') as perno_no_normalizado,
                COUNT(*) FILTER (WHERE UPPER(estado_acometida) LIKE '%%NORMAL%%') as acometida_normal,
                COUNT(*) FILTER (WHERE UPPER(COALESCE(estado_acometida,'')) NOT LIKE '%%NORMAL%%'
                                 AND TRIM(COALESCE(estado_acometida,'')) != '') as acometida_anormal,
                COUNT(*) FILTER (WHERE UPPER(estado_caja) LIKE '%%NORMAL%%') as caja_normal,
                COUNT(*) FILTER (WHERE UPPER(COALESCE(estado_caja,'')) NOT LIKE '%%NORMAL%%'
                                 AND TRIM(COALESCE(estado_caja,'')) != '') as caja_anormal,
                COUNT(*) FILTER (WHERE UPPER(estado_tapa) LIKE '%%NORMAL%%') as tapa_normal,
                COUNT(*) FILTER (WHERE UPPER(COALESCE(estado_tapa,'')) NOT LIKE '%%NORMAL%%'
                                 AND TRIM(COALESCE(estado_tapa,'')) != '') as tapa_anormal,
                ROUND(AVG(voltaje)::numeric, 1) as voltaje_promedio,
                ROUND(AVG(amperaje)::numeric, 2) as amperaje_promedio,
                ROUND(AVG(error_porcentaje)::numeric, 2) as error_promedio,
                ROUND(MAX(error_porcentaje)::numeric, 2) as error_max,
                ROUND(AVG(factor_potencia)::numeric, 2) as fp_promedio
            FROM combined WHERE {where} {tipo_filter}
        """, params),
        # Por resultado
        execute_query(f"""
            WITH combined AS (
                SELECT tipo_resultado, comuna, inspector, contratista, mes, anio
                FROM calidad_mono_base UNION ALL
                SELECT tipo_resultado, comuna, inspector, contratista, mes, anio
                FROM calidad_tri_base
            )
            SELECT tipo_resultado as resultado, COUNT(*) as cantidad
            FROM combined WHERE {where} AND TRIM(COALESCE(tipo_resultado,'')) != ''
            GROUP BY tipo_resultado ORDER BY cantidad DESC
        """, params),
        # Por estado propiedad
        execute_query(f"""
            WITH combined AS (
                SELECT estado_propiedad, comuna, inspector, contratista, mes, anio FROM calidad_mono_base
                UNION ALL SELECT estado_propiedad, comuna, inspector, contratista, mes, anio FROM calidad_tri_base
            )
            SELECT estado_propiedad as estado, COUNT(*) as cantidad
            FROM combined WHERE {where} AND TRIM(COALESCE(estado_propiedad,'')) != ''
            GROUP BY estado_propiedad ORDER BY cantidad DESC
        """, params),
        # Por estado suministro (only mono has this column)
        execute_query(f"""
            SELECT estado_suministro as estado, COUNT(*) as cantidad
            FROM calidad_mono_base WHERE {where} AND TRIM(COALESCE(estado_suministro,'')) != ''
            GROUP BY estado_suministro ORDER BY cantidad DESC
        """, params),
        # Por comuna
        execute_query(f"""
            WITH combined AS (
                SELECT comuna, inspector, contratista, mes, anio FROM calidad_mono_base
                UNION ALL SELECT comuna, inspector, contratista, mes, anio FROM calidad_tri_base
            )
            SELECT comuna, COUNT(*) as cantidad
            FROM combined WHERE {where} AND TRIM(COALESCE(comuna,'')) != ''
            GROUP BY comuna ORDER BY cantidad DESC
        """, params),
        # Por inspector
        execute_query(f"""
            WITH combined AS (
                SELECT inspector, tipo_resultado, comuna, contratista, mes, anio FROM calidad_mono_base
                UNION ALL SELECT inspector, tipo_resultado, comuna, contratista, mes, anio FROM calidad_tri_base
            )
            SELECT inspector, COUNT(*) as cantidad,
                COUNT(*) FILTER (WHERE UPPER(tipo_resultado) LIKE '%%NORMAL%%') as normales
            FROM combined WHERE {where} AND TRIM(COALESCE(inspector,'')) != ''
            GROUP BY inspector ORDER BY cantidad DESC
        """, params),
        # Por contratista
        execute_query(f"""
            WITH combined AS (
                SELECT contratista, tipo_resultado, comuna, inspector, mes, anio FROM calidad_mono_base
                UNION ALL SELECT contratista, tipo_resultado, comuna, inspector, mes, anio FROM calidad_tri_base
            )
            SELECT contratista, COUNT(*) as cantidad,
                COUNT(*) FILTER (WHERE UPPER(tipo_resultado) LIKE '%%NORMAL%%') as normales
            FROM combined WHERE {where} AND TRIM(COALESCE(contratista,'')) != ''
            GROUP BY contratista ORDER BY cantidad DESC
        """, params),
    )

    # Process results after gather

    total_solicitadas = (insp_mono or 0) + (insp_tri or 0)

    if not kpis or kpis[0]["total_ejecutadas"] == 0:
        return empty_response

    k = kpis[0]
    total_ejecutadas = k["total_ejecutadas"]
    pendientes = max(0, total_solicitadas - total_ejecutadas)
    tasa_ejecucion = round(total_ejecutadas / total_solicitadas * 100, 1) if total_solicitadas > 0 else 0

    ejecutadas_mono = k["ejecutadas_mono"]
    ejecutadas_tri = k["ejecutadas_tri"]
    tasa_mono = round(ejecutadas_mono / insp_mono * 100, 1) if insp_mono and insp_mono > 0 else 0
    tasa_tri = round(ejecutadas_tri / insp_tri * 100, 1) if insp_tri and insp_tri > 0 else 0

    por_resultado = [{"resultado": r["resultado"], "cantidad": r["cantidad"]} for r in res_rows]

    por_estado_propiedad = [{"estado": r["estado"], "cantidad": r["cantidad"]} for r in ep_rows]

    por_estado_suministro = [{"estado": r["estado"], "cantidad": r["cantidad"]} for r in es_rows]

    por_comuna = [{"comuna": r["comuna"], "cantidad": r["cantidad"]} for r in com_rows]

    por_inspector = [
        {"inspector": r["inspector"], "cantidad": r["cantidad"], "normales": r["normales"],
         "tasa_normalidad": round(r["normales"] / r["cantidad"] * 100, 1) if r["cantidad"] > 0 else 0}
        for r in insp_rows
    ]

    por_contratista = [
        {"contratista": r["contratista"], "cantidad": r["cantidad"], "normales": r["normales"],
         "tasa_normalidad": round(r["normales"] / r["cantidad"] * 100, 1) if r["cantidad"] > 0 else 0}
        for r in cont_rows
    ]

    # Por giro - column not present in current data
    por_giro = []

    # Insights
    insights = []
    if tasa_ejecucion < 50:
        insights.append({"tipo": "warning", "titulo": "Baja tasa de ejecucion",
                         "mensaje": f"Solo se ha ejecutado el {tasa_ejecucion}% de las inspecciones solicitadas"})
    elif tasa_ejecucion >= 80:
        insights.append({"tipo": "success", "titulo": "Buena tasa de ejecucion",
                         "mensaje": f"Se ha ejecutado el {tasa_ejecucion}% de las inspecciones"})

    total_anomalias = (k["modelo_no_corresponde"] + k["medidor_no_corresponde"] +
                       k["requiere_normalizacion"] + k["perno_no_normalizado"])
    if total_anomalias > 0:
        pct = round(total_anomalias / total_ejecutadas * 100, 1)
        if pct > 10:
            insights.append({"tipo": "warning", "titulo": "Alto indice de anomalias",
                             "mensaje": f"{total_anomalias} casos ({pct}%) presentan anomalias en equipos"})

    normales_count = sum(r["cantidad"] for r in por_resultado if "NORMAL" in r["resultado"].upper())
    pct_normales = round(normales_count / total_ejecutadas * 100, 1) if total_ejecutadas > 0 else 0
    if pct_normales >= 90:
        insights.append({"tipo": "success", "titulo": "Alta tasa de normalidad",
                         "mensaje": f"{pct_normales}% de las inspecciones resultaron normales"})
    elif pct_normales < 70:
        insights.append({"tipo": "info", "titulo": "Tasa de normalidad moderada",
                         "mensaje": f"{pct_normales}% de las inspecciones resultaron normales"})

    error_max = float(k["error_max"]) if k["error_max"] else 0
    if error_max > 5:
        insights.append({"tipo": "warning", "titulo": "Error de medicion alto detectado",
                         "mensaje": f"Se detectaron errores de hasta {error_max}% en medidores"})

    return {
        "total_solicitadas": total_solicitadas, "total_ejecutadas": total_ejecutadas,
        "pendientes": pendientes, "tasa_ejecucion": tasa_ejecucion,
        "monofasico": {"solicitadas": insp_mono or 0, "ejecutadas": ejecutadas_mono, "tasa": tasa_mono},
        "trifasico": {"solicitadas": insp_tri or 0, "ejecutadas": ejecutadas_tri, "tasa": tasa_tri},
        "por_resultado": por_resultado, "por_estado_propiedad": por_estado_propiedad,
        "por_estado_suministro": por_estado_suministro, "por_comuna": por_comuna,
        "por_inspector": por_inspector, "por_contratista": por_contratista, "por_giro": por_giro,
        "anomalias": {
            "modelo_no_corresponde": k["modelo_no_corresponde"],
            "medidor_no_corresponde": k["medidor_no_corresponde"],
            "requiere_normalizacion": k["requiere_normalizacion"],
            "perno_no_normalizado": k["perno_no_normalizado"],
        },
        "calidad_instalacion": {
            "acometida_normal": k["acometida_normal"], "acometida_anormal": k["acometida_anormal"],
            "caja_normal": k["caja_normal"], "caja_anormal": k["caja_anormal"],
            "tapa_normal": k["tapa_normal"], "tapa_anormal": k["tapa_anormal"],
        },
        "metricas_electricas": {
            "voltaje_promedio": float(k["voltaje_promedio"]) if k["voltaje_promedio"] else 0,
            "amperaje_promedio": float(k["amperaje_promedio"]) if k["amperaje_promedio"] else 0,
            "error_promedio": float(k["error_promedio"]) if k["error_promedio"] else 0,
            "error_max": error_max,
            "factor_potencia_promedio": float(k["fp_promedio"]) if k["fp_promedio"] else 0,
        },
        "insights": insights,
    }


async def get_calidad_filtered_data(
    search: Optional[str] = None, tipo_sistema: Optional[str] = None,
    tipo_resultado: Optional[str] = None, comuna: Optional[str] = None,
    contratista: Optional[str] = None, inspector: Optional[str] = None,
    mes: Optional[int] = None, anio: Optional[int] = None,
    page: int = 1, limit: int = 50,
    sort_by: str = "incidencia", order: str = "desc"
) -> Dict[str, Any]:
    where, params = _build_where(
        comuna=comuna, contratista=contratista, inspector=inspector,
        tipo_resultado=tipo_resultado, mes=mes, anio=anio, search=search,
    )

    tipo_filter = ""
    if tipo_sistema:
        if tipo_sistema.upper() == "MONOFASICO":
            tipo_filter = "AND tipo_sistema = 'MONOFASICO'"
        elif tipo_sistema.upper() == "TRIFASICO":
            tipo_filter = "AND tipo_sistema = 'TRIFASICO'"

    total = await execute_scalar(f"""
        WITH combined AS (
            SELECT tipo_sistema, comuna, inspector, contratista, tipo_resultado, mes, anio
            FROM calidad_mono_base
            UNION ALL
            SELECT tipo_sistema, comuna, inspector, contratista, tipo_resultado, mes, anio
            FROM calidad_tri_base
        )
        SELECT COUNT(*) FROM combined WHERE {where} {tipo_filter}
    """, params)

    allowed_sort = {"incidencia", "comuna", "inspector", "contratista", "tipo_resultado", "tipo_sistema"}
    if sort_by not in allowed_sort:
        sort_by = "incidencia"
    order_dir = "ASC" if order == "asc" else "DESC"

    offset = (page - 1) * limit
    params["limit"] = limit
    params["offset"] = offset

    rows = await execute_query(f"""
        WITH combined AS (
            SELECT incidencia, tipo_sistema, cliente, nombre_cliente, direccion,
                   comuna, medidor, tarifa, inspector, contratista,
                   tipo_resultado, estado_propiedad, estado_suministro,
                   voltaje, error_porcentaje, mes, anio
            FROM calidad_mono_base
            UNION ALL
            SELECT incidencia, tipo_sistema, cliente, nombre_cliente, direccion,
                   comuna, medidor, tarifa, inspector, contratista,
                   tipo_resultado, estado_propiedad, NULL::text as estado_suministro,
                   voltaje, error_porcentaje, mes, anio
            FROM calidad_tri_base
        )
        SELECT incidencia, tipo_sistema, cliente, nombre_cliente, direccion,
               comuna, medidor, tarifa, inspector, contratista,
               tipo_resultado, estado_propiedad, estado_suministro,
               voltaje, error_porcentaje
        FROM combined WHERE {where} {tipo_filter}
        ORDER BY {sort_by} {order_dir} NULLS LAST
        LIMIT :limit OFFSET :offset
    """, params)

    pages = (total + limit - 1) // limit if total else 0
    return {"items": rows, "total": total or 0, "page": page, "limit": limit, "pages": pages}


@cached(ttl_seconds=300)
async def get_calidad_comunas() -> List[str]:
    rows = await execute_query("""
        SELECT DISTINCT comuna FROM (
            SELECT comuna FROM calidad_mono_base UNION SELECT comuna FROM calidad_tri_base
        ) t WHERE TRIM(COALESCE(comuna,'')) != '' ORDER BY comuna
    """)
    return [r["comuna"] for r in rows]


@cached(ttl_seconds=300)
async def get_calidad_inspectores() -> List[Dict[str, Any]]:
    rows = await execute_query("""
        WITH combined AS (
            SELECT inspector, tipo_resultado FROM calidad_mono_base
            UNION ALL SELECT inspector, tipo_resultado FROM calidad_tri_base
        )
        SELECT inspector, COUNT(*) as cantidad,
            COUNT(*) FILTER (WHERE UPPER(tipo_resultado) LIKE '%%NORMAL%%') as normales
        FROM combined WHERE TRIM(COALESCE(inspector,'')) != ''
        GROUP BY inspector ORDER BY cantidad DESC
    """)
    return [
        {"inspector": r["inspector"], "cantidad": r["cantidad"],
         "tasa_normalidad": round(r["normales"] / r["cantidad"] * 100, 1) if r["cantidad"] > 0 else 0}
        for r in rows
    ]


@cached(ttl_seconds=300)
async def get_calidad_contratistas() -> List[str]:
    rows = await execute_query("""
        SELECT DISTINCT contratista FROM (
            SELECT contratista FROM calidad_mono_base UNION SELECT contratista FROM calidad_tri_base
        ) t WHERE TRIM(COALESCE(contratista,'')) != '' ORDER BY contratista
    """)
    return [r["contratista"] for r in rows]


@cached(ttl_seconds=300)
async def get_calidad_resultados() -> List[str]:
    rows = await execute_query("""
        SELECT DISTINCT tipo_resultado FROM (
            SELECT tipo_resultado FROM calidad_mono_base UNION SELECT tipo_resultado FROM calidad_tri_base
        ) t WHERE TRIM(COALESCE(tipo_resultado,'')) != '' ORDER BY tipo_resultado
    """)
    return [r["tipo_resultado"] for r in rows]


@cached(ttl_seconds=300)
async def get_calidad_periodos() -> Dict[str, Any]:
    rows, latest = await asyncio.gather(
        execute_query("""
            WITH combined AS (
                SELECT mes, anio FROM calidad_mono_base UNION ALL SELECT mes, anio FROM calidad_tri_base
            )
            SELECT
                ARRAY_AGG(DISTINCT mes ORDER BY mes) FILTER (WHERE mes IS NOT NULL) as meses,
                ARRAY_AGG(DISTINCT anio ORDER BY anio) FILTER (WHERE anio IS NOT NULL) as anios
            FROM combined
        """),
        execute_query("""
            SELECT mes, anio FROM (
                SELECT mes, anio FROM calidad_mono_base WHERE mes IS NOT NULL AND anio IS NOT NULL
                UNION ALL
                SELECT mes, anio FROM calidad_tri_base WHERE mes IS NOT NULL AND anio IS NOT NULL
            ) t ORDER BY anio DESC, mes DESC LIMIT 1
        """),
    )
    result = {"meses": [], "anios": [], "ultimo_mes": None, "ultimo_anio": None}
    if rows:
        result["meses"] = rows[0]["meses"] or []
        result["anios"] = rows[0]["anios"] or []
    if latest:
        result["ultimo_mes"] = latest[0]["mes"]
        result["ultimo_anio"] = latest[0]["anio"]
    return result


async def get_calidad_evolucion(
    tipo_sistema: Optional[str] = None,
    contratista: Optional[str] = None,
) -> List[Dict[str, Any]]:
    conditions = []
    params = {}
    if contratista:
        conditions.append("UPPER(contratista) = UPPER(:contratista)")
        params["contratista"] = contratista

    tipo_filter = ""
    if tipo_sistema:
        if tipo_sistema.upper() == "MONOFASICO":
            tipo_filter = "AND tipo_sistema = 'MONOFASICO'"
        elif tipo_sistema.upper() == "TRIFASICO":
            tipo_filter = "AND tipo_sistema = 'TRIFASICO'"

    where = " AND ".join(conditions) if conditions else "1=1"

    meses_nombres = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

    rows = await execute_query(f"""
        WITH combined AS (
            SELECT tipo_resultado, modelo_corresponde, medidor_corresponde,
                   contratista, mes, anio, tipo_sistema
            FROM calidad_mono_base
            UNION ALL
            SELECT tipo_resultado, NULL as modelo_corresponde, NULL as medidor_corresponde,
                   contratista, mes, anio, tipo_sistema
            FROM calidad_tri_base
        )
        SELECT anio || '-' || LPAD(CAST(mes AS TEXT), 2, '0') as periodo,
            mes as mes_num, anio,
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE UPPER(tipo_resultado) LIKE '%%NORMAL%%') as normales,
            COUNT(*) FILTER (WHERE UPPER(modelo_corresponde) LIKE '%%NO%%') as modelo_no,
            COUNT(*) FILTER (WHERE UPPER(medidor_corresponde) LIKE '%%NO%%') as medidor_no
        FROM combined WHERE {where} {tipo_filter} AND mes IS NOT NULL AND anio IS NOT NULL
        GROUP BY anio, mes ORDER BY periodo
    """, params)

    evolucion = []
    for r in rows:
        t = r["total"]
        n = r["normales"]
        anomalias = r["modelo_no"] + r["medidor_no"]
        mn = r["mes_num"]
        label = f"{meses_nombres[mn]} {r['anio']}" if 1 <= mn <= 12 else r["periodo"]
        evolucion.append({
            "periodo": label, "total": t, "normales": n,
            "tasa_normalidad": round(n / t * 100, 1) if t > 0 else 0,
            "anomalias": anomalias,
            "tasa_anomalias": round(anomalias / t * 100, 1) if t > 0 else 0,
        })
    return evolucion
