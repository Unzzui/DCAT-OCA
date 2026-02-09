from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, Text, Index, Date, JSON
from sqlalchemy.sql import func
from .base import Base

# Módulos disponibles por defecto
DEFAULT_MODULES = [
    "dashboard",
    "nuevas-conexiones",
    "lecturas",
    "telecomunicaciones",
    "corte-reposicion",
    "control-perdidas",
]


def get_default_modules():
    """Return a copy of default modules (callable for SQLAlchemy default)."""
    return DEFAULT_MODULES.copy()


class UserModel(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    full_name = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="viewer")
    is_active = Column(Boolean, default=True)
    allowed_modules = Column(JSON, nullable=True, default=get_default_modules)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)


class NNCCModel(Base):
    __tablename__ = "nncc"

    id = Column(Integer, primary_key=True, autoincrement=True)
    vta = Column(String(50), nullable=True)
    cliente = Column(String(50), nullable=True)
    nombre_cliente = Column(String(255), nullable=True)
    direccion = Column(Text, nullable=True)
    comuna = Column(String(100), nullable=True, index=True)
    tarifa = Column(String(50), nullable=True)
    zona = Column(String(50), nullable=True, index=True)
    base = Column(String(50), nullable=True)
    n_medidor = Column(String(50), nullable=True)
    estado_efectividad = Column(String(100), nullable=True, index=True)
    resultado_inspeccion = Column(String(100), nullable=True)
    multa = Column(String(10), nullable=True)
    observaciones_multa = Column(Text, nullable=True)
    fecha_inspeccion = Column(DateTime, nullable=True, index=True)
    inspector = Column(String(100), nullable=True, index=True)
    estado_contratista = Column(String(100), nullable=True)
    resultado_normalizacion = Column(String(100), nullable=True)
    cumple_norma_cc = Column(String(100), nullable=True)
    cliente_conforme = Column(String(100), nullable=True)
    estado_empalme = Column(String(100), nullable=True)
    tipo_inspeccion = Column(String(100), nullable=True)
    voltaje = Column(String(50), nullable=True)
    mes = Column(Integer, nullable=True)
    anio = Column(Integer, nullable=True)
    link_formulario = Column(Text, nullable=True)


class MedidoresCruzadosModel(Base):
    __tablename__ = "medidores_cruzados"

    id = Column(Integer, primary_key=True, autoincrement=True)
    mes = Column(String(50), nullable=True)
    fecha_correo = Column(DateTime, nullable=True)
    num_cliente = Column(String(50), nullable=True)
    encargado_enel = Column(String(255), nullable=True)
    area = Column(String(100), nullable=True)
    etapa_caso = Column(String(100), nullable=True)
    fecha_asignacion = Column(DateTime, nullable=True)
    fecha_analisis = Column(DateTime, nullable=True)
    fecha_inspeccion = Column(DateTime, nullable=True, index=True)
    direccion = Column(Text, nullable=True)
    comuna = Column(String(100), nullable=True, index=True)
    medidor_sistema = Column(String(50), nullable=True)
    zona = Column(String(50), nullable=True, index=True)
    eett = Column(String(50), nullable=True)
    observacion_inspector = Column(Text, nullable=True)
    estado_medidor = Column(String(100), nullable=True, index=True)
    inspector = Column(String(100), nullable=True, index=True)
    resultado_inspeccion = Column(String(100), nullable=True)
    eepp_oca = Column(String(100), nullable=True)


