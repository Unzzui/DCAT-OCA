"""
Servicio para el modulo de Refacturaciones.
"""

import asyncio
from typing import Optional, Dict, Any, List
from .db_queries import execute_query, execute_scalar
from .cache import cached


def _build_where(
    comuna: Optional[str] = None,
    leido_por: Optional[str] = None,
    mes: Optional[int] = None,
    anio: Optional[int] = None,
    search: Optional[str] = None,
) -> tuple[str, dict]:
    """Build WHERE clause and params from filters."""
    conditions = []
    params = {}

    if comuna:
        conditions.append("UPPER(comuna) = UPPER(:comuna)")
        params["comuna"] = comuna
    if leido_por:
        conditions.append("UPPER(leido_por) = UPPER(:leido_por)")
        params["leido_por"] = leido_por
    if mes:
        conditions.append("mes = :mes")
        params["mes"] = mes
    if anio:
        conditions.append("anio = :anio")
        params["anio"] = anio
    if search:
        conditions.append(
            "(cliente ILIKE :search OR medidor ILIKE :search "
            "OR ruta ILIKE :search OR orden ILIKE :search)"
        )
        params["search"] = f"%{search}%"

    where = " AND ".join(conditions) if conditions else "1=1"
    return where, params


@cached(ttl_seconds=60)
async def get_refacturaciones_stats(
    comuna: Optional[str] = None,
    leido_por: Optional[str] = None,
    mes: Optional[int] = None,
    anio: Optional[int] = None,
) -> Dict[str, Any]:
    """Get aggregated statistics for refacturaciones."""
    where, params = _build_where(
        comuna=comuna, leido_por=leido_por, mes=mes, anio=anio
    )

    empty_response = {
        "total": 0,
        "total_kwh_cobrar": 0,
        "total_kwh_rebajar": 0,
        "impacto_neto": 0,
        "por_lector": [],
        "por_comuna": [],
        "evolucion_mensual": [],
        "insights": [],
    }

    # Run queries in parallel
    kpis, lector_rows, comuna_rows, evolucion_rows = await asyncio.gather(
        execute_query(f"""
            SELECT
                COUNT(*) as total,
                COALESCE(SUM(kwh_cobrar), 0) as total_kwh_cobrar,
                COALESCE(SUM(kwh_rebajar), 0) as total_kwh_rebajar,
                COUNT(DISTINCT leido_por) as lectores_unicos,
                COUNT(DISTINCT cliente) as clientes_afectados
            FROM refacturaciones WHERE {where}
        """, params),
        execute_query(f"""
            SELECT leido_por, COUNT(*) as cantidad,
                COALESCE(SUM(kwh_cobrar), 0) as kwh_cobrar,
                COALESCE(SUM(kwh_rebajar), 0) as kwh_rebajar
            FROM refacturaciones WHERE {where} AND leido_por IS NOT NULL AND TRIM(leido_por) != ''
            GROUP BY leido_por ORDER BY cantidad DESC LIMIT 15
        """, params),
        execute_query(f"""
            SELECT comuna, COUNT(*) as cantidad,
                COALESCE(SUM(kwh_cobrar), 0) as kwh_cobrar,
                COALESCE(SUM(kwh_rebajar), 0) as kwh_rebajar
            FROM refacturaciones WHERE {where} AND comuna IS NOT NULL AND TRIM(comuna) != ''
            GROUP BY comuna ORDER BY cantidad DESC LIMIT 15
        """, params),
        execute_query(f"""
            SELECT
                anio || '-' || LPAD(mes::text, 2, '0') as periodo,
                COUNT(*) as total,
                COALESCE(SUM(kwh_cobrar), 0) as kwh_cobrar,
                COALESCE(SUM(kwh_rebajar), 0) as kwh_rebajar
            FROM refacturaciones WHERE {where} AND mes IS NOT NULL AND anio IS NOT NULL
            GROUP BY anio, mes ORDER BY anio, mes
        """, params),
    )

    if not kpis or kpis[0]["total"] == 0:
        return empty_response

    k = kpis[0]
    total = k["total"]
    total_cobrar = float(k["total_kwh_cobrar"] or 0)
    total_rebajar = float(k["total_kwh_rebajar"] or 0)
    impacto_neto = total_cobrar - total_rebajar

    por_lector = [
        {
            "leido_por": r["leido_por"],
            "cantidad": r["cantidad"],
            "kwh_cobrar": float(r["kwh_cobrar"] or 0),
            "kwh_rebajar": float(r["kwh_rebajar"] or 0),
            "impacto": float(r["kwh_cobrar"] or 0) - float(r["kwh_rebajar"] or 0),
        }
        for r in lector_rows
    ]

    por_comuna = [
        {
            "comuna": r["comuna"],
            "cantidad": r["cantidad"],
            "kwh_cobrar": float(r["kwh_cobrar"] or 0),
            "kwh_rebajar": float(r["kwh_rebajar"] or 0),
            "impacto": float(r["kwh_cobrar"] or 0) - float(r["kwh_rebajar"] or 0),
        }
        for r in comuna_rows
    ]

    evolucion_mensual = [
        {
            "periodo": r["periodo"],
            "total": r["total"],
            "kwh_cobrar": float(r["kwh_cobrar"] or 0),
            "kwh_rebajar": float(r["kwh_rebajar"] or 0),
            "impacto": float(r["kwh_cobrar"] or 0) - float(r["kwh_rebajar"] or 0),
        }
        for r in evolucion_rows[-12:]
    ]

    # Generate insights
    insights = []
    if impacto_neto > 0:
        insights.append({
            "tipo": "success",
            "titulo": "Recuperacion de energia",
            "mensaje": f"Se recuperaran {impacto_neto:,.0f} kWh netos a favor de la empresa"
        })
    elif impacto_neto < 0:
        insights.append({
            "tipo": "warning",
            "titulo": "Perdida de energia",
            "mensaje": f"Se devolveran {abs(impacto_neto):,.0f} kWh netos a clientes"
        })

    if por_lector:
        top_lector = max(por_lector, key=lambda x: x["cantidad"])
        insights.append({
            "tipo": "info",
            "titulo": "Lector con mas refacturaciones",
            "mensaje": f"{top_lector['leido_por']} tiene {top_lector['cantidad']} refacturaciones"
        })

    if k["clientes_afectados"] > 0:
        avg_per_cliente = total / k["clientes_afectados"]
        if avg_per_cliente > 1.5:
            insights.append({
                "tipo": "info",
                "titulo": "Clientes con multiples refacturaciones",
                "mensaje": f"En promedio {avg_per_cliente:.1f} refacturaciones por cliente"
            })

    return {
        "total": total,
        "total_kwh_cobrar": round(total_cobrar, 2),
        "total_kwh_rebajar": round(total_rebajar, 2),
        "impacto_neto": round(impacto_neto, 2),
        "lectores_unicos": k["lectores_unicos"],
        "clientes_afectados": k["clientes_afectados"],
        "por_lector": por_lector,
        "por_comuna": por_comuna,
        "evolucion_mensual": evolucion_mensual,
        "insights": insights,
    }


