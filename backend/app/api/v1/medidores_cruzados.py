from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from typing import Optional, List, Dict, Any
import pandas as pd
import io
from ...schemas.user import User
from ...schemas.nuevas_conexiones import PaginatedResponse
from ...services import medidores_cruzados_service
from ...utils.excel_formatter import create_formatted_excel, get_column_config_medidores_cruzados
from ..deps import get_current_user

router = APIRouter(prefix="/medidores-cruzados", tags=["Medidores Cruzados"])


@router.get("", response_model=PaginatedResponse)
async def get_medidores_cruzados(
    search: Optional[str] = Query(None, description="Buscar por cliente, comuna, inspector, etc"),
    zona: Optional[str] = Query(None, description="Filtrar por zona"),
    inspector: Optional[str] = Query(None, description="Filtrar por inspector"),
    estado_medidor: Optional[str] = Query(None, description="Filtrar por estado medidor"),
    comuna: Optional[str] = Query(None, description="Filtrar por comuna"),
    mes: Optional[str] = Query(None, description="Filtrar por mes (ENERO, FEBRERO, etc)"),
    anio: Optional[str] = Query(None, description="Filtrar por año"),
    fecha_desde: Optional[str] = Query(None, description="Fecha desde (YYYY-MM-DD)"),
    fecha_hasta: Optional[str] = Query(None, description="Fecha hasta (YYYY-MM-DD)"),
    page: int = Query(1, ge=1, description="Pagina"),
    limit: int = Query(50, ge=1, le=500, description="Registros por pagina"),
    sort_by: str = Query("fecha_inspeccion", description="Campo para ordenar"),
    order: str = Query("desc", description="Orden (asc/desc)"),
    current_user: User = Depends(get_current_user),
):
    return await medidores_cruzados_service.get_filtered_data(
        search=search,
        zona=zona,
        inspector=inspector,
        estado_medidor=estado_medidor,
        comuna=comuna,
        mes=mes,
        anio=anio,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        page=page,
        limit=limit,
        sort_by=sort_by,
        order=order,
    )


@router.get("/stats")
async def get_stats(
    zona: Optional[str] = Query(None, description="Filtrar por zona"),
    mes: Optional[str] = Query(None, description="Filtrar por mes"),
    anio: Optional[str] = Query(None, description="Filtrar por año"),
    comuna: Optional[str] = Query(None, description="Filtrar por comuna"),
    estado_medidor: Optional[str] = Query(None, description="Filtrar por estado medidor"),
    fecha_desde: Optional[str] = Query(None, description="Fecha desde (YYYY-MM-DD)"),
    fecha_hasta: Optional[str] = Query(None, description="Fecha hasta (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    return await medidores_cruzados_service.get_stats(
        zona=zona,
        mes=mes,
        anio=anio,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
    )


@router.get("/comunas", response_model=List[str])
async def get_comunas(
    current_user: User = Depends(get_current_user),
):
    return await medidores_cruzados_service.get_comunas()


@router.get("/zonas", response_model=List[str])
async def get_zonas(
    current_user: User = Depends(get_current_user),
):
    return await medidores_cruzados_service.get_zonas()


@router.get("/inspectors", response_model=List[Dict[str, Any]])
async def get_inspectors(
    current_user: User = Depends(get_current_user),
):
    return await medidores_cruzados_service.get_inspectors()


@router.get("/estados-medidor", response_model=List[str])
async def get_estados_medidor(
    current_user: User = Depends(get_current_user),
):
    return await medidores_cruzados_service.get_estados_medidor()


@router.get("/periodos")
async def get_periodos(
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    return await medidores_cruzados_service.get_periodos()


@router.get("/analisis-operacional")
async def get_analisis_operacional(
    zona: Optional[str] = Query(None, description="Filtrar por zona"),
    mes: Optional[str] = Query(None, description="Filtrar por mes"),
    anio: Optional[str] = Query(None, description="Filtrar por año"),
    fecha_desde: Optional[str] = Query(None, description="Fecha desde (YYYY-MM-DD)"),
    fecha_hasta: Optional[str] = Query(None, description="Fecha hasta (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get operational analysis: processing times, bottlenecks, poor executions."""
    return await medidores_cruzados_service.get_medidores_analisis_operacional(
        zona=zona,
        mes=mes,
        anio=anio,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
    )


@router.get("/export")
async def export_data(
    format: str = Query("csv", description="Formato de exportacion (csv, excel)"),
    search: Optional[str] = None,
    zona: Optional[str] = None,
    inspector: Optional[str] = None,
    estado_medidor: Optional[str] = None,
    comuna: Optional[str] = None,
    mes: Optional[str] = None,
    anio: Optional[str] = None,
    fecha_desde: Optional[str] = Query(None, description="Fecha desde (YYYY-MM-DD)"),
    fecha_hasta: Optional[str] = Query(None, description="Fecha hasta (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_user),
):
    result = await medidores_cruzados_service.get_filtered_data(
        search=search,
        zona=zona,
        inspector=inspector,
        estado_medidor=estado_medidor,
        comuna=comuna,
        mes=mes,
        anio=anio,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        page=1,
        limit=100000,
    )

    df = pd.DataFrame(result["items"])

    if df.empty:
        raise HTTPException(status_code=404, detail="No hay datos para exportar")

    if format == "excel":
        output = create_formatted_excel(
            df=df,
            sheet_name="Medidores Cruzados",
            title="Informe de Medidores Cruzados",
            column_config=get_column_config_medidores_cruzados()
        )

        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": "attachment; filename=informe_medidores_cruzados.xlsx"
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
                "Content-Disposition": "attachment; filename=informe_medidores_cruzados.csv"
            }
        )
