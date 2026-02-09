from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import date


class MedidorCruzado(BaseModel):
    id: int
    mes: Optional[str] = None
    fecha_correo: Optional[str] = None
    num_cliente: Optional[str] = None
    encargado_enel: Optional[str] = None
    area: Optional[str] = None
    etapa_caso: Optional[str] = None
    fecha_asignacion: Optional[str] = None
    fecha_analisis: Optional[str] = None
    fecha_inspeccion: Optional[str] = None
    direccion: Optional[str] = None
    comuna: Optional[str] = None
    medidor_sistema: Optional[str] = None
    zona: Optional[str] = None
    eett: Optional[str] = None
    observacion_inspector: Optional[str] = None
    estado_medidor: Optional[str] = None
    inspector: Optional[str] = None
    resultado_inspeccion: Optional[str] = None
    eepp_oca: Optional[str] = None


class MedidoresCruzadosFilters(BaseModel):
    search: Optional[str] = None
    zona: Optional[str] = None
    inspector: Optional[str] = None
    estado_medidor: Optional[str] = None
    comuna: Optional[str] = None
    mes: Optional[str] = None
    fecha_desde: Optional[date] = None
    fecha_hasta: Optional[date] = None
    page: int = 1
    limit: int = 50
    sort_by: str = "fecha_inspeccion"
    order: str = "desc"


class MedidoresCruzadosStats(BaseModel):
    total: int
    por_zona: Dict[str, int]
    por_inspector: List[Dict[str, Any]]
    por_estado_medidor: Dict[str, int]
    por_resultado: Dict[str, int]
    por_comuna: List[Dict[str, Any]]
    por_mes: List[Dict[str, Any]]
    por_etapa_caso: Dict[str, int]
    evolucion_mensual: List[Dict[str, Any]]