class CalidadMonoBaseModel(Base):
    __tablename__ = "calidad_mono_base"

    id = Column(Integer, primary_key=True, autoincrement=True)
    incidencia = Column(String(100), nullable=True)
    inspector = Column(String(100), nullable=True, index=True)
    servicio = Column(String(100), nullable=True)
    tipo_servicio = Column(String(100), nullable=True)
    cliente = Column(String(50), nullable=True)
    nombre_cliente = Column(String(255), nullable=True)
    direccion = Column(Text, nullable=True)
    comuna = Column(String(100), nullable=True, index=True)
    latitud = Column(Float, nullable=True)
    longitud = Column(Float, nullable=True)
    medidor = Column(String(50), nullable=True)
    tarifa = Column(String(50), nullable=True)
    constante = Column(String(50), nullable=True)
    red = Column(String(50), nullable=True)
    estado_suministro = Column(String(100), nullable=True)
    contratista = Column(String(100), nullable=True)
    tipo_resultado = Column(String(100), nullable=True)
    estado_propiedad = Column(String(100), nullable=True)
    requiere_normalizacion = Column(String(50), nullable=True)
    requiere_trabajo = Column(String(50), nullable=True)
    notificacion = Column(String(100), nullable=True)
    voltaje = Column(String(50), nullable=True)
    amperaje = Column(String(50), nullable=True)
    error_porcentaje = Column(Float, nullable=True)
    kc = Column(String(50), nullable=True)
    estado_acometida = Column(String(100), nullable=True)
    estado_caja = Column(String(100), nullable=True)
    estado_tapa = Column(String(100), nullable=True)
    perno_encontrado = Column(String(100), nullable=True)
    perno_normalizado = Column(String(100), nullable=True)
    giro = Column(String(100), nullable=True)
    modelo_corresponde = Column(String(50), nullable=True)
    medidor_corresponde = Column(String(50), nullable=True)
    fecha_inspeccion = Column(DateTime, nullable=True)
    tipo_sistema = Column(String(50), nullable=True)
    mes = Column(Integer, nullable=True)
    anio = Column(Integer, nullable=True)
    mes_origen = Column(String(50), nullable=True)


class CalidadMonoInspeccionesModel(Base):
    __tablename__ = "calidad_mono_inspecciones"

    id = Column(Integer, primary_key=True, autoincrement=True)
    incidencia = Column(String(100), nullable=True)
    inspector = Column(String(100), nullable=True, index=True)
    servicio = Column(String(100), nullable=True)
    cliente = Column(String(50), nullable=True)
    nombre_cliente = Column(String(255), nullable=True)
    direccion = Column(Text, nullable=True)
    comuna = Column(String(100), nullable=True, index=True)
    medidor = Column(String(50), nullable=True)
    contratista = Column(String(100), nullable=True)
    tipo_resultado = Column(String(100), nullable=True)
    fecha_inspeccion = Column(DateTime, nullable=True)
    tipo_sistema = Column(String(50), nullable=True)
    mes = Column(Integer, nullable=True)
    anio = Column(Integer, nullable=True)
    mes_origen = Column(String(50), nullable=True)


class CalidadTriBaseModel(Base):
    __tablename__ = "calidad_tri_base"

    id = Column(Integer, primary_key=True, autoincrement=True)
    incidencia = Column(String(100), nullable=True)
    inspector = Column(String(100), nullable=True, index=True)
    servicio = Column(String(100), nullable=True)
    tipo_servicio = Column(String(100), nullable=True)
    cliente = Column(String(50), nullable=True)
    nombre_cliente = Column(String(255), nullable=True)
    direccion = Column(Text, nullable=True)
    comuna = Column(String(100), nullable=True, index=True)
    latitud = Column(Float, nullable=True)
    longitud = Column(Float, nullable=True)
    medidor = Column(String(50), nullable=True)
    tarifa = Column(String(50), nullable=True)
    constante = Column(String(50), nullable=True)
    red = Column(String(50), nullable=True)
    estado_suministro = Column(String(100), nullable=True)
    contratista = Column(String(100), nullable=True)
    tipo_resultado = Column(String(100), nullable=True)
    estado_propiedad = Column(String(100), nullable=True)
    requiere_normalizacion = Column(String(50), nullable=True)
    requiere_trabajo = Column(String(50), nullable=True)
    notificacion = Column(String(100), nullable=True)
    voltaje = Column(String(50), nullable=True)
    amperaje = Column(String(50), nullable=True)
    error_porcentaje = Column(Float, nullable=True)
    kc = Column(String(50), nullable=True)
    factor_potencia = Column(Float, nullable=True)
    kwi = Column(Float, nullable=True)
    kva = Column(Float, nullable=True)
    estado_acometida = Column(String(100), nullable=True)
    estado_caja = Column(String(100), nullable=True)
    estado_tapa = Column(String(100), nullable=True)
    perno_encontrado = Column(String(100), nullable=True)
    perno_normalizado = Column(String(100), nullable=True)
    giro = Column(String(100), nullable=True)
    modelo_corresponde = Column(String(50), nullable=True)
    medidor_corresponde = Column(String(50), nullable=True)
    fecha_inspeccion = Column(DateTime, nullable=True)
    tipo_sistema = Column(String(50), nullable=True)
    mes = Column(Integer, nullable=True)
    anio = Column(Integer, nullable=True)
    mes_origen = Column(String(50), nullable=True)


