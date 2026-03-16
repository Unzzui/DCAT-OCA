// Map point utilities — safe for SSR (no leaflet dependency)

export interface MapPoint {
  lat: number
  lng: number
  resultado: string
  zona: string
  comuna: string
  contratista: string
  vta?: string
  cliente?: string
  nombre_cliente?: string
  inspector?: string
  fecha?: string
  tipo_trabajo?: string
  multa?: string
  causa?: string
  link_formulario?: string
  direccion?: string
  n_medidor?: string
  estado_efectividad?: string
  observaciones_multa?: string
  estado_empalme?: string
  cumple_norma_cc?: string
  cliente_conforme?: string
  resultado_normalizacion?: string
  estado_contratista?: string
  categoria_no_efectivo?: string
}

export type MarkerCategory = 'bien' | 'mal' | 'no_efectiva' | 'pendiente'

export function getPointCategory(point: MapPoint): MarkerCategory {
  const resultado = (point.resultado || '').toUpperCase()
  const efectividad = (point.estado_efectividad || '').toUpperCase()

  if (resultado.includes('MAL EJECUTADO')) return 'mal'
  if (resultado.includes('BIEN EJECUTADO')) return 'bien'
  if (efectividad.includes('NO EFECTIVA') || resultado === 'OTROS') return 'no_efectiva'
  if (efectividad.includes('EFECTIVA')) return 'bien'
  return 'pendiente'
}

export const CATEGORY_COLORS: Record<MarkerCategory, string> = {
  bien: '#16a34a',
  mal: '#dc2626',
  no_efectiva: '#94a3b8',
  pendiente: '#cbd5e1',
}
