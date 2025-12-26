"""
API endpoints para el modulo de Control de Perdidas (Calidad).
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from typing import Optional, List, Dict, Any
import pandas as pd
import io
from ...schemas.user import User
from ...services import calidad_service
from ..deps import get_current_user

router = APIRouter(prefix="/calidad", tags=["Control de Perdidas"])


@router.get("")
async def get_calidad(
    search: Optional[str] = Query(None, description="Buscar por cliente, nombre, medidor, etc"),
    tipo_sistema: Optional[str] = Query(None, description="Filtrar por tipo (MONOFASICO/TRIFASICO)"),
    tipo_resultado: Optional[str] = Query(None, description="Filtrar por resultado"),
    comuna: Optional[str] = Query(None, description="Filtrar por comuna"),
    contratista: Optional[str] = Query(None, description="Filtrar por contratista"),
    inspector: Optional[str] = Query(None, description="Filtrar por inspector"),
    mes: Optional[int] = Query(None, description="Filtrar por mes (1-12)"),
    anio: Optional[int] = Query(None, description="Filtrar por año"),
    page: int = Query(1, ge=1, description="Pagina"),
    limit: int = Query(50, ge=1, le=500, description="Registros por pagina"),
    sort_by: str = Query("id", description="Campo para ordenar"),
    order: str = Query("desc", description="Orden (asc/desc)"),
    current_user: User = Depends(get_current_user),
):
    """Get paginated list of Control de Perdidas inspections."""
    return calidad_service.get_calidad_filtered_data(
        search=search,
        tipo_sistema=tipo_sistema,
        tipo_resultado=tipo_resultado,
        comuna=comuna,
        contratista=contratista,
        inspector=inspector,
        mes=mes,
        anio=anio,
        page=page,
        limit=limit,
        sort_by=sort_by,
        order=order,
    )


@router.get("/stats")
async def get_stats(
    tipo_sistema: Optional[str] = Query(None, description="Filtrar por tipo sistema"),
    comuna: Optional[str] = Query(None, description="Filtrar por comuna"),
    contratista: Optional[str] = Query(None, description="Filtrar por contratista"),
    mes: Optional[int] = Query(None, description="Filtrar por mes (1-12)"),
    anio: Optional[int] = Query(None, description="Filtrar por año"),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get aggregated statistics for Control de Perdidas."""
    return calidad_service.get_calidad_stats(
        tipo_sistema=tipo_sistema,
        comuna=comuna,
        contratista=contratista,
        mes=mes,
        anio=anio,
    )


@router.get("/comunas", response_model=List[str])
async def get_comunas(
    current_user: User = Depends(get_current_user),
):
    """Get list of unique comunas."""
    return calidad_service.get_calidad_comunas()


@router.get("/inspectores", response_model=List[Dict[str, Any]])
async def get_inspectores(
    current_user: User = Depends(get_current_user),
):
    """Get list of inspectors with their stats."""
    return calidad_service.get_calidad_inspectores()


@router.get("/contratistas", response_model=List[str])
async def get_contratistas(
    current_user: User = Depends(get_current_user),
):
    """Get list of unique contratistas."""
    return calidad_service.get_calidad_contratistas()


@router.get("/resultados", response_model=List[str])
async def get_resultados(
    current_user: User = Depends(get_current_user),
):
    """Get list of unique resultado types."""
    return calidad_service.get_calidad_resultados()


@router.get("/periodos")
async def get_periodos(
    current_user: User = Depends(get_current_user),
) -> Dict[str, List[int]]:
    """Get available months and years."""
    return calidad_service.get_calidad_periodos()


@router.get("/evolucion")
async def get_evolucion(
    tipo_sistema: Optional[str] = Query(None, description="Filtrar por tipo sistema"),
    contratista: Optional[str] = Query(None, description="Filtrar por contratista"),
    current_user: User = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    """Get monthly evolution of quality metrics."""
    return calidad_service.get_calidad_evolucion(
        tipo_sistema=tipo_sistema,
        contratista=contratista,
    )


@router.get("/export")
async def export_data(
    format: str = Query("csv", description="Formato de exportacion (csv, excel)"),
    search: Optional[str] = None,
    tipo_sistema: Optional[str] = None,
    tipo_resultado: Optional[str] = None,
    comuna: Optional[str] = None,
    contratista: Optional[str] = None,
    inspector: Optional[str] = None,
    mes: Optional[int] = None,
    anio: Optional[int] = None,
    current_user: User = Depends(get_current_user),
):
    """Export filtered data to CSV or Excel."""
    result = calidad_service.get_calidad_filtered_data(
        search=search,
        tipo_sistema=tipo_sistema,
        tipo_resultado=tipo_resultado,
        comuna=comuna,
        contratista=contratista,
        inspector=inspector,
        mes=mes,
        anio=anio,
        page=1,
        limit=100000,
    )

    df = pd.DataFrame(result["items"])

    if df.empty:
        raise HTTPException(status_code=404, detail="No hay datos para exportar")

    if format == "excel":
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Control Perdidas')
        output.seek(0)

        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": "attachment; filename=control_perdidas.xlsx"
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
                "Content-Disposition": "attachment; filename=control_perdidas.csv"
            }
        )
