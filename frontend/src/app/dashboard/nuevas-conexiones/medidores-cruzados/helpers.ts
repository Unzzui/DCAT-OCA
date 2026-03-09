export function pct(val: number | undefined | null): string {
  if (val == null || isNaN(val)) return '\u2013'
  return `${val.toFixed(1)}%`
}

export function estadoMedidorColor(estado: string): string {
  const s = estado?.toUpperCase() || ''
  if (s.includes('NORMAL')) return 'green'
  if (s.includes('MAL') || s.includes('CONFIGURADO')) return 'red'
  if (s.includes('CRUZAD')) return 'amber'
  if (s.includes('SIN ACCESO')) return 'slate'
  if (s.includes('NO ENCONTRADO')) return 'orange'
  return 'gray'
}

export const ESTADO_MEDIDOR_COLORS: Record<string, string> = {
  'MEDIDOR NORMAL': '#15803d',
  'MEDIDOR MAL INGRESADO EN SISTEMA': '#b91c1c',
  'CONCENTRADOR MAL CONFIGURADO': '#dc2626',
  'UT CRUZADA': '#92400e',
  'SIN ACCESO': '#64748b',
  'MEDIDOR NO ENCONTRADO': '#c2410c',
}
