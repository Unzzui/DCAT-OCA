"""
Servicio para el modulo de Inspecciones de Seguridad (IPAL).
"""

import asyncio
from typing import Optional, Dict, Any, List
from .db_queries import execute_query, execute_scalar
from .cache import cached


def _build_where(
    empresa: Optional[str] = None,
    inspector: Optional[str] = None,
    comuna: Optional[str] = None,
    estado: Optional[str] = None,
    mes: Optional[int] = None,
    anio: Optional[int] = None,
    search: Optional[str] = None,
) -> tuple[str, dict]:
    """Build WHERE clause and params from filters."""
    conditions = []
    params = {}

    if empresa:
        conditions.append("UPPER(empresa) = UPPER(:empresa)")
        params["empresa"] = empresa
    if inspector:
        conditions.append("UPPER(inspector) = UPPER(:inspector)")
        params["inspector"] = inspector
    if comuna:
        conditions.append("UPPER(comuna) = UPPER(:comuna)")
        params["comuna"] = comuna
    if estado:
        conditions.append("UPPER(estado) ILIKE :estado")
        params["estado"] = f"%{estado}%"
    if mes:
        conditions.append("mes = :mes")
        params["mes"] = mes
    if anio:
        conditions.append("anio = :anio")
        params["anio"] = anio
    if search:
        conditions.append(
            "(nombre_lector ILIKE :search OR direccion ILIKE :search "
            "OR nro_ipal ILIKE :search OR observacion ILIKE :search)"
        )
        params["search"] = f"%{search}%"

    where = " AND ".join(conditions) if conditions else "1=1"
    return where, params


