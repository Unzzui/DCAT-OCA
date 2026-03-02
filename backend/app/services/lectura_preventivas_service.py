"""
Servicio para el modulo de Lecturas Preventivas.
"""

import asyncio
from typing import Optional, Dict, Any, List
from .db_queries import execute_query, execute_scalar
from .cache import cached


def _build_where(
    sector: Optional[int] = None,
    zona: Optional[int] = None,
    codigo_lector: Optional[int] = None,
    mes: Optional[int] = None,
    anio: Optional[int] = None,
    search: Optional[str] = None,
    con_irregularidad: Optional[bool] = None,
) -> tuple[str, dict]:
    """Build WHERE clause and params from filters."""
    conditions = []
    params = {}

    if sector:
        conditions.append("sector = :sector")
        params["sector"] = sector
    if zona:
        conditions.append("zona = :zona")
        params["zona"] = zona
    if codigo_lector:
        conditions.append("codigo_lector = :codigo_lector")
        params["codigo_lector"] = codigo_lector
    if mes:
        conditions.append("mes = :mes")
        params["mes"] = mes
    if anio:
        conditions.append("anio = :anio")
        params["anio"] = anio
    if search:
        conditions.append(
            "(numero_cliente ILIKE :search OR direccion ILIKE :search "
            "OR medidor ILIKE :search OR ruta ILIKE :search)"
        )
        params["search"] = f"%{search}%"
    if con_irregularidad is True:
        conditions.append(
            "(irregularidad_1 IS NOT NULL AND TRIM(irregularidad_1) != '' "
            "OR irregularidad_2 IS NOT NULL AND TRIM(irregularidad_2) != '')"
        )
    elif con_irregularidad is False:
        conditions.append(
            "(irregularidad_1 IS NULL OR TRIM(irregularidad_1) = '') "
            "AND (irregularidad_2 IS NULL OR TRIM(irregularidad_2) = '')"
        )

    where = " AND ".join(conditions) if conditions else "1=1"
    return where, params