class CalidadTriInspeccionesModel(Base):
    __tablename__ = "calidad_tri_inspecciones"

    id = Column(Integer, primary_key=True, autoincrement=True)
    incidencia = Column(String(100), nullable=True)
    inspector = Column(String(100), nullable=True, index=True)
    servicio = Column(String(100), nullable=True)
    cliente = Column(String(50), nullable=True)
    nombre_cliente = Column(String(255), nullable=True)
    direccion = Column(Text, nullable=True)
    comuna = Column(String(100), nullable=True, index=True)
    medidor = Column(String(50), nullable=True)
    contratista = Column(String(100), nullable=True)
    tipo_resultado = Column(String(100), nullable=True)
    fecha_inspeccion = Column(DateTime, nullable=True)
    tipo_sistema = Column(String(50), nullable=True)
    mes = Column(Integer, nullable=True)
    anio = Column(Integer, nullable=True)
    mes_origen = Column(String(50), nullable=True)


class LecturasModel(Base):
    __tablename__ = "lecturas"

    id = Column(Integer, primary_key=True, autoincrement=True)
    cantidad = Column(String(50), nullable=True)
    caso = Column(String(100), nullable=True)
    fono_contacto = Column(String(50), nullable=True)
    orden = Column(String(50), nullable=True)
    cliente = Column(String(50), nullable=True)
    fecha_ingreso = Column(DateTime, nullable=True)
    observaciones_caso = Column(Text, nullable=True)
    task = Column(String(100), nullable=True)
    submotivo = Column(String(255), nullable=True)
    canal_entrada = Column(String(100), nullable=True)
    sector_original = Column(String(100), nullable=True)
    zona = Column(String(50), nullable=True, index=True)
    ruta = Column(String(50), nullable=True)
    ruta_lectura = Column(String(50), nullable=True)
    medidor = Column(String(50), nullable=True)
    marca = Column(String(100), nullable=True)
    constante = Column(String(50), nullable=True)
    tarifa = Column(String(50), nullable=True)
    nombre = Column(String(255), nullable=True)
    direccion = Column(Text, nullable=True)
    comuna = Column(String(100), nullable=True)
    sector = Column(String(100), nullable=True, index=True)
    inspector = Column(String(100), nullable=True, index=True)
    tipo_medida = Column(String(100), nullable=True)
    fecha_recepcion_terreno = Column(DateTime, nullable=True)
    fecha_vencimiento = Column(DateTime, nullable=True)
    observacion = Column(Text, nullable=True)
    fecha_inspeccion = Column(DateTime, nullable=True)
    lectura = Column(String(100), nullable=True)
    hallazgo = Column(Text, nullable=True)
    baremo = Column(String(100), nullable=True)
    estado_general = Column(String(100), nullable=True)
    estado_plazo = Column(String(100), nullable=True)
    fecha_respuesta = Column(DateTime, nullable=True)
    rol_responsable = Column(String(100), nullable=True)
    gestion = Column(String(100), nullable=True)
    origen = Column(String(50), nullable=True, index=True)
    dias_respuesta = Column(Integer, nullable=True)
    inspeccionado = Column(Boolean, nullable=True)
    mes = Column(Integer, nullable=True)
    anio = Column(Integer, nullable=True)