@cached(ttl_seconds=60)
async def get_ipal_stats(
    empresa: Optional[str] = None,
    inspector: Optional[str] = None,
    comuna: Optional[str] = None,
    mes: Optional[int] = None,
    anio: Optional[int] = None,
) -> Dict[str, Any]:
    """Get aggregated statistics for IPAL inspections."""
    where, params = _build_where(
        empresa=empresa, inspector=inspector, comuna=comuna, mes=mes, anio=anio
    )

    empty_response = {
        "total": 0,
        "por_estado": {},
        "por_empresa": [],
        "por_inspector": [],
        "por_comuna": [],
        "por_hallazgo": [],
        "evolucion_mensual": [],
        "insights": [],
    }

    # Run queries in parallel
    kpis, estado_rows, empresa_rows, inspector_rows, comuna_rows, hallazgo_rows, evolucion_rows = await asyncio.gather(
        execute_query(f"""
            SELECT
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE UPPER(estado) LIKE '%%OK%%' OR UPPER(estado) LIKE '%%CONFORME%%') as conformes,
                COUNT(*) FILTER (WHERE UPPER(estado) LIKE '%%NO%%' OR UPPER(estado) LIKE '%%HALLAZGO%%') as con_hallazgo,
                COUNT(DISTINCT nombre_lector) as lectores_unicos,
                COUNT(DISTINCT inspector) as inspectores_unicos
            FROM ipal_inspecciones WHERE {where}
        """, params),
        execute_query(f"""
            SELECT
                COALESCE(NULLIF(TRIM(estado), ''), 'Sin Estado') as estado,
                COUNT(*) as cantidad
            FROM ipal_inspecciones WHERE {where}
            GROUP BY estado ORDER BY cantidad DESC
        """, params),
        execute_query(f"""
            SELECT empresa, COUNT(*) as cantidad,
                COUNT(DISTINCT nombre_lector) as lectores
            FROM ipal_inspecciones WHERE {where} AND empresa IS NOT NULL AND TRIM(empresa) != ''
            GROUP BY empresa ORDER BY cantidad DESC LIMIT 10
        """, params),
        execute_query(f"""
            SELECT inspector, COUNT(*) as cantidad,
                COUNT(*) FILTER (WHERE UPPER(estado) LIKE '%%OK%%' OR UPPER(estado) LIKE '%%CONFORME%%') as conformes
            FROM ipal_inspecciones WHERE {where} AND inspector IS NOT NULL AND TRIM(inspector) != ''
            GROUP BY inspector ORDER BY cantidad DESC LIMIT 10
        """, params),
        execute_query(f"""
            SELECT comuna, COUNT(*) as cantidad
            FROM ipal_inspecciones WHERE {where} AND comuna IS NOT NULL AND TRIM(comuna) != ''
            GROUP BY comuna ORDER BY cantidad DESC LIMIT 10
        """, params),
        execute_query(f"""
            SELECT
                COALESCE(NULLIF(TRIM(codigo_hallazgo), ''), 'Sin Hallazgo') as hallazgo,
                COUNT(*) as cantidad
            FROM ipal_inspecciones WHERE {where}
            GROUP BY hallazgo ORDER BY cantidad DESC LIMIT 10
        """, params),
        execute_query(f"""
            SELECT
                anio || '-' || LPAD(mes::text, 2, '0') as periodo,
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE UPPER(estado) LIKE '%%OK%%' OR UPPER(estado) LIKE '%%CONFORME%%') as conformes
            FROM ipal_inspecciones WHERE {where} AND mes IS NOT NULL AND anio IS NOT NULL
            GROUP BY anio, mes ORDER BY anio, mes
        """, params),
    )

    if not kpis or kpis[0]["total"] == 0:
        return empty_response

    k = kpis[0]
    total = k["total"]

    por_estado = {r["estado"]: r["cantidad"] for r in estado_rows}

    por_empresa = [
        {
            "empresa": r["empresa"],
            "cantidad": r["cantidad"],
            "lectores": r["lectores"],
        }
        for r in empresa_rows
    ]

    por_inspector = [
        {
            "inspector": r["inspector"],
            "cantidad": r["cantidad"],
            "conformes": r["conformes"],
            "tasa_conformidad": round(r["conformes"] / r["cantidad"] * 100, 1) if r["cantidad"] > 0 else 0,
        }
        for r in inspector_rows
    ]

    por_comuna = [
        {"comuna": r["comuna"], "cantidad": r["cantidad"]}
        for r in comuna_rows
    ]

    por_hallazgo = [
        {"hallazgo": r["hallazgo"], "cantidad": r["cantidad"]}
        for r in hallazgo_rows
    ]

    evolucion_mensual = [
        {
            "periodo": r["periodo"],
            "total": r["total"],
            "conformes": r["conformes"],
            "tasa": round(r["conformes"] / r["total"] * 100, 1) if r["total"] > 0 else 0,
        }
        for r in evolucion_rows[-12:]
    ]

    # Generate insights
    insights = []
    if k["lectores_unicos"] > 0:
        avg_insp = total / k["lectores_unicos"]
        insights.append({
            "tipo": "info",
            "titulo": "Promedio por lector",
            "mensaje": f"Cada lector recibe en promedio {avg_insp:.1f} inspecciones"
        })

    if por_empresa and len(por_empresa) > 1:
        top = por_empresa[0]
        insights.append({
            "tipo": "info",
            "titulo": "Empresa principal",
            "mensaje": f"{top['empresa']} concentra {top['cantidad']} inspecciones ({round(top['cantidad']/total*100, 1)}%)"
        })

    tasa_conformidad = round(k["conformes"] / total * 100, 1) if total > 0 else 0
    if tasa_conformidad >= 90:
        insights.append({
            "tipo": "success",
            "titulo": "Alta conformidad",
            "mensaje": f"El {tasa_conformidad}% de las inspecciones resultaron conformes"
        })
    elif tasa_conformidad < 70:
        insights.append({
            "tipo": "warning",
            "titulo": "Baja conformidad",
            "mensaje": f"Solo el {tasa_conformidad}% de las inspecciones resultaron conformes"
        })

    return {
        "total": total,
        "conformes": k["conformes"],
        "con_hallazgo": k["con_hallazgo"],
        "lectores_unicos": k["lectores_unicos"],
        "inspectores_unicos": k["inspectores_unicos"],
        "tasa_conformidad": tasa_conformidad,
        "por_estado": por_estado,
        "por_empresa": por_empresa,
        "por_inspector": por_inspector,
        "por_comuna": por_comuna,
        "por_hallazgo": por_hallazgo,
        "evolucion_mensual": evolucion_mensual,
        "insights": insights,
    }