@cached(ttl_seconds=60)
async def get_preventivas_stats(
    sector: Optional[int] = None,
    zona: Optional[int] = None,
    codigo_lector: Optional[int] = None,
    mes: Optional[int] = None,
    anio: Optional[int] = None,
) -> Dict[str, Any]:
    """Get aggregated statistics for preventivas."""
    where, params = _build_where(
        sector=sector, zona=zona, codigo_lector=codigo_lector, mes=mes, anio=anio
    )

    empty_response = {
        "total": 0,
        "con_irregularidad": 0,
        "sin_irregularidad": 0,
        "tasa_irregularidad": 0,
        "consumo_promedio": 0,
        "lecturas_insitu": 0,
        "lecturas_rf": 0,
        "por_sector": [],
        "por_zona": [],
        "por_lector": [],
        "por_irregularidad": [],
        "por_verificacion": [],
        "evolucion_mensual": [],
        "insights": [],
    }

    # Run queries in parallel
    kpis, sector_rows, zona_rows, lector_rows, irreg_rows, verif_rows, evolucion_rows = await asyncio.gather(
        execute_query(f"""
            SELECT
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE irregularidad_1 IS NOT NULL AND TRIM(irregularidad_1) != '') as con_irregularidad,
                AVG(consumo_prom_diario) FILTER (WHERE consumo_prom_diario IS NOT NULL AND consumo_prom_diario > 0) as consumo_promedio,
                COUNT(*) FILTER (WHERE UPPER(insitu) = 'S') as lecturas_insitu,
                COUNT(*) FILTER (WHERE UPPER(rf) = 'S') as lecturas_rf,
                COUNT(DISTINCT codigo_lector) as lectores_unicos
            FROM lecturas_preventivas WHERE {where}
        """, params),
        execute_query(f"""
            SELECT sector, COUNT(*) as cantidad,
                COUNT(*) FILTER (WHERE irregularidad_1 IS NOT NULL AND TRIM(irregularidad_1) != '') as con_irregularidad
            FROM lecturas_preventivas WHERE {where} AND sector IS NOT NULL
            GROUP BY sector ORDER BY cantidad DESC LIMIT 10
        """, params),
        execute_query(f"""
            SELECT zona, COUNT(*) as cantidad,
                AVG(consumo_prom_diario) FILTER (WHERE consumo_prom_diario > 0) as consumo_promedio
            FROM lecturas_preventivas WHERE {where} AND zona IS NOT NULL
            GROUP BY zona ORDER BY cantidad DESC LIMIT 10
        """, params),
        execute_query(f"""
            SELECT codigo_lector, COUNT(*) as cantidad,
                COUNT(*) FILTER (WHERE irregularidad_1 IS NOT NULL AND TRIM(irregularidad_1) != '') as irregularidades
            FROM lecturas_preventivas WHERE {where} AND codigo_lector IS NOT NULL
            GROUP BY codigo_lector ORDER BY cantidad DESC LIMIT 10
        """, params),
        execute_query(f"""
            SELECT
                COALESCE(NULLIF(TRIM(irregularidad_1), ''), 'Sin Irregularidad') as irregularidad,
                COUNT(*) as cantidad
            FROM lecturas_preventivas WHERE {where}
            GROUP BY irregularidad ORDER BY cantidad DESC LIMIT 10
        """, params),
        execute_query(f"""
            SELECT
                COALESCE(NULLIF(TRIM(verificacion_lectura), ''), 'Sin Verificacion') as verificacion,
                COUNT(*) as cantidad
            FROM lecturas_preventivas WHERE {where}
            GROUP BY verificacion ORDER BY cantidad DESC LIMIT 10
        """, params),
        execute_query(f"""
            SELECT
                anio || '-' || LPAD(mes::text, 2, '0') as periodo,
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE irregularidad_1 IS NOT NULL AND TRIM(irregularidad_1) != '') as con_irregularidad,
                AVG(consumo_prom_diario) FILTER (WHERE consumo_prom_diario > 0) as consumo_promedio
            FROM lecturas_preventivas WHERE {where} AND mes IS NOT NULL AND anio IS NOT NULL
            GROUP BY anio, mes ORDER BY anio, mes
        """, params),
    )

    if not kpis or kpis[0]["total"] == 0:
        return empty_response

    k = kpis[0]
    total = k["total"]
    con_irreg = k["con_irregularidad"]
    sin_irreg = total - con_irreg
    tasa_irreg = round(con_irreg / total * 100, 1) if total > 0 else 0

    por_sector = [
        {
            "sector": r["sector"],
            "cantidad": r["cantidad"],
            "con_irregularidad": r["con_irregularidad"],
            "tasa": round(r["con_irregularidad"] / r["cantidad"] * 100, 1) if r["cantidad"] > 0 else 0,
        }
        for r in sector_rows
    ]

    por_zona = [
        {
            "zona": r["zona"],
            "cantidad": r["cantidad"],
            "consumo_promedio": round(r["consumo_promedio"], 2) if r["consumo_promedio"] else 0,
        }
        for r in zona_rows
    ]

    por_lector = [
        {
            "codigo_lector": r["codigo_lector"],
            "cantidad": r["cantidad"],
            "irregularidades": r["irregularidades"],
            "tasa": round(r["irregularidades"] / r["cantidad"] * 100, 1) if r["cantidad"] > 0 else 0,
        }
        for r in lector_rows
    ]

    por_irregularidad = [
        {"irregularidad": r["irregularidad"], "cantidad": r["cantidad"]}
        for r in irreg_rows
    ]

    por_verificacion = [
        {"verificacion": r["verificacion"], "cantidad": r["cantidad"]}
        for r in verif_rows
    ]

    evolucion_mensual = [
        {
            "periodo": r["periodo"],
            "total": r["total"],
            "con_irregularidad": r["con_irregularidad"],
            "tasa": round(r["con_irregularidad"] / r["total"] * 100, 1) if r["total"] > 0 else 0,
            "consumo_promedio": round(r["consumo_promedio"], 2) if r["consumo_promedio"] else 0,
        }
        for r in evolucion_rows[-12:]
    ]

    # Generate insights
    insights = []
    if tasa_irreg > 10:
        insights.append({
            "tipo": "warning",
            "titulo": "Alta tasa de irregularidades",
            "mensaje": f"El {tasa_irreg}% de las lecturas presentan irregularidades"
        })
    elif tasa_irreg < 5:
        insights.append({
            "tipo": "success",
            "titulo": "Baja tasa de irregularidades",
            "mensaje": f"Solo el {tasa_irreg}% de las lecturas presentan irregularidades"
        })

    if k["lecturas_insitu"] > 0 and k["lecturas_rf"] > 0:
        ratio_rf = round(k["lecturas_rf"] / (k["lecturas_insitu"] + k["lecturas_rf"]) * 100, 1)
        insights.append({
            "tipo": "info",
            "titulo": "Lecturas RF",
            "mensaje": f"El {ratio_rf}% de las lecturas se realizan por RF"
        })

    if por_sector:
        max_sector = max(por_sector, key=lambda x: x["tasa"])
        if max_sector["tasa"] > 15:
            insights.append({
                "tipo": "warning",
                "titulo": f"Sector {max_sector['sector']} con alta irregularidad",
                "mensaje": f"Presenta una tasa de {max_sector['tasa']}% de irregularidades"
            })

    return {
        "total": total,
        "con_irregularidad": con_irreg,
        "sin_irregularidad": sin_irreg,
        "tasa_irregularidad": tasa_irreg,
        "consumo_promedio": round(k["consumo_promedio"], 2) if k["consumo_promedio"] else 0,
        "lecturas_insitu": k["lecturas_insitu"],
        "lecturas_rf": k["lecturas_rf"],
        "lectores_unicos": k["lectores_unicos"],
        "por_sector": por_sector,
        "por_zona": por_zona,
        "por_lector": por_lector,
        "por_irregularidad": por_irregularidad,
        "por_verificacion": por_verificacion,
        "evolucion_mensual": evolucion_mensual,
        "insights": insights,
    }


