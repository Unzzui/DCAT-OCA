"""
Servicio de datos para el modulo de Corte y Reposicion.
Optimizado: queries SQL directas en vez de cargar DataFrames completos.
"""

import asyncio
from typing import Optional, Dict, Any, List
from ..core.config import settings
from .db_queries import execute_query, execute_scalar
from .cache import cached


def _build_where(
    zona: Optional[str] = None,
    centro_operativo: Optional[str] = None,
    comuna: Optional[str] = None,
    inspector: Optional[str] = None,
    situacion_encontrada: Optional[str] = None,
    motivo_multa: Optional[str] = None,
    mes: Optional[int] = None,
    anio: Optional[int] = None,
    search: Optional[str] = None,
) -> tuple[str, dict]:
    conditions = []
    params = {}

    if zona:
        conditions.append("UPPER(zona) = UPPER(:zona)")
        params["zona"] = zona
    if centro_operativo:
        conditions.append("UPPER(centro_operativo) = UPPER(:centro_operativo)")
        params["centro_operativo"] = centro_operativo
    if comuna:
        conditions.append("UPPER(comuna) = UPPER(:comuna)")
        params["comuna"] = comuna
    if inspector:
        conditions.append("inspector ILIKE :inspector")
        params["inspector"] = f"%{inspector}%"
    if situacion_encontrada:
        conditions.append("situacion_encontrada ILIKE :situacion_encontrada")
        params["situacion_encontrada"] = f"%{situacion_encontrada}%"
    if motivo_multa:
        conditions.append("motivo_multa ILIKE :motivo_multa")
        params["motivo_multa"] = f"%{motivo_multa}%"
    if mes:
        conditions.append("mes = :mes")
        params["mes"] = mes
    if anio:
        conditions.append("anio = :anio")
        params["anio"] = anio
    if search:
        conditions.append(
            "(CAST(suministro AS TEXT) ILIKE :search OR nombre_cliente ILIKE :search "
            "OR direccion ILIKE :search OR comuna ILIKE :search "
            "OR inspector ILIKE :search OR nro_medidor ILIKE :search)"
        )
        params["search"] = f"%{search}%"

    where = " AND ".join(conditions) if conditions else "1=1"
    return where, params


