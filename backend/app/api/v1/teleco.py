"""
API endpoints para el modulo de Telecomunicaciones.
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from typing import Optional, List, Dict, Any
import pandas as pd
import io
from ...schemas.user import User
from ...services import teleco_service
from ..deps import get_current_user

router = APIRouter(prefix="/teleco", tags=["Telecomunicaciones"])


@router.get("")
async def get_teleco(
    search: Optional[str] = Query(None, description="Buscar por empresa, comuna, etc"),
    empresa: Optional[str] = Query(None, description="Filtrar por empresa"),
    comuna: Optional[str] = Query(None, description="Filtrar por comuna"),
    inspector: Optional[str] = Query(None, description="Filtrar por inspector"),
    resultado: Optional[str] = Query(None, description="Filtrar por resultado (APROBADO/RECHAZADO)"),
    tiene_plano: Optional[str] = Query(None, description="Filtrar por tiene plano (SI/NO/INCOMPLETO)"),
    fecha_desde: Optional[str] = Query(None, description="Fecha desde (YYYY-MM-DD)"),
    fecha_hasta: Optional[str] = Query(None, description="Fecha hasta (YYYY-MM-DD)"),
    page: int = Query(1, ge=1, description="Pagina"),
    limit: int = Query(50, ge=1, le=500, description="Registros por pagina"),
    sort_by: str = Query("fecha_inspeccion", description="Campo para ordenar"),
    order: str = Query("desc", description="Orden (asc/desc)"),
    current_user: User = Depends(get_current_user),
):
    """Get paginated list of Telecomunicaciones with filters."""
    return teleco_service.get_teleco_filtered_data(
        search=search,
        empresa=empresa,
        comuna=comuna,
        inspector=inspector,
        resultado=resultado,
        tiene_plano=tiene_plano,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        page=page,
        limit=limit,
        sort_by=sort_by,
        order=order,
    )


@router.get("/stats")
async def get_stats(
    empresa: Optional[str] = Query(None, description="Filtrar por empresa"),
    comuna: Optional[str] = Query(None, description="Filtrar por comuna"),
    fecha_desde: Optional[str] = Query(None, description="Fecha desde (YYYY-MM-DD)"),
    fecha_hasta: Optional[str] = Query(None, description="Fecha hasta (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get aggregated statistics for Telecomunicaciones."""
    return teleco_service.get_teleco_stats(
        empresa=empresa,
        comuna=comuna,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
    )


@router.get("/empresas", response_model=List[str])
async def get_empresas(
    current_user: User = Depends(get_current_user),
):
    """Get list of unique empresas."""
    return teleco_service.get_teleco_empresas()


@router.get("/comunas", response_model=List[str])
async def get_comunas(
    current_user: User = Depends(get_current_user),
):
    """Get list of unique comunas."""
    return teleco_service.get_teleco_comunas()


@router.get("/inspectors", response_model=List[Dict[str, Any]])
async def get_inspectors(
    current_user: User = Depends(get_current_user),
):
    """Get list of inspectors with their stats."""
    return teleco_service.get_teleco_inspectors()


@router.get("/export")
async def export_data(
    format: str = Query("csv", description="Formato de exportacion (csv, excel)"),
    search: Optional[str] = None,
    empresa: Optional[str] = None,
    comuna: Optional[str] = None,
    resultado: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    """Export filtered data to CSV or Excel."""
    result = teleco_service.get_teleco_filtered_data(
        search=search,
        empresa=empresa,
        comuna=comuna,
        resultado=resultado,
        page=1,
        limit=100000,
    )

    df = pd.DataFrame(result["items"])

    if df.empty:
        raise HTTPException(status_code=404, detail="No hay datos para exportar")

    if format == "excel":
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Telecomunicaciones')
        output.seek(0)

        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": "attachment; filename=telecomunicaciones.xlsx"
            }
        )
    else:
        output = io.StringIO()
        df.to_csv(output, index=False)
        output.seek(0)

        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={
                "Content-Disposition": "attachment; filename=telecomunicaciones.csv"
            }
        )
