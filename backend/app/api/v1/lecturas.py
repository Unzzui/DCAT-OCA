"""
API endpoints para el modulo de Lecturas.
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from typing import Optional, List, Dict, Any
import pandas as pd
import io
from ...schemas.user import User
from ...services import lecturas_service
from ..deps import get_current_user

router = APIRouter(prefix="/lecturas", tags=["Lecturas"])


@router.get("")
async def get_lecturas(
    search: Optional[str] = Query(None, description="Buscar por cliente, nombre, orden, etc"),
    sector: Optional[str] = Query(None, description="Filtrar por sector (ORIENTE/PONIENTE)"),
    inspector: Optional[str] = Query(None, description="Filtrar por inspector"),
    estado_plazo: Optional[str] = Query(None, description="Filtrar por estado de plazo"),
    hallazgo: Optional[str] = Query(None, description="Filtrar por hallazgo"),
    origen: Optional[str] = Query(None, description="Filtrar por origen (ORDENES/SEC)"),
    comuna: Optional[str] = Query(None, description="Filtrar por comuna"),
    fecha_desde: Optional[str] = Query(None, description="Fecha desde (YYYY-MM-DD)"),
    fecha_hasta: Optional[str] = Query(None, description="Fecha hasta (YYYY-MM-DD)"),
    page: int = Query(1, ge=1, description="Pagina"),
    limit: int = Query(50, ge=1, le=500, description="Registros por pagina"),
    sort_by: str = Query("fecha_ingreso", description="Campo para ordenar"),
    order: str = Query("desc", description="Orden (asc/desc)"),
    current_user: User = Depends(get_current_user),
):
    """Get paginated list of Lecturas with filters."""
    return lecturas_service.get_lecturas_filtered_data(
        search=search,
        sector=sector,
        inspector=inspector,
        estado_plazo=estado_plazo,
        hallazgo=hallazgo,
        origen=origen,
        comuna=comuna,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        page=page,
        limit=limit,
        sort_by=sort_by,
        order=order,
    )


@router.get("/stats")
async def get_stats(
    sector: Optional[str] = Query(None, description="Filtrar por sector"),
    origen: Optional[str] = Query(None, description="Filtrar por origen (ORDENES/SEC)"),
    fecha_desde: Optional[str] = Query(None, description="Fecha desde (YYYY-MM-DD)"),
    fecha_hasta: Optional[str] = Query(None, description="Fecha hasta (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get aggregated statistics for Lecturas."""
    return lecturas_service.get_lecturas_stats(
        sector=sector,
        origen=origen,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
    )


@router.get("/sectores", response_model=List[str])
async def get_sectores(
    current_user: User = Depends(get_current_user),
):
    """Get list of unique sectores."""
    return lecturas_service.get_lecturas_sectores()


@router.get("/inspectors", response_model=List[Dict[str, Any]])
async def get_inspectors(
    current_user: User = Depends(get_current_user),
):
    """Get list of inspectors with their stats."""
    return lecturas_service.get_lecturas_inspectors()


@router.get("/hallazgos", response_model=List[str])
async def get_hallazgos(
    current_user: User = Depends(get_current_user),
):
    """Get list of unique hallazgos."""
    return lecturas_service.get_lecturas_hallazgos()


@router.get("/comunas", response_model=List[str])
async def get_comunas(
    current_user: User = Depends(get_current_user),
):
    """Get list of unique comunas."""
    return lecturas_service.get_lecturas_comunas()


@router.get("/export")
async def export_data(
    format: str = Query("csv", description="Formato de exportacion (csv, excel)"),
    search: Optional[str] = None,
    sector: Optional[str] = None,
    inspector: Optional[str] = None,
    hallazgo: Optional[str] = None,
    origen: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    """Export filtered data to CSV or Excel."""
    result = lecturas_service.get_lecturas_filtered_data(
        search=search,
        sector=sector,
        inspector=inspector,
        hallazgo=hallazgo,
        origen=origen,
        page=1,
        limit=100000,
    )

    df = pd.DataFrame(result["items"])

    if df.empty:
        raise HTTPException(status_code=404, detail="No hay datos para exportar")

    if format == "excel":
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Lecturas')
        output.seek(0)

        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": "attachment; filename=lecturas.xlsx"
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
                "Content-Disposition": "attachment; filename=lecturas.csv"
            }
        )
