"""
API endpoints para el modulo de Lecturas Preventivas.
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from typing import Optional, List, Dict, Any
import pandas as pd
import io
from ...schemas.user import User
from ...services import lectura_preventivas_service
from ..deps import get_current_user

router = APIRouter(prefix="/lectura/preventivas", tags=["Lecturas - Preventivas"])


@router.get("")
async def get_preventivas(
    search: Optional[str] = Query(None, description="Buscar por cliente, direccion, etc"),
    sector: Optional[int] = Query(None, description="Filtrar por sector"),
    zona: Optional[int] = Query(None, description="Filtrar por zona"),
    codigo_lector: Optional[int] = Query(None, description="Filtrar por codigo lector"),
    con_irregularidad: Optional[bool] = Query(None, description="Filtrar por irregularidad"),
    mes: Optional[int] = Query(None, description="Filtrar por mes (1-12)"),
    anio: Optional[int] = Query(None, description="Filtrar por año"),
    page: int = Query(1, ge=1, description="Pagina"),
    limit: int = Query(50, ge=1, le=500, description="Registros por pagina"),
    sort_by: str = Query("id", description="Campo para ordenar"),
    order: str = Query("desc", description="Orden (asc/desc)"),
    current_user: User = Depends(get_current_user),
):
    """Get paginated list of preventivas."""
    return await lectura_preventivas_service.get_preventivas_filtered_data(
        search=search,
        sector=sector,
        zona=zona,
        codigo_lector=codigo_lector,
        con_irregularidad=con_irregularidad,
        mes=mes,
        anio=anio,
        page=page,
        limit=limit,
        sort_by=sort_by,
        order=order,
    )


@router.get("/stats")
async def get_stats(
    sector: Optional[int] = Query(None, description="Filtrar por sector"),
    zona: Optional[int] = Query(None, description="Filtrar por zona"),
    codigo_lector: Optional[int] = Query(None, description="Filtrar por codigo lector"),
    mes: Optional[int] = Query(None, description="Filtrar por mes (1-12)"),
    anio: Optional[int] = Query(None, description="Filtrar por año"),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get aggregated statistics for preventivas."""
    return await lectura_preventivas_service.get_preventivas_stats(
        sector=sector,
        zona=zona,
        codigo_lector=codigo_lector,
        mes=mes,
        anio=anio,
    )


@router.get("/sectores", response_model=List[int])
async def get_sectores(
    current_user: User = Depends(get_current_user),
):
    """Get list of unique sectors."""
    return await lectura_preventivas_service.get_preventivas_sectores()


@router.get("/zonas", response_model=List[int])
async def get_zonas(
    current_user: User = Depends(get_current_user),
):
    """Get list of unique zonas."""
    return await lectura_preventivas_service.get_preventivas_zonas()


@router.get("/lectores", response_model=List[Dict[str, Any]])
async def get_lectores(
    current_user: User = Depends(get_current_user),
):
    """Get list of lectores with stats."""
    return await lectura_preventivas_service.get_preventivas_lectores()


@router.get("/periodos")
async def get_periodos(
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get available months and years."""
    return await lectura_preventivas_service.get_preventivas_periodos()


@router.get("/export")
async def export_data(
    format: str = Query("csv", description="Formato de exportacion (csv, excel)"),
    search: Optional[str] = None,
    sector: Optional[int] = None,
    zona: Optional[int] = None,
    codigo_lector: Optional[int] = None,
    con_irregularidad: Optional[bool] = None,
    mes: Optional[int] = None,
    anio: Optional[int] = None,
    current_user: User = Depends(get_current_user),
):
    """Export filtered data to CSV or Excel."""
    result = await lectura_preventivas_service.get_preventivas_filtered_data(
        search=search,
        sector=sector,
        zona=zona,
        codigo_lector=codigo_lector,
        con_irregularidad=con_irregularidad,
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
            df.to_excel(writer, sheet_name='Preventivas', index=False)
        output.seek(0)

        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": "attachment; filename=lecturas_preventivas.xlsx"
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
                "Content-Disposition": "attachment; filename=lecturas_preventivas.csv"
            }
        )