@cached(ttl_seconds=60)
async def get_corte_stats(
    zona: Optional[str] = None,
    centro_operativo: Optional[str] = None,
    comuna: Optional[str] = None,
    inspector: Optional[str] = None,
    mes: Optional[int] = None,
    anio: Optional[int] = None,
) -> Dict[str, Any]:
    where, params = _build_where(
        zona=zona, centro_operativo=centro_operativo, comuna=comuna,
        inspector=inspector, mes=mes, anio=anio,
    )

    empty_response = {
        "total": 0, "realizadas": 0, "pendientes": 0, "tasa_ejecucion": 0,
        "bien_ejecutados": 0, "no_ejecutados": 0, "tasa_calidad": 0,
        "con_multa": 0, "sin_multa": 0, "tasa_multa": 0,
        "factible_cortar": 0, "no_factible_cortar": 0,
        "por_situacion_encontrada": [], "por_situacion_a_inspeccionar": [],
        "por_zona": [], "por_centro_operativo": [], "por_comuna": [],
        "por_inspector": [], "por_giro": [], "por_tipo_empalme": [],
        "por_accion_cobro": [], "por_mes": [], "insights": [],
    }

    # Run all independent queries in parallel
    (
        kpis,
        sit_enc_rows,
        sit_insp_rows,
        zona_rows,
        centro_rows,
        comuna_rows,
        insp_rows,
        giro_rows,
        empalme_rows,
        accion_rows,
        mes_rows,
        zp_count,
        nu_count,
    ) = await asyncio.gather(
        # 0 - KPIs
        execute_query(f"""
            SELECT
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE UPPER(estado) LIKE '%%REALIZADA%%') as realizadas,
                COUNT(*) FILTER (WHERE UPPER(motivo_multa) LIKE '%%BIEN EJECUTADO%%') as bien_ejecutados,
                COUNT(*) FILTER (WHERE UPPER(motivo_multa) LIKE '%%NO EJECUTADO%%') as no_ejecutados,
                COUNT(*) FILTER (WHERE UPPER(multa) = 'SI') as con_multa,
                COUNT(*) FILTER (WHERE UPPER(multa) = 'NO') as sin_multa,
                COUNT(*) FILTER (WHERE UPPER(es_factible_cortar) = 'SI') as factible_cortar,
                COUNT(*) FILTER (WHERE UPPER(es_factible_cortar) = 'NO') as no_factible_cortar
            FROM corte_reposicion WHERE {where}
        """, params),
        # 1 - Por situacion encontrada
        execute_query(f"""
            SELECT situacion_encontrada as situacion, COUNT(*) as cantidad
            FROM corte_reposicion WHERE {where} AND TRIM(COALESCE(situacion_encontrada,'')) != ''
            GROUP BY situacion_encontrada ORDER BY cantidad DESC
        """, params),
        # 2 - Por situacion a inspeccionar
        execute_query(f"""
            SELECT situacion_a_inspeccionar as situacion, COUNT(*) as cantidad
            FROM corte_reposicion WHERE {where} AND TRIM(COALESCE(situacion_a_inspeccionar,'')) != ''
            GROUP BY situacion_a_inspeccionar ORDER BY cantidad DESC
        """, params),
        # 3 - Por zona
        execute_query(f"""
            SELECT zona, COUNT(*) as cantidad,
                COUNT(*) FILTER (WHERE UPPER(motivo_multa) LIKE '%%BIEN EJECUTADO%%') as bien_ejecutados
            FROM corte_reposicion WHERE {where} AND TRIM(COALESCE(zona,'')) != ''
            GROUP BY zona ORDER BY cantidad DESC
        """, params),
        # 4 - Por centro operativo
        execute_query(f"""
            SELECT centro_operativo as centro, COUNT(*) as cantidad,
                COUNT(*) FILTER (WHERE UPPER(motivo_multa) LIKE '%%BIEN EJECUTADO%%') as bien_ejecutados
            FROM corte_reposicion WHERE {where} AND TRIM(COALESCE(centro_operativo,'')) != ''
            GROUP BY centro_operativo ORDER BY cantidad DESC
        """, params),
        # 5 - Por comuna
        execute_query(f"""
            SELECT comuna, COUNT(*) as cantidad
            FROM corte_reposicion WHERE {where} AND TRIM(COALESCE(comuna,'')) != ''
            GROUP BY comuna ORDER BY cantidad DESC LIMIT 15
        """, params),
        # 6 - Por inspector
        execute_query(f"""
            SELECT inspector, COUNT(*) as cantidad,
                COUNT(*) FILTER (WHERE UPPER(motivo_multa) LIKE '%%BIEN EJECUTADO%%') as bien_ejecutados,
                COUNT(*) FILTER (WHERE UPPER(multa) = 'SI') as con_multa
            FROM corte_reposicion WHERE {where} AND TRIM(COALESCE(inspector,'')) != ''
            GROUP BY inspector ORDER BY cantidad DESC
        """, params),
        # 7 - Por giro
        execute_query(f"""
            SELECT giro, COUNT(*) as cantidad
            FROM corte_reposicion WHERE {where} AND TRIM(COALESCE(giro,'')) != ''
            GROUP BY giro ORDER BY cantidad DESC LIMIT 10
        """, params),
        # 8 - Por tipo empalme
        execute_query(f"""
            SELECT tipo_empalme as tipo, COUNT(*) as cantidad
            FROM corte_reposicion WHERE {where} AND TRIM(COALESCE(tipo_empalme,'')) != ''
            GROUP BY tipo_empalme ORDER BY cantidad DESC
        """, params),
        # 9 - Por accion cobro
        execute_query(f"""
            SELECT accion_cobro as accion, COUNT(*) as cantidad
            FROM corte_reposicion WHERE {where} AND TRIM(COALESCE(accion_cobro,'')) != ''
            GROUP BY accion_cobro ORDER BY cantidad DESC
        """, params),
        # 10 - Por mes (evolucion)
        execute_query(f"""
            SELECT anio || '-' || LPAD(CAST(mes AS TEXT), 2, '0') as periodo,
                mes as mes_num, anio,
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE UPPER(motivo_multa) LIKE '%%BIEN EJECUTADO%%') as bien_ejecutados
            FROM corte_reposicion WHERE {where} AND mes IS NOT NULL AND anio IS NOT NULL
            GROUP BY anio, mes ORDER BY periodo DESC LIMIT 12
        """, params),
        # 11 - Zonas peligrosas (scalar)
        execute_scalar(f"""
            SELECT COUNT(*) FROM corte_reposicion
            WHERE {where} AND UPPER(situacion_encontrada) LIKE '%%ZONA PELIGROSA%%'
        """, params),
        # 12 - No ubicados (scalar)
        execute_scalar(f"""
            SELECT COUNT(*) FROM corte_reposicion
            WHERE {where} AND UPPER(situacion_encontrada) LIKE '%%NO UBICADO%%'
        """, params),
    )

    # Early return if no data
    if not kpis or kpis[0]["total"] == 0:
        return empty_response

    # Process KPIs
    k = kpis[0]
    total = k["total"]
    realizadas = k["realizadas"]
    pendientes = total - realizadas
    tasa_ejecucion = round(realizadas / total * 100, 1) if total > 0 else 0
    tasa_calidad = round(k["bien_ejecutados"] / total * 100, 1) if total > 0 else 0
    tasa_multa = round(k["con_multa"] / total * 100, 1) if total > 0 else 0

    # Process por_situacion_encontrada
    por_situacion_encontrada = [{"situacion": r["situacion"], "cantidad": r["cantidad"]} for r in sit_enc_rows]

    # Process por_situacion_a_inspeccionar
    por_situacion_a_inspeccionar = [{"situacion": r["situacion"], "cantidad": r["cantidad"]} for r in sit_insp_rows]

    # Process por_zona
    por_zona = [
        {"zona": r["zona"], "cantidad": r["cantidad"], "bien_ejecutados": r["bien_ejecutados"],
         "tasa_calidad": round(r["bien_ejecutados"] / r["cantidad"] * 100, 1) if r["cantidad"] > 0 else 0}
        for r in zona_rows
    ]

    # Process por_centro_operativo
    por_centro_operativo = [
        {"centro": r["centro"], "cantidad": r["cantidad"], "bien_ejecutados": r["bien_ejecutados"],
         "tasa_calidad": round(r["bien_ejecutados"] / r["cantidad"] * 100, 1) if r["cantidad"] > 0 else 0}
        for r in centro_rows
    ]

    # Process por_comuna
    por_comuna = [{"comuna": r["comuna"], "cantidad": r["cantidad"]} for r in comuna_rows]

    # Process por_inspector
    por_inspector = [
        {"inspector": r["inspector"], "cantidad": r["cantidad"],
         "bien_ejecutados": r["bien_ejecutados"], "con_multa": r["con_multa"],
         "tasa_calidad": round(r["bien_ejecutados"] / r["cantidad"] * 100, 1) if r["cantidad"] > 0 else 0}
        for r in insp_rows
    ]

    # Process por_giro
    por_giro = [{"giro": r["giro"], "cantidad": r["cantidad"]} for r in giro_rows]

    # Process por_tipo_empalme
    por_tipo_empalme = [{"tipo": r["tipo"], "cantidad": r["cantidad"]} for r in empalme_rows]

    # Process por_accion_cobro
    por_accion_cobro = []
    for r in accion_rows:
        nombre = r["accion"]
        if 'EFECTIVA Y NO EFECTIVA' in nombre.upper():
            nombre = 'Efectiva/No Efectiva'
        elif 'NO PERMITE' in nombre.upper():
            nombre = 'Casos No Permite'
        por_accion_cobro.append({"accion": nombre, "accion_original": r["accion"], "cantidad": r["cantidad"]})

    # Process por_mes (evolucion)
    meses_nombres = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    por_mes = []
    for r in sorted(mes_rows, key=lambda x: x["periodo"]):
        t = r["total"]
        b = r["bien_ejecutados"]
        mn = r["mes_num"]
        label = f"{meses_nombres[mn]} {r['anio']}" if 1 <= mn <= 12 else r["periodo"]
        por_mes.append({
            "periodo": label, "total": t, "bien_ejecutados": b,
            "tasa_calidad": round(b / t * 100, 1) if t > 0 else 0,
        })

    # Insights
    insights = []
    if tasa_calidad < 80:
        insights.append({"tipo": "warning", "titulo": "Tasa de calidad baja",
                         "mensaje": f"Solo el {tasa_calidad}% de las inspecciones fueron bien ejecutadas"})
    elif tasa_calidad >= 95:
        insights.append({"tipo": "success", "titulo": "Excelente calidad de ejecucion",
                         "mensaje": f"El {tasa_calidad}% de las inspecciones fueron bien ejecutadas"})

    if tasa_multa > 5:
        insights.append({"tipo": "warning", "titulo": "Alto porcentaje de multas",
                         "mensaje": f"{k['con_multa']} casos ({tasa_multa}%) presentan multa"})

    # Zonas peligrosas
    if zp_count and zp_count > 0:
        pct = round(zp_count / total * 100, 1)
        if pct > 10:
            insights.append({"tipo": "info", "titulo": "Zonas peligrosas detectadas",
                             "mensaje": f"{zp_count} casos ({pct}%) en zonas peligrosas"})

    # No ubicados
    if nu_count and nu_count > 0:
        pct = round(nu_count / total * 100, 1)
        if pct > 15:
            insights.append({"tipo": "warning", "titulo": "Alto porcentaje de no ubicados",
                             "mensaje": f"{nu_count} casos ({pct}%) no fueron ubicados"})

    fc = k["factible_cortar"]
    nfc = k["no_factible_cortar"]
    if fc > 0:
        pct_f = round(fc / (fc + nfc) * 100, 1) if (fc + nfc) > 0 else 0
        if pct_f < 50:
            insights.append({"tipo": "info", "titulo": "Baja factibilidad de corte",
                             "mensaje": f"Solo el {pct_f}% de los casos es factible cortar"})

    return {
        "total": total, "realizadas": realizadas, "pendientes": pendientes,
        "tasa_ejecucion": tasa_ejecucion, "bien_ejecutados": k["bien_ejecutados"],
        "no_ejecutados": k["no_ejecutados"], "tasa_calidad": tasa_calidad,
        "con_multa": k["con_multa"], "sin_multa": k["sin_multa"], "tasa_multa": tasa_multa,
        "factible_cortar": fc, "no_factible_cortar": nfc,
        "por_situacion_encontrada": por_situacion_encontrada,
        "por_situacion_a_inspeccionar": por_situacion_a_inspeccionar,
        "por_zona": por_zona, "por_centro_operativo": por_centro_operativo,
        "por_comuna": por_comuna, "por_inspector": por_inspector,
        "por_giro": por_giro, "por_tipo_empalme": por_tipo_empalme,
        "por_accion_cobro": por_accion_cobro, "por_mes": por_mes, "insights": insights,
    }