async def get_preventivas_filtered_data(
    search: Optional[str] = None,
    sector: Optional[int] = None,
    zona: Optional[int] = None,
    codigo_lector: Optional[int] = None,
    mes: Optional[int] = None,
    anio: Optional[int] = None,
    con_irregularidad: Optional[bool] = None,
    page: int = 1,
    limit: int = 50,
    sort_by: str = "id",
    order: str = "desc",
) -> Dict[str, Any]:
    """Get paginated list of preventivas."""
    where, params = _build_where(
        sector=sector, zona=zona, codigo_lector=codigo_lector,
        mes=mes, anio=anio, search=search, con_irregularidad=con_irregularidad,
    )

    allowed_sort = {"id", "numero_cliente", "sector", "zona", "consumo_prom_diario", "codigo_lector"}
    if sort_by not in allowed_sort:
        sort_by = "id"
    order_dir = "ASC" if order == "asc" else "DESC"

    total = await execute_scalar(
        f"SELECT COUNT(*) FROM lecturas_preventivas WHERE {where}", params
    )

    offset = (page - 1) * limit
    params["limit"] = limit
    params["offset"] = offset

    rows = await execute_query(
        f"""SELECT id, numero_cliente, sector, zona, grupo, ruta, tipo_operacion,
               tarifa, direccion, consumo_prom_diario, periodo_lectura, medidor,
               marca_medidor, lectura_anterior, lectura_actual, consumo_anterior,
               consumo_actual, irregularidad_1, irregularidad_2, verificacion_lectura,
               codigo_lector, insitu, facturado, rf, mes, anio
        FROM lecturas_preventivas WHERE {where}
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
async def get_preventivas_sectores() -> List[int]:
    """Get list of unique sectors."""
    rows = await execute_query(
        "SELECT DISTINCT sector FROM lecturas_preventivas WHERE sector IS NOT NULL ORDER BY sector"
    )
    return [r["sector"] for r in rows]


@cached(ttl_seconds=300)
async def get_preventivas_zonas() -> List[int]:
    """Get list of unique zonas."""
    rows = await execute_query(
        "SELECT DISTINCT zona FROM lecturas_preventivas WHERE zona IS NOT NULL ORDER BY zona"
    )
    return [r["zona"] for r in rows]


@cached(ttl_seconds=300)
async def get_preventivas_lectores() -> List[Dict[str, Any]]:
    """Get list of lectores with stats."""
    rows = await execute_query("""
        SELECT codigo_lector, COUNT(*) as cantidad
        FROM lecturas_preventivas WHERE codigo_lector IS NOT NULL
        GROUP BY codigo_lector ORDER BY cantidad DESC
    """)
    return [{"codigo_lector": r["codigo_lector"], "cantidad": r["cantidad"]} for r in rows]


@cached(ttl_seconds=300)
async def get_preventivas_periodos() -> Dict[str, Any]:
    """Get available months and years."""
    rows = await execute_query("""
        SELECT
            ARRAY_AGG(DISTINCT mes ORDER BY mes) FILTER (WHERE mes IS NOT NULL) as meses,
            ARRAY_AGG(DISTINCT anio ORDER BY anio) FILTER (WHERE anio IS NOT NULL) as anios,
            (SELECT mes FROM lecturas_preventivas WHERE mes IS NOT NULL AND anio IS NOT NULL ORDER BY anio DESC, mes DESC LIMIT 1) as ultimo_mes,
            (SELECT anio FROM lecturas_preventivas WHERE mes IS NOT NULL AND anio IS NOT NULL ORDER BY anio DESC, mes DESC LIMIT 1) as ultimo_anio
        FROM lecturas_preventivas
    """)
    if rows:
        return {
            "meses": rows[0]["meses"] or [],
            "anios": rows[0]["anios"] or [],
            "ultimo_mes": rows[0]["ultimo_mes"],
            "ultimo_anio": rows[0]["ultimo_anio"],
        }
    return {"meses": [], "anios": [], "ultimo_mes": None, "ultimo_anio": None}
