"""
Service for reading pre-calculated NNCC dashboard statistics.
All metrics are pre-computed by scripts/precalculate_nncc.py and stored in nncc_dashboard_stats.
"""

from datetime import date, datetime, timedelta
from math import ceil

from .db_queries import execute_query
from .cache import cached
from . import settings_service


async def _get_stat(stat_key: str, base_periodo: str = None) -> dict | list:
    """Fetch a single pre-calculated stat by key and optional base filter."""
    base = base_periodo or "__all__"
    rows = await execute_query(
        "SELECT data FROM nncc_dashboard_stats WHERE stat_key = :key AND base_periodo = :base",
        {"key": stat_key, "base": base},
    )
    if not rows:
        return {}
    return rows[0]["data"]


@cached(ttl_seconds=300)
async def get_overview(base: str = None) -> dict:
    """Return Page A data: KPIs + trends + zone results + top comunas."""
    kpis = await _get_stat("overview_kpis", base)
    tendencia = await _get_stat("tendencia_temporal", base)
    zonas = await _get_stat("resultado_por_zona", base)
    top_comunas = await _get_stat("top_comunas_problemas", base)
    return {
        "kpis": kpis,
        "tendencia_temporal": tendencia,
        "resultado_por_zona": zonas,
        "top_comunas_problemas": top_comunas,
    }


@cached(ttl_seconds=300)
async def get_contratistas(base: str = None) -> dict:
    """Return Page B data: ranking + scatter."""
    ranking = await _get_stat("ranking_contratistas", base)
    scatter = await _get_stat("scatter_contratistas", base)
    return {
        "ranking_contratistas": ranking,
        "scatter_contratistas": scatter,
    }


@cached(ttl_seconds=300)
async def get_causas(base: str = None) -> dict:
    """Return Page C supplementary data: pareto + typical failures + zone breakdowns."""
    pareto = await _get_stat("pareto_causas", base)
    trabajos_mal = await _get_stat("trabajos_tipicamente_mal", base)
    desgloses = await _get_stat("desgloses_zona", base)
    return {
        "pareto_causas": pareto,
        "trabajos_tipicamente_mal": trabajos_mal,
        "desgloses_zona": desgloses,
    }


@cached(ttl_seconds=300)
async def get_mapa(base: str = None) -> list:
    """Return map points with coordinates."""
    return await _get_stat("mapa_puntos", base)


@cached(ttl_seconds=300)
async def get_kpi_modals(base: str = None) -> dict:
    """Return KPI modal drill-down data."""
    return await _get_stat("kpi_modals", base)


@cached(ttl_seconds=300)
async def get_mal_ejecutados(base: str = None) -> dict:
    """Return mal ejecutados analysis data."""
    return await _get_stat("mal_ejecutados_analysis", base)


@cached(ttl_seconds=300)
async def get_oca(base: str = None) -> dict:
    """Return OCA inspector data: ranking, effectiveness by zona, effectiveness trend."""
    ranking = await _get_stat("ranking_inspectores", base)
    efectividad_zona = await _get_stat("efectividad_por_zona", base)
    tendencia = await _get_stat("tendencia_efectividad", base)
    return {
        "ranking_inspectores": ranking,
        "efectividad_por_zona": efectividad_zona,
        "tendencia_efectividad": tendencia,
    }


@cached(ttl_seconds=300)
async def get_no_efectivos_analysis(base: str = None) -> dict:
    """Get non-effective inspections analysis by category."""
    return await _get_stat("no_efectivos_analysis", base)


