export function pct(val: number | undefined | null): string {
  if (val == null || isNaN(val)) return '–'
  return `${val.toFixed(1)}%`
}

export function badgeColor(status?: 'good' | 'bad' | 'neutral'): string {
  if (status === 'good') return 'green'
  if (status === 'bad') return 'red'
  return 'gray'
}

export function resultadoBadgeColor(resultado: string): string {
  const r = resultado?.toLowerCase()
  if (r === 'bien ejecutado' || r === 'bien') return 'green'
  if (r === 'mal ejecutado' || r === 'mal') return 'red'
  if (r === 'no efectiva') return 'yellow'
  return 'gray'
}
