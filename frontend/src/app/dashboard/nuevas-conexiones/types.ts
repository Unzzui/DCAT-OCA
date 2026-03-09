export interface KPI {
  label: string
  value: number | string
  unit?: string
  trend?: number
  status?: 'good' | 'bad' | 'neutral'
}

export interface OverviewData {
  kpis: {
    total_asignadas: number
    total_inspecciones: number
    total_efectivas: number
    pct_mal_ejecutado: number
    num_mal_ejecutado: number
    num_multas_si: number
    pct_no_efectiva: number
    pct_avance: number
    tasa_efectividad_oca: number
    tasa_cierre_normalizacion: number
    num_pendientes_normalizar: number
    num_medidores_cruzados: number
    num_distinto_medidor: number
    pct_cliente_conforme: number
    num_cliente_disconforme: number
    pct_cumple_norma_cc: number
    num_no_cumple_norma_cc: number
  }
  tendencia_temporal: Array<{
    periodo: string
    total: number
    mal_ejecutado: number
    tasa_mal: number
  }>
  resultado_por_zona: Array<{
    zona: string
    bien: number
    mal: number
    pendiente: number
    efectivas: number
    total: number
    total_inspecciones: number
  }>
  top_comunas_problemas: Array<{
    comuna: string
    tasa_mal: number
    total: number
    mal_ejecutado: number
  }>
}

export interface ContratistaData {
  ranking_contratistas: Array<{
    contratista: string
    inspecciones: number
    mal_ejecutado: number
    tasa_mal: number
    multas: number
    tasa_multas: number
    pend_norm: number
    tasa_cierre: number
  }>
  scatter_contratistas: Array<{
    contratista: string
    volumen: number
    tasa_mal: number
    multas: number
  }>
}

export interface CausasData {
  pareto_causas: Array<{
    causa: string
    cantidad: number
    acumulado_pct: number
  }>
  trabajos_tipicamente_mal: Array<{
    tipo_trabajo: string
    total: number
    mal_ejecutado: number
    tasa_mal: number
  }>
  desgloses_zona: Array<{
    zona: string
    causa: string
    cantidad: number
  }>
}

export interface DetailItem {
  id: number | string
  vta: string
  fecha: string
  zona: string
  comuna: string
  contratista: string
  tipo_trabajo: string
  resultado: string
  multa: string
  causa?: string
  // Additional fields from backend
  fecha_inspeccion?: string
  nombre_cliente?: string
  direccion?: string
  n_medidor?: string
  estado_efectividad?: string
  resultado_inspeccion?: string
  inspector?: string
  contratista_enel?: string
  tipo_inspeccion?: string
  observaciones_multa?: string
  categoria_mal_ejecutado?: string
  link_formulario?: string
  cliente?: string
}

export interface DetailResponse {
  items: DetailItem[]
  total: number
  page: number
  limit: number
  pages: number
}

export interface DrillFilter {
  key: string
  label: string
  value: string
}

export interface KpiModalData {
  zona_breakdown: Array<{ zona: string; total: number }>
  top_causas: Array<{ causa: string; cantidad: number }>
  top_multas_contratistas: Array<{ contratista: string; multas: number }>
  no_efectiva_zona: Array<{ zona: string; no_efectiva: number; total: number; pct: number }>
}

export interface InspectorRanking {
  inspector: string
  inspecciones: number
  efectivas: number
  tasa_efectividad: number
  mal_ejecutado: number
  tasa_mal: number
  multas: number
  zonas: string[]
}

export interface EfectividadZona {
  zona: string
  total: number
  efectivas: number
  tasa_efectividad: number
}

export interface TendenciaEfectividad {
  periodo: string
  total: number
  efectivas: number
  tasa_efectividad: number
}

export interface OcaData {
  ranking_inspectores: InspectorRanking[]
  efectividad_por_zona: EfectividadZona[]
  tendencia_efectividad: TendenciaEfectividad[]
}

export interface MalEjecutadosData {
  total_mal: number
  causas_individuales: Array<{
    causa: string
    cantidad: number
    pct: number
    acumulado_pct: number
  }>
  causas_por_zona: Array<{
    zona: string
    total_mal: number
    causas: Array<{ causa: string; cantidad: number }>
  }>
  causas_por_contratista: Array<{
    contratista: string
    total_mal: number
    causas: Array<{ causa: string; cantidad: number }>
  }>
  mal_por_mes: Array<{
    periodo: string
    total_mal: number
    top_causas: Array<{ causa: string; cantidad: number }>
  }>
}

export interface EjecucionStats {
  fecha_envio: string
  dias_calendario: number
  dias_habiles: number
  completado: boolean
  ultima_inspeccion: string | null
  promedio_diario_habil: number
  pendientes: number
  dias_restantes_habiles: number | null
  fecha_proyectada: string | null
}
