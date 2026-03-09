export interface MCDashboardData {
  overview: MCOverview
  inspectores: MCInspectores
  operacional: MCOperacional
}

export interface MCOverview {
  kpis: {
    total: number
    bien: number
    mal: number
    pct_mal: number
    pct_bien: number
    zonas_count: number
    comunas_count: number
    inspectores_count: number
    pendientes_inspeccion: number
  }
  resultado_por_zona: Array<{ zona: string; total: number; bien: number; mal: number; otros: number }>
  estado_medidor: Array<{ estado: string; cantidad: number }>
  top_comunas: Array<{ comuna: string; total: number; mal: number; tasa_mal: number }>
  evolucion_mensual: Array<{ periodo: string; total: number; bien: number; mal: number; tasa_mal: number }>
}

export interface MCInspectores {
  ranking: Array<{
    inspector: string; total: number; bien: number; mal: number
    tasa_mal: number; zonas: number; comunas: number
    dias_prom: number; estado_principal: string
  }>
  scatter: Array<{ inspector: string; volumen: number; tasa_mal: number }>
}

export interface MCOperacional {
  tiempos: {
    correo_asignacion: number; asignacion_inspeccion: number; inspeccion_analisis: number
    total_dias: number; max_dias: number; min_dias: number
    mayor_30: number; mayor_60: number; total: number
  }
  cuellos_botella: Array<{
    etapa: string; cantidad: number; sin_inspeccion: number
    dias_promedio: number; pct_estancado: number
  }>
  pendientes: {
    sin_inspeccion: number; sin_asignar: number
    asignados_sin_inspeccionar: number; estancados: number; total: number
  }
  evolucion_tiempos: Array<{
    periodo: string; total: number; dias_promedio: number
    bien: number; mal: number; tasa_bien: number
  }>
  detalle_resultados: {
    mal_ejecutados: number; bien_ejecutados: number; no_encontrado: number
    mal_ingresado: number; ut_cruzada: number; sin_acceso: number
    normal: number; sin_observacion: number; total: number
  }
  alertas: Array<{ tipo: string; titulo: string; mensaje: string }>
}

export interface MCDrillFilter {
  key: string
  label: string
  value: string
}