async def get_corte_filtered_data(
    search: Optional[str] = None,
    zona: Optional[str] = None,
    centro_operativo: Optional[str] = None,
    comuna: Optional[str] = None,
    inspector: Optional[str] = None,
    situacion_encontrada: Optional[str] = None,
    motivo_multa: Optional[str] = None,
    mes: Optional[int] = None,
    anio: Optional[int] = None,
    page: int = 1,
    limit: int = 50,
    sort_by: str = "fecha_inspeccion",
    order: str = "desc"
) -> Dict[str, Any]:
    where, params = _build_where(
        zona=zona, centro_operativo=centro_operativo, comuna=comuna,
        inspector=inspector, situacion_encontrada=situacion_encontrada,
        motivo_multa=motivo_multa, mes=mes, anio=anio, search=search,
    )

    allowed_sort = {
        "fecha_inspeccion", "zona", "comuna", "inspector",
        "situacion_encontrada", "motivo_multa", "centro_operativo",
    }
    if sort_by not in allowed_sort:
        sort_by = "fecha_inspeccion"
    order_dir = "ASC" if order == "asc" else "DESC"

    total = await execute_scalar(f"SELECT COUNT(*) FROM corte_reposicion WHERE {where}", params)

    offset = (page - 1) * limit
    params["limit"] = limit
    params["offset"] = offset

    rows = await execute_query(f"""
        SELECT suministro, nombre_cliente, direccion, comuna, zona,
               centro_operativo, situacion_encontrada, situacion_dejada,
               motivo_multa, multa, inspector, giro, tipo_empalme,
               es_factible_cortar,
               TO_CHAR(fecha_inspeccion, 'YYYY-MM-DD') as fecha_inspeccion
        FROM corte_reposicion WHERE {where}
        ORDER BY {sort_by} {order_dir} NULLS LAST
        LIMIT :limit OFFSET :offset
    """, params)

    pages = (total + limit - 1) // limit if total else 0
    return {"items": rows, "total": total or 0, "page": page, "limit": limit, "pages": pages}


