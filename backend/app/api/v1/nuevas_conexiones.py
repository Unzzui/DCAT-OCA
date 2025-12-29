from fastapi import APIRouter, Depends, Query, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from typing import Optional, List, Dict, Any
import pandas as pd
import io
from ...schemas.user import User
from ...schemas.nuevas_conexiones import PaginatedResponse, InspeccionesStats
from ...services import data_service
from ...utils.excel_formatter import create_formatted_excel, get_column_config_nncc
from ..deps import get_current_user, require_editor

router = APIRouter(prefix="/nuevas-conexiones", tags=["Informe NNCC"])


@router.get("", response_model=PaginatedResponse)
async def get_inspecciones(
    search: Optional[str] = Query(None, description="Buscar por cliente, comuna, inspector, etc"),
    zona: Optional[str] = Query(None, description="Filtrar por zona"),
    inspector: Optional[str] = Query(None, description="Filtrar por inspector"),
    estado: Optional[str] = Query(None, description="Filtrar por estado efectividad"),
    comuna: Optional[str] = Query(None, description="Filtrar por comuna"),
    base: Optional[str] = Query(None, description="Filtrar por base"),
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
    return data_service.get_filtered_data(
        search=search,
        zona=zona,
        inspector=inspector,
        estado=estado,
        comuna=comuna,
        base=base,
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
    return data_service.get_stats(
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
    return data_service.get_comunas()


@router.get("/zonas", response_model=List[str])
async def get_zonas(
    current_user: User = Depends(get_current_user),
):
    """Get list of unique zonas."""
    return data_service.get_zonas()


@router.get("/inspectors", response_model=List[Dict[str, Any]])
async def get_inspectors(
    current_user: User = Depends(get_current_user),
):
    """Get list of inspectors with their stats."""
    return data_service.get_inspectors()


@router.get("/bases", response_model=List[str])
async def get_bases(
    current_user: User = Depends(get_current_user),
):
    """Get list of unique bases."""
    return data_service.get_bases()


@router.get("/periodos")
async def get_periodos(
    current_user: User = Depends(get_current_user),
) -> Dict[str, List[int]]:
    """Get available months and years."""
    return data_service.get_periodos()


@router.get("/export")
async def export_data(
    format: str = Query("csv", description="Formato de exportacion (csv, excel)"),
    search: Optional[str] = None,
    zona: Optional[str] = None,
    inspector: Optional[str] = None,
    estado: Optional[str] = None,
    base: Optional[str] = None,
    fecha_desde: Optional[str] = Query(None, description="Fecha desde (YYYY-MM-DD)"),
    fecha_hasta: Optional[str] = Query(None, description="Fecha hasta (YYYY-MM-DD)"),
    mes: Optional[int] = Query(None, description="Filtrar por mes (1-12)"),
    anio: Optional[int] = Query(None, description="Filtrar por año"),
    current_user: User = Depends(get_current_user),
):
    """Export filtered data to CSV or Excel."""
    # Get all filtered data (no pagination for export)
    result = data_service.get_filtered_data(
        search=search,
        zona=zona,
        inspector=inspector,
        estado=estado,
        base=base,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        mes=mes,
        anio=anio,
        page=1,
        limit=100000,  # Large limit for export
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


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(require_editor),
):
    """Upload Excel/CSV file to update data (editor or admin only)."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No se proporciono archivo")

    allowed_extensions = ['.csv', '.xlsx', '.xls']
    file_ext = '.' + file.filename.split('.')[-1].lower()

    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Formato no soportado. Use: {', '.join(allowed_extensions)}"
        )

    try:
        contents = await file.read()

        if file_ext == '.csv':
            df = pd.read_csv(io.BytesIO(contents))
        else:
            df = pd.read_excel(io.BytesIO(contents))

        # Reload data cache
        data_service.load_data(force_reload=True)

        return {
            "message": "Archivo procesado exitosamente",
            "filename": file.filename,
            "rows": len(df),
            "columns": len(df.columns)
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al procesar archivo: {str(e)}"
        )
