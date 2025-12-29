"""
API endpoints para el modulo de Corte y Reposicion.
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from typing import Optional, List, Dict, Any
import pandas as pd
import io
from ...schemas.user import User
from ...services import corte_service
from ...utils.excel_formatter import create_formatted_excel, get_column_config_corte
from ..deps import get_current_user

router = APIRouter(prefix="/corte", tags=["Corte y Reposicion"])


@router.get("")
async def get_corte(
    search: Optional[str] = Query(None, description="Buscar por suministro, nombre, medidor, etc"),
    zona: Optional[str] = Query(None, description="Filtrar por zona"),
    centro_operativo: Optional[str] = Query(None, description="Filtrar por centro operativo"),
    comuna: Optional[str] = Query(None, description="Filtrar por comuna"),
    inspector: Optional[str] = Query(None, description="Filtrar por inspector"),
    situacion_encontrada: Optional[str] = Query(None, description="Filtrar por situacion encontrada"),
    motivo_multa: Optional[str] = Query(None, description="Filtrar por motivo multa"),
    mes: Optional[int] = Query(None, description="Filtrar por mes (1-12)"),
    anio: Optional[int] = Query(None, description="Filtrar por anio"),
    page: int = Query(1, ge=1, description="Pagina"),
    limit: int = Query(50, ge=1, le=500, description="Registros por pagina"),
    sort_by: str = Query("id", description="Campo para ordenar"),
    order: str = Query("desc", description="Orden (asc/desc)"),
    current_user: User = Depends(get_current_user),
):
    """Get paginated list of Corte y Reposicion inspections."""
    return corte_service.get_corte_filtered_data(
        search=search,
        zona=zona,
        centro_operativo=centro_operativo,
        comuna=comuna,
        inspector=inspector,
        situacion_encontrada=situacion_encontrada,
        motivo_multa=motivo_multa,
        mes=mes,
        anio=anio,
        page=page,
        limit=limit,
        sort_by=sort_by,
        order=order,
    )


@router.get("/stats")
async def get_stats(
    zona: Optional[str] = Query(None, description="Filtrar por zona"),
    centro_operativo: Optional[str] = Query(None, description="Filtrar por centro operativo"),
    comuna: Optional[str] = Query(None, description="Filtrar por comuna"),
    inspector: Optional[str] = Query(None, description="Filtrar por inspector"),
    mes: Optional[int] = Query(None, description="Filtrar por mes (1-12)"),
    anio: Optional[int] = Query(None, description="Filtrar por anio"),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get aggregated statistics for Corte y Reposicion."""
    return corte_service.get_corte_stats(
        zona=zona,
        centro_operativo=centro_operativo,
        comuna=comuna,
        inspector=inspector,
        mes=mes,
        anio=anio,
    )


@router.get("/zonas", response_model=List[str])
async def get_zonas(
    current_user: User = Depends(get_current_user),
):
    """Get list of unique zonas."""
    return corte_service.get_corte_zonas()


@router.get("/centros-operativos", response_model=List[str])
async def get_centros_operativos(
    current_user: User = Depends(get_current_user),
):
    """Get list of unique centros operativos."""
    return corte_service.get_corte_centros_operativos()


@router.get("/comunas", response_model=List[str])
async def get_comunas(
    current_user: User = Depends(get_current_user),
):
    """Get list of unique comunas."""
    return corte_service.get_corte_comunas()


@router.get("/inspectores", response_model=List[Dict[str, Any]])
async def get_inspectores(
    current_user: User = Depends(get_current_user),
):
    """Get list of inspectors with their stats."""
    return corte_service.get_corte_inspectores()


@router.get("/situaciones", response_model=List[str])
async def get_situaciones(
    current_user: User = Depends(get_current_user),
):
    """Get list of unique situacion_encontrada values."""
    return corte_service.get_corte_situaciones()


@router.get("/periodos")
async def get_periodos(
    current_user: User = Depends(get_current_user),
) -> Dict[str, List[int]]:
    """Get available months and years."""
    return corte_service.get_corte_periodos()


@router.get("/evolucion")
async def get_evolucion(
    zona: Optional[str] = Query(None, description="Filtrar por zona"),
    centro_operativo: Optional[str] = Query(None, description="Filtrar por centro operativo"),
    current_user: User = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    """Get monthly evolution of corte metrics."""
    return corte_service.get_corte_evolucion(
        zona=zona,
        centro_operativo=centro_operativo,
    )


@router.get("/export")
async def export_data(
    format: str = Query("csv", description="Formato de exportacion (csv, excel)"),
    search: Optional[str] = None,
    zona: Optional[str] = None,
    centro_operativo: Optional[str] = None,
    comuna: Optional[str] = None,
    inspector: Optional[str] = None,
    situacion_encontrada: Optional[str] = None,
    motivo_multa: Optional[str] = None,
    mes: Optional[int] = None,
    anio: Optional[int] = None,
    current_user: User = Depends(get_current_user),
):
    """Export filtered data to CSV or Excel."""
    result = corte_service.get_corte_filtered_data(
        search=search,
        zona=zona,
        centro_operativo=centro_operativo,
        comuna=comuna,
        inspector=inspector,
        situacion_encontrada=situacion_encontrada,
        motivo_multa=motivo_multa,
        mes=mes,
        anio=anio,
        page=1,
        limit=100000,
    )

    df = pd.DataFrame(result["items"])

    if df.empty:
        raise HTTPException(status_code=404, detail="No hay datos para exportar")

    if format == "excel":
        output = create_formatted_excel(
            df=df,
            sheet_name="Corte y Reposicion",
            title="Informe de Corte y Reposición",
            column_config=get_column_config_corte()
        )

        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": "attachment; filename=corte_reposicion.xlsx"
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
                "Content-Disposition": "attachment; filename=corte_reposicion.csv"
            }
        )
