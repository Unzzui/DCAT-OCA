"""
API endpoints para el modulo de Correos/Inspecciones Especiales.
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from typing import Optional, List, Dict, Any
import pandas as pd
import io
from ...schemas.user import User
from ...services import lectura_correos_service
from ..deps import get_current_user

router = APIRouter(prefix="/lectura/correos", tags=["Lecturas - Correos"])


@router.get("")
async def get_correos(
    search: Optional[str] = Query(None, description="Buscar por cliente, reclamo, etc"),
    fuente: Optional[str] = Query(None, description="Filtrar por fuente (ENEL/COLINA)"),
    inspector: Optional[str] = Query(None, description="Filtrar por inspector"),
    comuna: Optional[str] = Query(None, description="Filtrar por comuna"),
    gestion: Optional[str] = Query(None, description="Filtrar por gestion"),
    mes: Optional[int] = Query(None, description="Filtrar por mes (1-12)"),
    anio: Optional[int] = Query(None, description="Filtrar por año"),
    page: int = Query(1, ge=1, description="Pagina"),
    limit: int = Query(50, ge=1, le=500, description="Registros por pagina"),
    sort_by: str = Query("fecha_recepcion", description="Campo para ordenar"),
    order: str = Query("desc", description="Orden (asc/desc)"),
    current_user: User = Depends(get_current_user),
):
    """Get paginated list of correos/inspecciones."""
    return await lectura_correos_service.get_correos_filtered_data(
        search=search,
        fuente=fuente,
        inspector=inspector,
        comuna=comuna,
        gestion=gestion,
        mes=mes,
        anio=anio,
        page=page,
        limit=limit,
        sort_by=sort_by,
        order=order,
    )


@router.get("/stats")
async def get_stats(
    fuente: Optional[str] = Query(None, description="Filtrar por fuente (ENEL/COLINA)"),
    inspector: Optional[str] = Query(None, description="Filtrar por inspector"),
    comuna: Optional[str] = Query(None, description="Filtrar por comuna"),
    mes: Optional[int] = Query(None, description="Filtrar por mes (1-12)"),
    anio: Optional[int] = Query(None, description="Filtrar por año"),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get aggregated statistics for correos/inspecciones."""
    return await lectura_correos_service.get_correos_stats(
        fuente=fuente,
        inspector=inspector,
        comuna=comuna,
        mes=mes,
        anio=anio,
    )


@router.get("/fuentes", response_model=List[str])
async def get_fuentes(
    current_user: User = Depends(get_current_user),
):
    """Get list of unique fuentes."""
    return await lectura_correos_service.get_correos_fuentes()


@router.get("/inspectores", response_model=List[Dict[str, Any]])
async def get_inspectores(
    current_user: User = Depends(get_current_user),
):
    """Get list of inspectors with stats."""
    return await lectura_correos_service.get_correos_inspectores()


@router.get("/comunas", response_model=List[str])
async def get_comunas(
    current_user: User = Depends(get_current_user),
):
    """Get list of unique comunas."""
    return await lectura_correos_service.get_correos_comunas()


@router.get("/periodos")
async def get_periodos(
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get available months and years."""
    return await lectura_correos_service.get_correos_periodos()


@router.get("/export")
async def export_data(
    format: str = Query("csv", description="Formato de exportacion (csv, excel)"),
    search: Optional[str] = None,
    fuente: Optional[str] = None,
    inspector: Optional[str] = None,
    comuna: Optional[str] = None,
    gestion: Optional[str] = None,
    mes: Optional[int] = None,
    anio: Optional[int] = None,
    current_user: User = Depends(get_current_user),
):
    """Export filtered data to CSV or Excel."""
    result = await lectura_correos_service.get_correos_filtered_data(
        search=search,
        fuente=fuente,
        inspector=inspector,
        comuna=comuna,
        gestion=gestion,
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
            df.to_excel(writer, sheet_name='Correos', index=False)
        output.seek(0)

        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": "attachment; filename=inspecciones_correos.xlsx"
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
                "Content-Disposition": "attachment; filename=inspecciones_correos.csv"
            }
        )