async def get_refacturaciones_filtered_data(
    search: Optional[str] = None,
    comuna: Optional[str] = None,
    leido_por: Optional[str] = None,
    mes: Optional[int] = None,
    anio: Optional[int] = None,
    page: int = 1,
    limit: int = 50,
    sort_by: str = "id",
    order: str = "desc",
) -> Dict[str, Any]:
    """Get paginated list of refacturaciones."""
    where, params = _build_where(
        comuna=comuna, leido_por=leido_por, mes=mes, anio=anio, search=search,
    )

    allowed_sort = {"id", "cliente", "comuna", "leido_por", "kwh_cobrar", "kwh_rebajar"}
    if sort_by not in allowed_sort:
        sort_by = "id"
    order_dir = "ASC" if order == "asc" else "DESC"

    total = await execute_scalar(
        f"SELECT COUNT(*) FROM refacturaciones WHERE {where}", params
    )

    offset = (page - 1) * limit
    params["limit"] = limit
    params["offset"] = offset

    rows = await execute_query(
        f"""SELECT id, cliente, ruta, medidor, lectura_normal,
               TO_CHAR(fecha_normal, 'YYYY-MM-DD') as fecha_normal,
               lectura_erronea, TO_CHAR(fecha_erronea, 'YYYY-MM-DD') as fecha_erronea,
               lectura_verificada, TO_CHAR(fecha_verificada, 'YYYY-MM-DD') as fecha_verificada,
               constante, facturado, kwh_cobrar, kwh_rebajar, modif_lectura,
               orden, comuna, leido_por, mes, anio
        FROM refacturaciones WHERE {where}
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
async def get_refacturaciones_comunas() -> List[str]:
    """Get list of unique comunas."""
    rows = await execute_query(
        "SELECT DISTINCT comuna FROM refacturaciones WHERE comuna IS NOT NULL AND TRIM(comuna) != '' ORDER BY comuna"
    )
    return [r["comuna"] for r in rows]


@cached(ttl_seconds=300)
async def get_refacturaciones_lectores() -> List[Dict[str, Any]]:
    """Get list of lectores with stats."""
    rows = await execute_query("""
        SELECT leido_por, COUNT(*) as cantidad
        FROM refacturaciones WHERE leido_por IS NOT NULL AND TRIM(leido_por) != ''
        GROUP BY leido_por ORDER BY cantidad DESC
    """)
    return [{"leido_por": r["leido_por"], "cantidad": r["cantidad"]} for r in rows]


@cached(ttl_seconds=300)
async def get_refacturaciones_periodos() -> Dict[str, Any]:
    """Get available months and years."""
    rows = await execute_query("""
        SELECT
            ARRAY_AGG(DISTINCT mes ORDER BY mes) FILTER (WHERE mes IS NOT NULL) as meses,
            ARRAY_AGG(DISTINCT anio ORDER BY anio) FILTER (WHERE anio IS NOT NULL) as anios,
            (SELECT mes FROM refacturaciones WHERE mes IS NOT NULL AND anio IS NOT NULL ORDER BY anio DESC, mes DESC LIMIT 1) as ultimo_mes,
            (SELECT anio FROM refacturaciones WHERE mes IS NOT NULL AND anio IS NOT NULL ORDER BY anio DESC, mes DESC LIMIT 1) as ultimo_anio
        FROM refacturaciones
    """)
    if rows:
        return {
            "meses": rows[0]["meses"] or [],
            "anios": rows[0]["anios"] or [],
            "ultimo_mes": rows[0]["ultimo_mes"],
            "ultimo_anio": rows[0]["ultimo_anio"],
        }
    return {"meses": [], "anios": [], "ultimo_mes": None, "ultimo_anio": None}
