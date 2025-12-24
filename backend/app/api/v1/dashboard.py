"""
API endpoints para el Dashboard principal.
Proporciona un resumen de todos los modulos.
"""

from fastapi import APIRouter, Depends
from typing import Dict, Any
import os
from datetime import datetime
from ...schemas.user import User
from ...services import data_service, lecturas_service, teleco_service
from ..deps import get_current_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def get_file_update_time(filepath: str) -> str:
    """Get the last modification time of a file."""
    try:
        if os.path.exists(filepath):
            mtime = os.path.getmtime(filepath)
            return datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M')
    except:
        pass
    return None


@router.get("/summary")
async def get_dashboard_summary(
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get summary statistics for all modules."""

    base_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
        "data"
    )

    # === NNCC Stats ===
    nncc_stats = data_service.get_stats()
    nncc_csv_path = os.path.join(base_path, "2025-05 INFORME NNCC (2024-2029) DIC 2025.csv")
    nncc_updated = get_file_update_time(nncc_csv_path)

    # === Lecturas Stats ===
    lecturas_stats = lecturas_service.get_lecturas_stats()
    lecturas_files = [
        os.path.join(base_path, "informe_lectura_ORDENES_ORDENES.csv"),
        os.path.join(base_path, "informe_lectura_SEC_SEC.csv"),
        os.path.join(base_path, "informe_lectura_VIRTUAL_VIRTUAL VISIT.csv"),
        os.path.join(base_path, "informe_lectura_VIRTUAL_VISITA VIRTUAL.csv"),
    ]
    # Get most recent update time
    lecturas_updated = None
    for f in lecturas_files:
        t = get_file_update_time(f)
        if t and (lecturas_updated is None or t > lecturas_updated):
            lecturas_updated = t

    # === Teleco Stats ===
    teleco_stats = teleco_service.get_teleco_stats()
    teleco_csv_path = os.path.join(base_path, "informe_teleco.csv")
    teleco_updated = get_file_update_time(teleco_csv_path)

    # === Build Response ===
    return {
        "nncc": {
            "total": nncc_stats.get("total", 0),
            "efectivas": nncc_stats.get("efectivas", 0),
            "no_efectivas": nncc_stats.get("no_efectivas", 0),
            "tasa_efectividad": nncc_stats.get("tasa_efectividad", 0),
            "bien_ejecutados": nncc_stats.get("bien_ejecutados", 0),
            "mal_ejecutados": nncc_stats.get("mal_ejecutados", 0),
            "con_multa": nncc_stats.get("con_multa", 0),
            "monto_estimado": nncc_stats.get("monto_estimado", 0),
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
            "total": 0,
            "ultima_actualizacion": None,
            "activo": False,
        },
        "control_perdidas": {
            "total": 0,
            "ultima_actualizacion": None,
            "activo": False,
        },
        "resumen_general": {
            "total_registros": nncc_stats.get("total", 0) + lecturas_stats.get("total", 0) + teleco_stats.get("total", 0),
            "modulos_activos": 3,
            "modulos_pendientes": 2,
        }
    }
