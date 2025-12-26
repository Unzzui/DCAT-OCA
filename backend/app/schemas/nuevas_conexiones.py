from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import date


class InspeccionNNCC(BaseModel):
    """Modelo para una inspección NNCC."""
    id: int
    vta: Optional[str] = None
    cliente: Optional[str] = None
    nombre_cliente: Optional[str] = None
    direccion: Optional[str] = None
    comuna: Optional[str] = None
    tarifa: Optional[str] = None
    zona: Optional[str] = None
    base: Optional[str] = None
    n_medidor: Optional[str] = None
    estado_efectividad: Optional[str] = None
    resultado_inspeccion: Optional[str] = None
    multa: Optional[str] = None
    observaciones_multa: Optional[str] = None
    fecha_inspeccion: Optional[date] = None
    inspector: Optional[str] = None
    estado_contratista: Optional[str] = None
    resultado_normalizacion: Optional[str] = None
    cumple_norma_cc: Optional[str] = None
    cliente_conforme: Optional[str] = None
    estado_empalme: Optional[str] = None


class InspeccionesFilters(BaseModel):
    """Filtros para inspecciones NNCC."""
    fecha_desde: Optional[date] = None
    fecha_hasta: Optional[date] = None
    zona: Optional[str] = None
    inspector: Optional[str] = None
    estado: Optional[str] = None
    comuna: Optional[str] = None
    base: Optional[str] = None
    search: Optional[str] = None
    page: int = 1
    limit: int = 50
    sort_by: str = "fecha_inspeccion"
    order: str = "desc"


class PaginatedResponse(BaseModel):
    """Respuesta paginada."""
    items: List[Dict[str, Any]]
    total: int
    page: int
    limit: int
    pages: int


class InspectorStats(BaseModel):
    """Estadísticas de un inspector."""
    inspector: str
    cantidad: int
    efectividad: float


class InspeccionesStats(BaseModel):
    """Estadísticas agregadas de inspecciones NNCC."""
    total: int
    efectivas: int
    no_efectivas: int
    bien_ejecutados: int
    mal_ejecutados: int
    tasa_efectividad: float
    por_zona: Dict[str, int]
    por_inspector: List[InspectorStats]
    por_mes: List[Dict[str, Any]]
    con_multa: int
    pendientes_normalizar: int


# Aliases para compatibilidad (deprecado)
NuevaConexion = InspeccionNNCC
NuevasConexionesFilters = InspeccionesFilters
NuevasConexionesStats = InspeccionesStats