async def get_ipal_filtered_data(
    search: Optional[str] = None,
    empresa: Optional[str] = None,
    inspector: Optional[str] = None,
    comuna: Optional[str] = None,
    estado: Optional[str] = None,
    mes: Optional[int] = None,
    anio: Optional[int] = None,
    page: int = 1,
    limit: int = 50,
    sort_by: str = "fecha",
    order: str = "desc",
) -> Dict[str, Any]:
    """Get paginated list of IPAL inspections."""
    where, params = _build_where(
        empresa=empresa, inspector=inspector, comuna=comuna,
        estado=estado, mes=mes, anio=anio, search=search,
    )

    allowed_sort = {"fecha", "empresa", "inspector", "comuna", "estado", "nombre_lector"}
    if sort_by not in allowed_sort:
        sort_by = "fecha"
    order_dir = "ASC" if order == "asc" else "DESC"

    total = await execute_scalar(
        f"SELECT COUNT(*) FROM ipal_inspecciones WHERE {where}", params
    )

    offset = (page - 1) * limit
    params["limit"] = limit
    params["offset"] = offset

    rows = await execute_query(
        f"""SELECT id, TO_CHAR(fecha, 'YYYY-MM-DD') as fecha, comuna, nombre_lector,
               empresa, inspector, estado, hora_llamada, nro_ipal,
               observacion, codigo_hallazgo, observacion_inspector, direccion,
               mes, anio
        FROM ipal_inspecciones WHERE {where}
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
async def get_ipal_empresas() -> List[str]:
    """Get list of unique empresas."""
    rows = await execute_query(
        "SELECT DISTINCT empresa FROM ipal_inspecciones WHERE empresa IS NOT NULL AND TRIM(empresa) != '' ORDER BY empresa"
    )
    return [r["empresa"] for r in rows]


@cached(ttl_seconds=300)
async def get_ipal_inspectores() -> List[Dict[str, Any]]:
    """Get list of inspectors with stats."""
    rows = await execute_query("""
        SELECT inspector, COUNT(*) as cantidad
        FROM ipal_inspecciones WHERE inspector IS NOT NULL AND TRIM(inspector) != ''
        GROUP BY inspector ORDER BY cantidad DESC
    """)
    return [{"inspector": r["inspector"], "cantidad": r["cantidad"]} for r in rows]


@cached(ttl_seconds=300)
async def get_ipal_comunas() -> List[str]:
    """Get list of unique comunas."""
    rows = await execute_query(
        "SELECT DISTINCT comuna FROM ipal_inspecciones WHERE comuna IS NOT NULL AND TRIM(comuna) != '' ORDER BY comuna"
    )
    return [r["comuna"] for r in rows]


@cached(ttl_seconds=300)
async def get_ipal_periodos() -> Dict[str, Any]:
    """Get available months and years."""
    rows = await execute_query("""
        SELECT
            ARRAY_AGG(DISTINCT mes ORDER BY mes) FILTER (WHERE mes IS NOT NULL) as meses,
            ARRAY_AGG(DISTINCT anio ORDER BY anio) FILTER (WHERE anio IS NOT NULL) as anios,
            (SELECT mes FROM ipal_inspecciones WHERE mes IS NOT NULL AND anio IS NOT NULL ORDER BY anio DESC, mes DESC LIMIT 1) as ultimo_mes,
            (SELECT anio FROM ipal_inspecciones WHERE mes IS NOT NULL AND anio IS NOT NULL ORDER BY anio DESC, mes DESC LIMIT 1) as ultimo_anio
        FROM ipal_inspecciones
    """)
    if rows:
        return {
            "meses": rows[0]["meses"] or [],
            "anios": rows[0]["anios"] or [],
            "ultimo_mes": rows[0]["ultimo_mes"],
            "ultimo_anio": rows[0]["ultimo_anio"],
        }
    return {"meses": [], "anios": [], "ultimo_mes": None, "ultimo_anio": None}
