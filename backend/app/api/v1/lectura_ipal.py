"""
API endpoints para el modulo de Inspecciones de Seguridad (IPAL).
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from typing import Optional, List, Dict, Any
import pandas as pd
import io
from ...schemas.user import User
from ...services import lectura_ipal_service
from ..deps import get_current_user

router = APIRouter(prefix="/lectura/ipal", tags=["Lecturas - IPAL"])


@router.get("")
async def get_ipal(
    search: Optional[str] = Query(None, description="Buscar por lector, direccion, etc"),
    empresa: Optional[str] = Query(None, description="Filtrar por empresa"),
    inspector: Optional[str] = Query(None, description="Filtrar por inspector"),
    comuna: Optional[str] = Query(None, description="Filtrar por comuna"),
    estado: Optional[str] = Query(None, description="Filtrar por estado"),
    mes: Optional[int] = Query(None, description="Filtrar por mes (1-12)"),
    anio: Optional[int] = Query(None, description="Filtrar por año"),
    page: int = Query(1, ge=1, description="Pagina"),
    limit: int = Query(50, ge=1, le=500, description="Registros por pagina"),
    sort_by: str = Query("fecha", description="Campo para ordenar"),
    order: str = Query("desc", description="Orden (asc/desc)"),
    current_user: User = Depends(get_current_user),
):
    """Get paginated list of IPAL inspections."""
    return await lectura_ipal_service.get_ipal_filtered_data(
        search=search,
        empresa=empresa,
        inspector=inspector,
        comuna=comuna,
        estado=estado,
        mes=mes,
        anio=anio,
        page=page,
        limit=limit,
        sort_by=sort_by,
        order=order,
    )


@router.get("/stats")
async def get_stats(
    empresa: Optional[str] = Query(None, description="Filtrar por empresa"),
    inspector: Optional[str] = Query(None, description="Filtrar por inspector"),
    comuna: Optional[str] = Query(None, description="Filtrar por comuna"),
    mes: Optional[int] = Query(None, description="Filtrar por mes (1-12)"),
    anio: Optional[int] = Query(None, description="Filtrar por año"),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get aggregated statistics for IPAL inspections."""
    return await lectura_ipal_service.get_ipal_stats(
        empresa=empresa,
        inspector=inspector,
        comuna=comuna,
        mes=mes,
        anio=anio,
    )


@router.get("/empresas", response_model=List[str])
async def get_empresas(
    current_user: User = Depends(get_current_user),
):
    """Get list of unique empresas."""
    return await lectura_ipal_service.get_ipal_empresas()


@router.get("/inspectores", response_model=List[Dict[str, Any]])
async def get_inspectores(
    current_user: User = Depends(get_current_user),
):
    """Get list of inspectors with stats."""
    return await lectura_ipal_service.get_ipal_inspectores()


@router.get("/comunas", response_model=List[str])
async def get_comunas(
    current_user: User = Depends(get_current_user),
):
    """Get list of unique comunas."""
    return await lectura_ipal_service.get_ipal_comunas()


@router.get("/periodos")
async def get_periodos(
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get available months and years."""
    return await lectura_ipal_service.get_ipal_periodos()


@router.get("/export")
async def export_data(
    format: str = Query("csv", description="Formato de exportacion (csv, excel)"),
    search: Optional[str] = None,
    empresa: Optional[str] = None,
    inspector: Optional[str] = None,
    comuna: Optional[str] = None,
    estado: Optional[str] = None,
    mes: Optional[int] = None,
    anio: Optional[int] = None,
    current_user: User = Depends(get_current_user),
):
    """Export filtered data to CSV or Excel."""
    result = await lectura_ipal_service.get_ipal_filtered_data(
        search=search,
        empresa=empresa,
        inspector=inspector,
        comuna=comuna,
        estado=estado,
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
            df.to_excel(writer, sheet_name='IPAL Inspecciones', index=False)
        output.seek(0)

        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": "attachment; filename=ipal_inspecciones.xlsx"
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
                "Content-Disposition": "attachment; filename=ipal_inspecciones.csv"
            }
        )