@cached(ttl_seconds=300)
async def get_corte_zonas() -> List[str]:
    rows = await execute_query(
        "SELECT DISTINCT zona FROM corte_reposicion WHERE TRIM(COALESCE(zona,'')) != '' ORDER BY zona"
    )
    return [r["zona"] for r in rows]


@cached(ttl_seconds=300)
async def get_corte_centros_operativos() -> List[str]:
    rows = await execute_query(
        "SELECT DISTINCT centro_operativo FROM corte_reposicion WHERE TRIM(COALESCE(centro_operativo,'')) != '' ORDER BY centro_operativo"
    )
    return [r["centro_operativo"] for r in rows]


@cached(ttl_seconds=300)
async def get_corte_comunas() -> List[str]:
    rows = await execute_query(
        "SELECT DISTINCT comuna FROM corte_reposicion WHERE TRIM(COALESCE(comuna,'')) != '' ORDER BY comuna"
    )
    return [r["comuna"] for r in rows]


@cached(ttl_seconds=300)
async def get_corte_inspectores() -> List[Dict[str, Any]]:
    rows = await execute_query("""
        SELECT inspector, COUNT(*) as cantidad,
            COUNT(*) FILTER (WHERE UPPER(motivo_multa) LIKE '%%BIEN EJECUTADO%%') as bien_ejecutados,
            COUNT(*) FILTER (WHERE UPPER(multa) = 'SI') as con_multa
        FROM corte_reposicion WHERE TRIM(COALESCE(inspector,'')) != ''
        GROUP BY inspector ORDER BY cantidad DESC
    """)
    return [
        {"inspector": r["inspector"], "cantidad": r["cantidad"],
         "bien_ejecutados": r["bien_ejecutados"], "con_multa": r["con_multa"],
         "tasa_calidad": round(r["bien_ejecutados"] / r["cantidad"] * 100, 1) if r["cantidad"] > 0 else 0}
        for r in rows
    ]


