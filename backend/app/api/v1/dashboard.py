"""
API endpoints para el Dashboard principal.
Proporciona un resumen de todos los modulos.
Todo se lee desde Supabase (PostgreSQL), sin dependencia de archivos CSV.
"""

from fastapi import APIRouter, Depends
from typing import Dict, Any
import asyncio
from ...schemas.user import User
from ...services import data_service, lecturas_service, teleco_service, calidad_service, corte_service, medidores_cruzados_service
from ...services.db_queries import execute_scalar
from ...services.cache import cached
from ..deps import get_current_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@cached(ttl_seconds=300)
async def _get_last_update(table: str, date_col: str = "fecha_inspeccion") -> str:
    """Get the most recent pipeline update timestamp.

    For tables with pre-calculated stats (nncc), uses calculated_at from
    nncc_dashboard_stats. For other tables, falls back to MAX(date_col).
    """
    try:
        if table == "nncc":
            result = await execute_scalar(
                "SELECT MAX(calculated_at)::text FROM nncc_dashboard_stats"
            )
        else:
            result = await execute_scalar(
                f"SELECT MAX({date_col})::text FROM {table}"
            )
        if result:
            return result[:10]  # YYYY-MM-DD
    except Exception:
        pass
    return None


@cached(ttl_seconds=60)
async def _compute_dashboard_summary() -> Dict[str, Any]:
    """Internal cached function that does all the heavy work."""
    # Run all stats queries + update timestamps in parallel
    (
        nncc_stats, lecturas_stats, teleco_stats, calidad_stats, corte_stats, mc_stats,
        nncc_updated, lecturas_updated, teleco_updated, calidad_updated, corte_updated, mc_updated,
    ) = await asyncio.gather(
        data_service.get_stats(),
        lecturas_service.get_lecturas_stats(),
        teleco_service.get_teleco_stats(),
        calidad_service.get_calidad_stats(),
        corte_service.get_corte_stats(),
        medidores_cruzados_service.get_stats(),
        _get_last_update("nncc"),
        _get_last_update("lecturas", "fecha_ingreso"),
        _get_last_update("telecomunicaciones"),
        _get_last_update("calidad_mono_base"),
        _get_last_update("corte_reposicion"),
        _get_last_update("medidores_cruzados"),
    )

    return {
        "nncc": {
            "total": nncc_stats.get("total", 0),
            "efectivas": nncc_stats.get("efectivas", 0),
            "no_efectivas": nncc_stats.get("no_efectivas", 0),
            "tasa_efectividad": nncc_stats.get("tasa_efectividad", 0),
            "bien_ejecutados": nncc_stats.get("bien_ejecutados", 0),
            "mal_ejecutados": nncc_stats.get("mal_ejecutados", 0),
            "con_multa": nncc_stats.get("con_multa", 0),
            "por_zona": nncc_stats.get("por_zona", {}),
            "por_mes": nncc_stats.get("por_mes", []),
            "comparativas": nncc_stats.get("comparativas", {}),
            "ultima_actualizacion": nncc_updated,
            "activo": True,
        },
        "lecturas": {
            "total": lecturas_stats.get("total", 0),
            "inspeccionadas": lecturas_stats.get("inspeccionadas", 0),
            "pendientes": lecturas_stats.get("pendientes", 0),
            "tasa_inspeccion": lecturas_stats.get("tasa_inspeccion", 0),
            "en_plazo": lecturas_stats.get("en_plazo", 0),
            "fuera_plazo": lecturas_stats.get("fuera_plazo", 0),
            "tasa_cumplimiento_plazo": lecturas_stats.get("tasa_cumplimiento_plazo", 0),
            "dias_respuesta_promedio": lecturas_stats.get("dias_respuesta_promedio", 0),
            "por_origen": lecturas_stats.get("por_origen", {}),
            "por_hallazgo": lecturas_stats.get("por_hallazgo", []),
            "comparativas": lecturas_stats.get("comparativas", {}),
            "ultima_actualizacion": lecturas_updated,
            "activo": True,
        },
        "teleco": {
            "total": teleco_stats.get("total", 0),
            "aprobados": teleco_stats.get("aprobados", 0),
            "rechazados": teleco_stats.get("rechazados", 0),
            "tasa_aprobacion": teleco_stats.get("tasa_aprobacion", 0),
            "total_postes": teleco_stats.get("total_postes", 0),
            "por_empresa": teleco_stats.get("por_empresa", []),
            "comparativas": teleco_stats.get("comparativas", {}),
            "ultima_actualizacion": teleco_updated,
            "activo": True,
        },
        "corte_reposicion": {
            "total": corte_stats.get("total", 0),
            "bien_ejecutados": corte_stats.get("bien_ejecutados", 0),
            "no_ejecutados": corte_stats.get("no_ejecutados", 0),
            "tasa_calidad": corte_stats.get("tasa_calidad", 0),
            "con_multa": corte_stats.get("con_multa", 0),
            "sin_multa": corte_stats.get("sin_multa", 0),
            "tasa_multa": corte_stats.get("tasa_multa", 0),
            "factible_cortar": corte_stats.get("factible_cortar", 0),
            "no_factible_cortar": corte_stats.get("no_factible_cortar", 0),
            "por_zona": corte_stats.get("por_zona", [])[:5],
            "por_situacion_encontrada": corte_stats.get("por_situacion_encontrada", [])[:5],
            "por_mes": corte_stats.get("por_mes", []),
            "ultima_actualizacion": corte_updated,
            "activo": corte_stats.get("total", 0) > 0,
        },
        "control_perdidas": {
            "total_solicitadas": calidad_stats.get("total_solicitadas", 0),
            "total_ejecutadas": calidad_stats.get("total_ejecutadas", 0),
            "pendientes": calidad_stats.get("pendientes", 0),
            "tasa_ejecucion": calidad_stats.get("tasa_ejecucion", 0),
            "monofasico": calidad_stats.get("monofasico", {}),
            "trifasico": calidad_stats.get("trifasico", {}),
            "por_resultado": calidad_stats.get("por_resultado", [])[:5],
            "por_contratista": calidad_stats.get("por_contratista", [])[:5],
            "anomalias": calidad_stats.get("anomalias", {}),
            "ultima_actualizacion": calidad_updated,
            "activo": calidad_stats.get("total_ejecutadas", 0) > 0,
        },
        "medidores_cruzados": {
            "total": mc_stats.get("total", 0),
            "por_zona": mc_stats.get("por_zona", {}),
            "por_resultado": mc_stats.get("por_resultado", {}),
            "por_estado_medidor": mc_stats.get("por_estado_medidor", {}),
            "por_inspector": mc_stats.get("por_inspector", [])[:5],
            "evolucion_mensual": mc_stats.get("evolucion_mensual", []),
            "ultima_actualizacion": mc_updated,
            "activo": mc_stats.get("total", 0) > 0,
        },
        "resumen_general": {
            "total_registros": (
                nncc_stats.get("total", 0) +
                lecturas_stats.get("total", 0) +
                teleco_stats.get("total", 0) +
                calidad_stats.get("total_ejecutadas", 0) +
                corte_stats.get("total", 0) +
                mc_stats.get("total", 0)
            ),
            "modulos_activos": sum([
                1,  # NNCC siempre activo
                1,  # Lecturas siempre activo
                1,  # Teleco siempre activo
                1 if calidad_stats.get("total_ejecutadas", 0) > 0 else 0,
                1 if corte_stats.get("total", 0) > 0 else 0,
                1 if mc_stats.get("total", 0) > 0 else 0,
            ]),
            "modulos_pendientes": sum([
                0 if calidad_stats.get("total_ejecutadas", 0) > 0 else 1,
                0 if corte_stats.get("total", 0) > 0 else 1,
                0 if mc_stats.get("total", 0) > 0 else 1,
            ]),
        }
    }


@router.get("/summary")
async def get_dashboard_summary(
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get summary statistics for all modules."""
    return await _compute_dashboard_summary()
