from fastapi import APIRouter, Depends, Query, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from typing import Optional, List, Dict, Any
import pandas as pd
import io
from ...schemas.user import User
from ...schemas.nuevas_conexiones import PaginatedResponse, InspeccionesStats
from ...services import data_service
from ...services import nncc_dashboard_service
from ...services import odis_service
from ...utils.excel_formatter import create_formatted_excel, get_column_config_nncc
from ..deps import get_current_user, require_editor

router = APIRouter(prefix="/nuevas-conexiones", tags=["Informe NNCC"])


# ============= Dashboard endpoints (pre-calculated stats) =============

@router.get("/dashboard/overview")
async def get_dashboard_overview(
    base: Optional[str] = Query(None, description="Filtrar por base/periodo"),
    current_user: User = Depends(get_current_user),
):
    """Page A: Executive Quality Overview - KPIs, trends, zone results, top comunas."""
    return await nncc_dashboard_service.get_overview(base)


@router.get("/dashboard/contratistas")
async def get_dashboard_contratistas(
    base: Optional[str] = Query(None, description="Filtrar por base/periodo"),
    current_user: User = Depends(get_current_user),
):
    """Page B: Contractor ranking and scatter data."""
    return await nncc_dashboard_service.get_contratistas(base)


@router.get("/dashboard/causas")
async def get_dashboard_causas(
    base: Optional[str] = Query(None, description="Filtrar por base/periodo"),
    current_user: User = Depends(get_current_user),
):
    """Page C: Pareto of causes, typical failures, zone breakdowns."""
    return await nncc_dashboard_service.get_causas(base)


@router.get("/dashboard/bases")
async def get_dashboard_bases(
    current_user: User = Depends(get_current_user),
):
    """List of bases with pre-calculated stats available."""
    return await nncc_dashboard_service.get_available_bases()


@router.get("/dashboard/all")
async def get_dashboard_all(
    base: Optional[str] = Query(None, description="Filtrar por base/periodo"),
    current_user: User = Depends(get_current_user),
):
    """All pre-calculated dashboard data in a single request (except mapa)."""
    return await nncc_dashboard_service.get_all_dashboard(base)


@router.get("/dashboard/mapa")
async def get_dashboard_mapa(
    base: Optional[str] = Query(None, description="Filtrar por base/periodo"),
    current_user: User = Depends(get_current_user),
):
    """Map points with coordinates for geographic visualization."""
    return await nncc_dashboard_service.get_mapa(base)


@router.get("/dashboard/kpi-modals")
async def get_dashboard_kpi_modals(
    base: Optional[str] = Query(None, description="Filtrar por base/periodo"),
    current_user: User = Depends(get_current_user),
):
    """KPI drill-down modal data."""
    return await nncc_dashboard_service.get_kpi_modals(base)


@router.get("/dashboard/mal-ejecutados")
async def get_dashboard_mal_ejecutados(
    base: Optional[str] = Query(None, description="Filtrar por base/periodo"),
    current_user: User = Depends(get_current_user),
):
    """Mal ejecutados detailed analysis: causes, by zona, by contratista."""
    return await nncc_dashboard_service.get_mal_ejecutados(base)


@router.get("/dashboard/ejecucion-stats")
async def get_dashboard_ejecucion_stats(
    base: Optional[str] = Query(None, description="Base/periodo"),
    current_user: User = Depends(get_current_user),
):
    """Execution timing stats: days elapsed, projection, avg daily rate."""
    return await nncc_dashboard_service.get_ejecucion_stats(base)


# ============= Data endpoints =============