@cached(ttl_seconds=300)
async def get_all_dashboard(base: str = None) -> dict:
    """Return ALL pre-calculated dashboard data in a single query (except mapa)."""
    base_val = base or "__all__"
    rows = await execute_query(
        "SELECT stat_key, data FROM nncc_dashboard_stats "
        "WHERE base_periodo = :base AND stat_key != 'mapa_puntos'",
        {"base": base_val},
    )
    result = {}
    for r in rows:
        result[r["stat_key"]] = r["data"]

    return {
        "overview": {
            "kpis": result.get("overview_kpis", {}),
            "tendencia_temporal": result.get("tendencia_temporal", []),
            "resultado_por_zona": result.get("resultado_por_zona", []),
            "top_comunas_problemas": result.get("top_comunas_problemas", []),
        },
        "contratistas": {
            "ranking_contratistas": result.get("ranking_contratistas", []),
            "scatter_contratistas": result.get("scatter_contratistas", []),
        },
        "causas": {
            "pareto_causas": result.get("pareto_causas", []),
            "trabajos_tipicamente_mal": result.get("trabajos_tipicamente_mal", []),
            "desgloses_zona": result.get("desgloses_zona", []),
        },
        "kpi_modals": result.get("kpi_modals", {}),
        "mal_ejecutados": result.get("mal_ejecutados_analysis", {}),
        "no_efectivos_analysis": result.get("no_efectivos_analysis", {}),
        "oca": {
            "ranking_inspectores": result.get("ranking_inspectores", []),
            "efectividad_por_zona": result.get("efectividad_por_zona", []),
            "tendencia_efectividad": result.get("tendencia_efectividad", []),
        },
    }


@cached(ttl_seconds=300)
async def get_available_bases() -> list:
    """Return list of base_periodo values that have pre-calculated stats."""
    rows = await execute_query(
        "SELECT DISTINCT base_periodo FROM nncc_dashboard_stats "
        "WHERE base_periodo != '__all__' "
        "ORDER BY base_periodo"
    )
    return [r["base_periodo"] for r in rows]


def _count_business_days(start: date, end: date) -> int:
    """Count weekdays (Mon-Fri) between start and end inclusive."""
    if end < start:
        return 0
    days = 0
    current = start
    while current <= end:
        if current.weekday() < 5:
            days += 1
        current += timedelta(days=1)
    return days


def _add_business_days(start: date, num_days: int) -> date:
    """Add num_days business days to start date."""
    current = start
    added = 0
    while added < num_days:
        current += timedelta(days=1)
        if current.weekday() < 5:
            added += 1
    return current


async def get_ejecucion_stats(base: str = None) -> dict:
    """Calculate execution timing stats for a base."""
    if not base:
        return {}

    fechas = await settings_service.get_fechas_envio_base()
    fecha_envio_str = fechas.get(base)
    if not fecha_envio_str:
        return {}

    try:
        fecha_envio = date.fromisoformat(fecha_envio_str)
    except ValueError:
        return {}

    kpis = await _get_stat("overview_kpis", base)
    if not kpis:
        return {}

    total_asignadas = kpis.get("total_asignadas", 0)
    total_inspeccionadas = kpis.get("total_inspecciones", 0)
    pct_avance = kpis.get("pct_avance", 0)

    if total_asignadas == 0:
        return {}

    # Get last inspection date
    ultima_inspeccion = None
    rows = await execute_query(
        "SELECT MAX(fecha_inspeccion) as ultima FROM nncc WHERE base = :base AND fecha_inspeccion IS NOT NULL",
        {"base": base},
    )
    if rows and rows[0]["ultima"]:
        raw = rows[0]["ultima"]
        if isinstance(raw, str):
            ultima_inspeccion = date.fromisoformat(raw[:10])
        elif isinstance(raw, (datetime, date)):
            ultima_inspeccion = raw if isinstance(raw, date) else raw.date()

    completado = pct_avance >= 100
    hoy = date.today()
    fecha_referencia = ultima_inspeccion if completado and ultima_inspeccion else hoy

    dias_habiles = _count_business_days(fecha_envio, fecha_referencia)
    dias_calendario = (fecha_referencia - fecha_envio).days

    promedio_diario = round(total_inspeccionadas / dias_habiles, 1) if dias_habiles > 0 else 0

    pendientes = max(0, total_asignadas - total_inspeccionadas)
    fecha_proyectada = None
    dias_restantes_habiles = None

    if not completado and promedio_diario > 0:
        dias_restantes_habiles = ceil(pendientes / promedio_diario)
        fecha_proyectada = _add_business_days(hoy, dias_restantes_habiles).isoformat()

    return {
        "fecha_envio": fecha_envio.isoformat(),
        "dias_calendario": dias_calendario,
        "dias_habiles": dias_habiles,
        "completado": completado,
        "ultima_inspeccion": ultima_inspeccion.isoformat() if ultima_inspeccion else None,
        "promedio_diario_habil": promedio_diario,
        "pendientes": pendientes,
        "dias_restantes_habiles": dias_restantes_habiles,
        "fecha_proyectada": fecha_proyectada,
    }