@cached(ttl_seconds=300)
async def get_corte_situaciones() -> List[str]:
    rows = await execute_query(
        "SELECT DISTINCT situacion_encontrada FROM corte_reposicion WHERE TRIM(COALESCE(situacion_encontrada,'')) != '' ORDER BY situacion_encontrada"
    )
    return [r["situacion_encontrada"] for r in rows]


@cached(ttl_seconds=300)
async def get_corte_periodos() -> Dict[str, Any]:
    rows = await execute_query("""
        SELECT
            ARRAY_AGG(DISTINCT mes ORDER BY mes) FILTER (WHERE mes IS NOT NULL) as meses,
            ARRAY_AGG(DISTINCT anio ORDER BY anio) FILTER (WHERE anio IS NOT NULL) as anios,
            (SELECT mes FROM corte_reposicion WHERE mes IS NOT NULL AND anio IS NOT NULL ORDER BY anio DESC, mes DESC LIMIT 1) as ultimo_mes,
            (SELECT anio FROM corte_reposicion WHERE mes IS NOT NULL AND anio IS NOT NULL ORDER BY anio DESC, mes DESC LIMIT 1) as ultimo_anio
        FROM corte_reposicion
    """)
    if rows:
        return {
            "meses": rows[0]["meses"] or [],
            "anios": rows[0]["anios"] or [],
            "ultimo_mes": rows[0]["ultimo_mes"],
            "ultimo_anio": rows[0]["ultimo_anio"],
        }
    return {"meses": [], "anios": [], "ultimo_mes": None, "ultimo_anio": None}


async def get_corte_evolucion(
    zona: Optional[str] = None,
    centro_operativo: Optional[str] = None,
) -> List[Dict[str, Any]]:
    where, params = _build_where(zona=zona, centro_operativo=centro_operativo)
    meses_nombres = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

    rows = await execute_query(f"""
        SELECT anio || '-' || LPAD(CAST(mes AS TEXT), 2, '0') as periodo,
            mes as mes_num, anio,
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE UPPER(motivo_multa) LIKE '%%BIEN EJECUTADO%%') as bien_ejecutados,
            COUNT(*) FILTER (WHERE UPPER(multa) = 'SI') as con_multa
        FROM corte_reposicion WHERE {where} AND mes IS NOT NULL AND anio IS NOT NULL
        GROUP BY anio, mes ORDER BY periodo
    """, params)

    evolucion = []
    for r in rows:
        t = r["total"]
        b = r["bien_ejecutados"]
        mn = r["mes_num"]
        label = f"{meses_nombres[mn]} {r['anio']}" if 1 <= mn <= 12 else r["periodo"]
        evolucion.append({
            "periodo": label, "total": t, "bien_ejecutados": b,
            "tasa_calidad": round(b / t * 100, 1) if t > 0 else 0,
            "con_multa": r["con_multa"],
            "tasa_multa": round(r["con_multa"] / t * 100, 1) if t > 0 else 0,
        })
    return evolucion