@router.get("", response_model=PaginatedResponse)
async def get_inspecciones(
    search: Optional[str] = Query(None, description="Buscar por cliente, comuna, inspector, etc"),
    zona: Optional[str] = Query(None, description="Filtrar por zona"),
    inspector: Optional[str] = Query(None, description="Filtrar por inspector"),
    estado: Optional[str] = Query(None, description="Filtrar por estado efectividad"),
    comuna: Optional[str] = Query(None, description="Filtrar por comuna"),
    base: Optional[str] = Query(None, description="Filtrar por base"),
    contratista: Optional[str] = Query(None, description="Filtrar por contratista ENEL"),
    resultado: Optional[str] = Query(None, description="Filtrar por resultado inspeccion"),
    fecha_desde: Optional[str] = Query(None, description="Fecha desde (YYYY-MM-DD)"),
    fecha_hasta: Optional[str] = Query(None, description="Fecha hasta (YYYY-MM-DD)"),
    mes: Optional[int] = Query(None, description="Filtrar por mes (1-12)"),
    anio: Optional[int] = Query(None, description="Filtrar por año"),
    page: int = Query(1, ge=1, description="Pagina"),
    limit: int = Query(50, ge=1, le=500, description="Registros por pagina"),
    sort_by: str = Query("fecha_inspeccion", description="Campo para ordenar"),
    order: str = Query("desc", description="Orden (asc/desc)"),
    current_user: User = Depends(get_current_user),
):
    """Get paginated list of NNCC inspections with filters."""
    return await data_service.get_filtered_data(
        search=search,
        zona=zona,
        inspector=inspector,
        estado=estado,
        comuna=comuna,
        base=base,
        contratista=contratista,
        resultado=resultado,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
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
    base: Optional[str] = Query(None, description="Filtrar por base/periodo"),
    fecha_desde: Optional[str] = Query(None, description="Fecha desde (YYYY-MM-DD)"),
    fecha_hasta: Optional[str] = Query(None, description="Fecha hasta (YYYY-MM-DD)"),
    mes: Optional[int] = Query(None, description="Filtrar por mes (1-12)"),
    anio: Optional[int] = Query(None, description="Filtrar por año"),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get aggregated statistics for NNCC inspections with optional filters."""
    return await data_service.get_stats(
        zona=zona,
        base=base,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        mes=mes,
        anio=anio,
    )


@router.get("/comunas", response_model=List[str])
async def get_comunas(
    current_user: User = Depends(get_current_user),
):
    """Get list of unique comunas."""
    return await data_service.get_comunas()


@router.get("/zonas", response_model=List[str])
async def get_zonas(
    current_user: User = Depends(get_current_user),
):
    """Get list of unique zonas."""
    return await data_service.get_zonas()


@router.get("/inspectors", response_model=List[Dict[str, Any]])
async def get_inspectors(
    current_user: User = Depends(get_current_user),
):
    """Get list of inspectors with their stats."""
    return await data_service.get_inspectors()


@router.get("/bases", response_model=List[str])
async def get_bases(
    current_user: User = Depends(get_current_user),
):
    """Get list of unique bases."""
    return await data_service.get_bases()


@router.get("/periodos")
async def get_periodos(
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get available months and years."""
    return await data_service.get_periodos()


@router.get("/export")
async def export_data(
    format: str = Query("csv", description="Formato de exportacion (csv, excel)"),
    search: Optional[str] = None,
    zona: Optional[str] = None,
    inspector: Optional[str] = None,
    estado: Optional[str] = None,
    base: Optional[str] = None,
    contratista: Optional[str] = Query(None, description="Filtrar por contratista ENEL"),
    resultado: Optional[str] = Query(None, description="Filtrar por resultado inspeccion"),
    fecha_desde: Optional[str] = Query(None, description="Fecha desde (YYYY-MM-DD)"),
    fecha_hasta: Optional[str] = Query(None, description="Fecha hasta (YYYY-MM-DD)"),
    mes: Optional[int] = Query(None, description="Filtrar por mes (1-12)"),
    anio: Optional[int] = Query(None, description="Filtrar por año"),
    current_user: User = Depends(get_current_user),
):
    """Export filtered data to CSV or Excel."""
    result = await data_service.get_filtered_data(
        search=search,
        zona=zona,
        inspector=inspector,
        estado=estado,
        base=base,
        contratista=contratista,
        resultado=resultado,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
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
            sheet_name="Informe NNCC",
            title="Informe de Nuevas Conexiones",
            column_config=get_column_config_nncc()
        )

        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": "attachment; filename=informe_nncc.xlsx"
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
                "Content-Disposition": "attachment; filename=informe_nncc.csv"
            }
        )


# ============= ODIS images =============

@router.get("/imagenes/{order_id}")
async def get_imagenes(
    order_id: int,
    current_user: User = Depends(get_current_user),
):
    """Proxy to ODIS API to fetch inspection photos as base64."""
    try:
        fotos = await odis_service.obtener_imagenes(order_id)
        return fotos
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error consultando ODIS: {str(e)}")