class TelecomunicacionesModel(Base):
    __tablename__ = "telecomunicaciones"

    id = Column(Integer, primary_key=True, autoincrement=True)
    pago = Column(String(100), nullable=True)
    family_case = Column(String(100), nullable=True)
    estado_caso = Column(String(100), nullable=True)
    cantidad_postes = Column(Integer, nullable=True)
    empresa = Column(String(255), nullable=True)
    comuna = Column(String(100), nullable=True)
    fecha_primera_inspeccion = Column(DateTime, nullable=True)
    fecha_asignacion = Column(DateTime, nullable=True)
    fecha_inspeccion = Column(DateTime, nullable=True)
    tiene_plano = Column(String(50), nullable=True)
    coord_x = Column(Float, nullable=True)
    coord_y = Column(Float, nullable=True)
    resultado = Column(String(100), nullable=True)
    observacion = Column(Text, nullable=True)
    inspector = Column(String(100), nullable=True, index=True)
    etapa = Column(String(100), nullable=True)
    numero_caso = Column(String(100), nullable=True)
    empresa_corta = Column(String(255), nullable=True)
    tiene_plano_norm = Column(String(50), nullable=True)
    estado_simple = Column(String(100), nullable=True)
    dias_inspeccion = Column(Integer, nullable=True)
    mes_periodo = Column(String(50), nullable=True)
    mes = Column(Integer, nullable=True)
    anio = Column(Integer, nullable=True)


class SettingsModel(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=True)
    description = Column(String(255), nullable=True)
    category = Column(String(50), nullable=True, index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CorteReposicionModel(Base):
    __tablename__ = "corte_reposicion"

    id = Column(Integer, primary_key=True, autoincrement=True)
    numero = Column(String(50), nullable=True)
    fecha_asignado = Column(DateTime, nullable=True)
    fecha_vence = Column(DateTime, nullable=True)
    mes_texto = Column(String(50), nullable=True)
    estado = Column(String(100), nullable=True, index=True)
    accion_cobro = Column(String(100), nullable=True)
    empresa = Column(String(255), nullable=True)
    centro_operativo = Column(String(100), nullable=True)
    suministro = Column(String(50), nullable=True)
    nombre_cliente = Column(String(255), nullable=True)
    direccion = Column(Text, nullable=True)
    comuna = Column(String(100), nullable=True)
    nro_medidor = Column(String(50), nullable=True)
    tipo_orden = Column(String(100), nullable=True)
    situacion_a_inspeccionar = Column(String(255), nullable=True)
    giro = Column(String(100), nullable=True)
    zona = Column(String(50), nullable=True)
    empresa_colaboradora = Column(String(255), nullable=True)
    situacion_encontrada = Column(String(255), nullable=True)
    situacion_dejada = Column(String(255), nullable=True)
    es_factible_cortar = Column(String(50), nullable=True)
    donde_factible = Column(String(255), nullable=True)
    numero_medidor = Column(String(50), nullable=True)
    lectura = Column(String(100), nullable=True)
    tipo_empalme = Column(String(100), nullable=True)
    ejecucion_corte = Column(String(100), nullable=True)
    evidencia_corte = Column(String(100), nullable=True)
    motivo_multa = Column(String(255), nullable=True, index=True)
    multa = Column(String(50), nullable=True)
    detalle = Column(Text, nullable=True)
    respuesta_gestion = Column(Text, nullable=True)
    inspector = Column(String(100), nullable=True)
    fecha_inspeccion = Column(DateTime, nullable=True)
    empresa_oca = Column(String(255), nullable=True)
    encargado = Column(String(100), nullable=True)
    mes = Column(Integer, nullable=True)
    anio = Column(Integer, nullable=True)

    __table_args__ = (
        Index('ix_corte_zona_fecha', 'zona', 'fecha_inspeccion'),
        Index('ix_corte_comuna_inspector', 'comuna', 'inspector'),
    )