@cached(ttl_seconds=60)
async def get_corte_analisis_operacional(
    zona: Optional[str] = None,
    centro_operativo: Optional[str] = None,
    comuna: Optional[str] = None,
    mes: Optional[int] = None,
    anio: Optional[int] = None,
) -> Dict[str, Any]:
    """Análisis operacional detallado: causas de mal ejecución, multas, factibilidad."""
    where, params = _build_where(
        zona=zona, centro_operativo=centro_operativo, comuna=comuna, mes=mes, anio=anio,
    )

    (
        causas_no_ejecucion,
        analisis_multas,
        factibilidad_detalle,
        ranking_inspectores,
        zonas_problematicas,
        giros_problematicos,
        situaciones_frecuentes,
    ) = await asyncio.gather(
        # 1) Análisis detallado de causas de no ejecución
        execute_query(f"""
            SELECT
                COUNT(*) FILTER (WHERE UPPER(situacion_encontrada) LIKE '%%NO UBICADO%%') as no_ubicado,
                COUNT(*) FILTER (WHERE UPPER(situacion_encontrada) LIKE '%%ZONA PELIGROSA%%') as zona_peligrosa,
                COUNT(*) FILTER (WHERE UPPER(situacion_encontrada) LIKE '%%CLIENTE PAGO%%' OR UPPER(situacion_encontrada) LIKE '%%PAGO%%') as cliente_pago,
                COUNT(*) FILTER (WHERE UPPER(situacion_encontrada) LIKE '%%MEDIDOR RETIRADO%%') as medidor_retirado,
                COUNT(*) FILTER (WHERE UPPER(situacion_encontrada) LIKE '%%YA CORTADO%%') as ya_cortado,
                COUNT(*) FILTER (WHERE UPPER(situacion_encontrada) LIKE '%%CONVENIO%%') as con_convenio,
                COUNT(*) FILTER (WHERE UPPER(situacion_encontrada) LIKE '%%RECLAMO%%') as con_reclamo,
                COUNT(*) FILTER (WHERE UPPER(es_factible_cortar) = 'NO') as no_factible,
                COUNT(*) FILTER (WHERE UPPER(motivo_multa) LIKE '%%NO EJECUTADO%%') as no_ejecutado,
                COUNT(*) as total
            FROM corte_reposicion WHERE {where}
        """, params),
        # 2) Análisis de multas por motivo
        execute_query(f"""
            SELECT motivo_multa,
                COUNT(*) as cantidad,
                COUNT(*) FILTER (WHERE UPPER(multa) = 'SI') as con_multa
            FROM corte_reposicion
            WHERE {where} AND TRIM(COALESCE(motivo_multa,'')) != ''
            GROUP BY motivo_multa
            ORDER BY cantidad DESC
        """, params),
        # 3) Detalle de factibilidad de corte
        execute_query(f"""
            SELECT
                COUNT(*) FILTER (WHERE UPPER(es_factible_cortar) = 'SI') as factible,
                COUNT(*) FILTER (WHERE UPPER(es_factible_cortar) = 'NO') as no_factible,
                COUNT(*) FILTER (WHERE
                    UPPER(es_factible_cortar) = 'NO' AND
                    UPPER(situacion_encontrada) LIKE '%%ZONA PELIGROSA%%'
                ) as no_factible_zona_peligrosa,
                COUNT(*) FILTER (WHERE
                    UPPER(es_factible_cortar) = 'NO' AND
                    UPPER(situacion_encontrada) LIKE '%%NO UBICADO%%'
                ) as no_factible_no_ubicado,
                COUNT(*) FILTER (WHERE
                    UPPER(es_factible_cortar) = 'SI' AND
                    UPPER(motivo_multa) LIKE '%%NO EJECUTADO%%'
                ) as factible_no_ejecutado,
                COUNT(*) as total
            FROM corte_reposicion WHERE {where}
        """, params),
        # 4) Ranking de inspectores con métricas detalladas
        execute_query(f"""
            SELECT inspector,
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE UPPER(motivo_multa) LIKE '%%BIEN EJECUTADO%%') as bien_ejecutados,
                COUNT(*) FILTER (WHERE UPPER(motivo_multa) LIKE '%%NO EJECUTADO%%') as no_ejecutados,
                COUNT(*) FILTER (WHERE UPPER(multa) = 'SI') as con_multa,
                COUNT(*) FILTER (WHERE UPPER(es_factible_cortar) = 'NO') as no_factibles,
                COUNT(*) FILTER (WHERE UPPER(situacion_encontrada) LIKE '%%NO UBICADO%%') as no_ubicados,
                ROUND(COUNT(*) FILTER (WHERE UPPER(motivo_multa) LIKE '%%BIEN EJECUTADO%%') * 100.0 / NULLIF(COUNT(*), 0), 1) as tasa_calidad,
                ROUND(COUNT(*) FILTER (WHERE UPPER(multa) = 'SI') * 100.0 / NULLIF(COUNT(*), 0), 1) as tasa_multa
            FROM corte_reposicion
            WHERE {where} AND TRIM(COALESCE(inspector,'')) != ''
            GROUP BY inspector
            ORDER BY total DESC
        """, params),
        # 5) Zonas problemáticas (alta tasa de no ejecución o multas)
        execute_query(f"""
            SELECT zona,
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE UPPER(motivo_multa) LIKE '%%BIEN EJECUTADO%%') as bien_ejecutados,
                COUNT(*) FILTER (WHERE UPPER(multa) = 'SI') as con_multa,
                COUNT(*) FILTER (WHERE UPPER(situacion_encontrada) LIKE '%%ZONA PELIGROSA%%') as zonas_peligrosas,
                COUNT(*) FILTER (WHERE UPPER(situacion_encontrada) LIKE '%%NO UBICADO%%') as no_ubicados,
                ROUND(COUNT(*) FILTER (WHERE UPPER(motivo_multa) LIKE '%%BIEN EJECUTADO%%') * 100.0 / NULLIF(COUNT(*), 0), 1) as tasa_calidad
            FROM corte_reposicion
            WHERE {where} AND TRIM(COALESCE(zona,'')) != ''
            GROUP BY zona
            HAVING COUNT(*) >= 10
            ORDER BY tasa_calidad ASC
        """, params),
        # 6) Giros con mayor tasa de no ubicados o problemas
        execute_query(f"""
            SELECT giro,
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE UPPER(situacion_encontrada) LIKE '%%NO UBICADO%%') as no_ubicados,
                COUNT(*) FILTER (WHERE UPPER(motivo_multa) LIKE '%%NO EJECUTADO%%') as no_ejecutados,
                COUNT(*) FILTER (WHERE UPPER(es_factible_cortar) = 'NO') as no_factibles,
                ROUND(COUNT(*) FILTER (WHERE UPPER(situacion_encontrada) LIKE '%%NO UBICADO%%') * 100.0 / NULLIF(COUNT(*), 0), 1) as pct_no_ubicados
            FROM corte_reposicion
            WHERE {where} AND TRIM(COALESCE(giro,'')) != ''
            GROUP BY giro
            HAVING COUNT(*) >= 5
            ORDER BY pct_no_ubicados DESC
            LIMIT 15
        """, params),
        # 7) Situaciones encontradas más frecuentes vs esperadas
        execute_query(f"""
            SELECT situacion_a_inspeccionar as esperada,
                situacion_encontrada as encontrada,
                COUNT(*) as cantidad,
                COUNT(*) FILTER (WHERE situacion_a_inspeccionar != situacion_encontrada) as discrepancias
            FROM corte_reposicion
            WHERE {where}
                AND TRIM(COALESCE(situacion_a_inspeccionar,'')) != ''
                AND TRIM(COALESCE(situacion_encontrada,'')) != ''
            GROUP BY situacion_a_inspeccionar, situacion_encontrada
            ORDER BY cantidad DESC
            LIMIT 20
        """, params),
    )

    # Procesar causas de no ejecución
    causas = {
        "no_ubicado": 0, "zona_peligrosa": 0, "cliente_pago": 0,
        "medidor_retirado": 0, "ya_cortado": 0, "con_convenio": 0,
        "con_reclamo": 0, "no_factible": 0, "no_ejecutado": 0, "total": 0,
    }
    if causas_no_ejecucion and causas_no_ejecucion[0]["total"] > 0:
        c = causas_no_ejecucion[0]
        causas = {
            "no_ubicado": c["no_ubicado"] or 0,
            "zona_peligrosa": c["zona_peligrosa"] or 0,
            "cliente_pago": c["cliente_pago"] or 0,
            "medidor_retirado": c["medidor_retirado"] or 0,
            "ya_cortado": c["ya_cortado"] or 0,
            "con_convenio": c["con_convenio"] or 0,
            "con_reclamo": c["con_reclamo"] or 0,
            "no_factible": c["no_factible"] or 0,
            "no_ejecutado": c["no_ejecutado"] or 0,
            "total": c["total"],
        }

    # Procesar análisis de multas
    multas = []
    for r in (analisis_multas or []):
        multas.append({
            "motivo": r["motivo_multa"],
            "cantidad": r["cantidad"],
            "con_multa": r["con_multa"],
            "pct_multa": round(r["con_multa"] / r["cantidad"] * 100, 1) if r["cantidad"] > 0 else 0,
        })

    # Procesar factibilidad
    factibilidad = {
        "factible": 0, "no_factible": 0, "no_factible_zona_peligrosa": 0,
        "no_factible_no_ubicado": 0, "factible_no_ejecutado": 0, "total": 0,
    }
    if factibilidad_detalle and factibilidad_detalle[0]["total"] > 0:
        f = factibilidad_detalle[0]
        factibilidad = {
            "factible": f["factible"] or 0,
            "no_factible": f["no_factible"] or 0,
            "no_factible_zona_peligrosa": f["no_factible_zona_peligrosa"] or 0,
            "no_factible_no_ubicado": f["no_factible_no_ubicado"] or 0,
            "factible_no_ejecutado": f["factible_no_ejecutado"] or 0,
            "total": f["total"],
        }

    # Ranking de inspectores
    inspectores = []
    for r in (ranking_inspectores or []):
        inspectores.append({
            "inspector": r["inspector"],
            "total": r["total"],
            "bien_ejecutados": r["bien_ejecutados"],
            "no_ejecutados": r["no_ejecutados"],
            "con_multa": r["con_multa"],
            "no_factibles": r["no_factibles"],
            "no_ubicados": r["no_ubicados"],
            "tasa_calidad": float(r["tasa_calidad"]) if r["tasa_calidad"] else 0,
            "tasa_multa": float(r["tasa_multa"]) if r["tasa_multa"] else 0,
            "calidad": "buena" if (r["tasa_calidad"] or 0) >= 85 else "regular" if (r["tasa_calidad"] or 0) >= 70 else "mala",
        })

    # Zonas problemáticas
    zonas = []
    for r in (zonas_problematicas or []):
        zonas.append({
            "zona": r["zona"],
            "total": r["total"],
            "bien_ejecutados": r["bien_ejecutados"],
            "con_multa": r["con_multa"],
            "zonas_peligrosas": r["zonas_peligrosas"],
            "no_ubicados": r["no_ubicados"],
            "tasa_calidad": float(r["tasa_calidad"]) if r["tasa_calidad"] else 0,
        })

    # Giros problemáticos
    giros = []
    for r in (giros_problematicos or []):
        giros.append({
            "giro": r["giro"],
            "total": r["total"],
            "no_ubicados": r["no_ubicados"],
            "no_ejecutados": r["no_ejecutados"],
            "no_factibles": r["no_factibles"],
            "pct_no_ubicados": float(r["pct_no_ubicados"]) if r["pct_no_ubicados"] else 0,
        })

    # Situaciones discrepantes
    situaciones = []
    for r in (situaciones_frecuentes or []):
        situaciones.append({
            "esperada": r["esperada"],
            "encontrada": r["encontrada"],
            "cantidad": r["cantidad"],
            "discrepancias": r["discrepancias"],
        })

    # Generar alertas operacionales
    alertas = []
    if causas["total"] > 0:
        pct_no_ubicado = round(causas["no_ubicado"] / causas["total"] * 100, 1)
        if pct_no_ubicado > 15:
            alertas.append({
                "tipo": "warning",
                "titulo": f"{pct_no_ubicado}% de casos no ubicados",
                "mensaje": f"{causas['no_ubicado']} casos no pudieron ser ubicados. Revisar direcciones.",
            })

        pct_zona_peligrosa = round(causas["zona_peligrosa"] / causas["total"] * 100, 1)
        if pct_zona_peligrosa > 10:
            alertas.append({
                "tipo": "info",
                "titulo": f"{pct_zona_peligrosa}% en zonas peligrosas",
                "mensaje": f"{causas['zona_peligrosa']} casos en zonas de riesgo.",
            })

    if factibilidad["factible_no_ejecutado"] > 10:
        alertas.append({
            "tipo": "danger",
            "titulo": f"{factibilidad['factible_no_ejecutado']} casos factibles no ejecutados",
            "mensaje": "Casos donde era factible cortar pero no se ejecutó. Revisar motivos.",
        })

    # Identificar inspectores con problemas
    inspectores_problemas = [i for i in inspectores if i["calidad"] == "mala" and i["total"] >= 10]
    if inspectores_problemas:
        nombres = ", ".join([i["inspector"] for i in inspectores_problemas[:3]])
        alertas.append({
            "tipo": "warning",
            "titulo": "Inspectores con baja calidad",
            "mensaje": f"Tasa < 70%: {nombres}. Revisar capacitación.",
        })

    # Zonas con alta tasa de multas
    zonas_multas = [z for z in zonas if z["con_multa"] > z["total"] * 0.1 and z["total"] >= 20]
    if zonas_multas:
        nombres_zonas = ", ".join([z["zona"] for z in zonas_multas[:3]])
        alertas.append({
            "tipo": "warning",
            "titulo": "Zonas con alta tasa de multas",
            "mensaje": f"Zonas con > 10% de multas: {nombres_zonas}.",
        })

    # Giros con alto % de no ubicados
    giros_no_ubicados = [g for g in giros if g["pct_no_ubicados"] > 30 and g["total"] >= 10]
    if giros_no_ubicados:
        nombres_giros = ", ".join([g["giro"] for g in giros_no_ubicados[:3]])
        alertas.append({
            "tipo": "info",
            "titulo": "Giros difíciles de ubicar",
            "mensaje": f"Giros con > 30% no ubicados: {nombres_giros}.",
        })

    return {
        "causas_no_ejecucion": causas,
        "analisis_multas": multas,
        "factibilidad_detalle": factibilidad,
        "ranking_inspectores": inspectores,
        "zonas_problematicas": zonas,
        "giros_problematicos": giros,
        "situaciones_discrepantes": situaciones,
        "alertas": alertas,
    }
