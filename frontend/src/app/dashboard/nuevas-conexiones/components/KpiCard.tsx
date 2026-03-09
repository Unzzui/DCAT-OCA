'use client'

import { formatNumber } from '@/lib/utils'

/** Area sparkline that fills the bottom of a card — SVG, no deps. */
function AreaSpark({
  data,
  color = '#94a3b8',
  height = 32,
}: {
  data: number[]
  color?: string
  height?: number
}) {
  if (!data || data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * 100
    const y = 2 + (1 - (v - min) / range) * (height - 4)
    return [x, y] as [number, number]
  })

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ')
  const areaPath = `${linePath} L100,${height} L0,${height} Z`

  return (
    <svg
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      className="w-full block"
      style={{ height }}
    >
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.12" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#grad-${color.replace('#', '')})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/** Hero KPI — dominant strategic metric. Large number, optional delta + area spark at bottom. */
export function HeroKpi({
  label,
  value,
  subtitle,
  delta,
  meta,
  status = 'neutral',
  sparkData,
  onClick,
}: {
  label: string
  value: string | number
  subtitle?: string
  delta?: number | null
  /** Meta reference shown as small tag, e.g. "Meta <15%" */
  meta?: string
  status?: 'good' | 'bad' | 'neutral'
  sparkData?: number[]
  onClick?: () => void
}) {
  const valueColor = status === 'bad' ? 'text-red-700' : status === 'good' ? 'text-green-700' : 'text-slate-900'
  const sparkColor = status === 'bad' ? '#dc2626' : status === 'good' ? '#16a34a' : '#64748b'

  return (
    <div
      className={`flex flex-col ${onClick ? 'cursor-pointer hover:bg-slate-50/80 transition-colors' : ''}`}
      onClick={onClick}
    >
      <div className="px-5 pt-5 pb-2 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-[9px] font-medium text-slate-400 uppercase tracking-wider">{label}</p>
          {meta && (
            <span className="text-[9px] text-slate-400 font-normal">
              {meta}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex items-baseline gap-2">
          <p className={`text-3xl font-bold ${valueColor} leading-none tracking-tight`}>
            {typeof value === 'number' ? formatNumber(value) : value}
          </p>
          {delta != null && delta !== 0 && (
            <span className={`text-[10px] font-semibold ${delta > 0 ? 'text-red-600' : 'text-green-700'}`}>
              {delta > 0 ? '+' : ''}{delta.toFixed(1)}pp
            </span>
          )}
        </div>
        {subtitle && <p className="text-[10px] text-slate-400 mt-1.5">{subtitle}</p>}
      </div>
      {sparkData && sparkData.length >= 2 && (
        <div className="mt-auto">
          <AreaSpark data={sparkData} color={sparkColor} height={36} />
        </div>
      )}
    </div>
  )
}

/** Feature KPI — like HeroKpi but with even larger number, for standalone metrics. */
export function FeatureKpi({
  label,
  value,
  subtitle,
  status = 'neutral',
  onClick,
}: {
  label: string
  value: string | number
  subtitle?: string
  status?: 'good' | 'bad' | 'neutral'
  onClick?: () => void
}) {
  const valueColor = status === 'bad' ? 'text-red-700' : status === 'good' ? 'text-green-700' : 'text-slate-900'

  return (
    <div
      className={`px-4 py-3 flex flex-col justify-center ${onClick ? 'cursor-pointer hover:bg-slate-50/80 transition-colors' : ''}`}
      onClick={onClick}
    >
      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold ${valueColor} mt-1 leading-none tracking-tight`}>
        {typeof value === 'number' ? formatNumber(value) : value}
      </p>
      {subtitle && <p className="text-[10px] text-slate-400 mt-1">{subtitle}</p>}
    </div>
  )
}

/** Standard KPI — secondary metric. Compact, minimal + optional spark. */
export function KpiCard({
  label,
  value,
  unit,
  subtitle,
  status = 'neutral',
  sparkData,
  onClick,
}: {
  label: string
  value: string | number
  unit?: string
  subtitle?: string
  status?: 'good' | 'bad' | 'neutral'
  sparkData?: number[]
  onClick?: () => void
}) {
  const valueColor = status === 'bad' ? 'text-red-700' : status === 'good' ? 'text-green-700' : 'text-slate-900'
  const sparkColor = status === 'bad' ? '#dc2626' : status === 'good' ? '#16a34a' : '#64748b'

  return (
    <div
      className={`flex flex-col ${onClick ? 'cursor-pointer hover:bg-slate-50/80 transition-colors' : ''}`}
      onClick={onClick}
    >
      <div className="px-4 pt-3 pb-1 flex-1">
        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{label}</p>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className={`text-lg font-semibold ${valueColor} leading-none tracking-tight`}>
            {typeof value === 'number' ? formatNumber(value) : value}
          </span>
          {unit && <span className="text-[10px] font-medium text-slate-400">{unit}</span>}
        </div>
        {subtitle && <p className="text-[10px] text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {sparkData && sparkData.length >= 2 && (
        <div className="mt-auto">
          <AreaSpark data={sparkData} color={sparkColor} height={28} />
        </div>
      )}
    </div>
  )
}

/** Progress KPI — with thin bar indicator. */
export function ProgressKpi({
  label,
  value,
  displayValue,
  thresholds = { good: 80, warning: 50 },
}: {
  label: string
  value: number
  displayValue: string
  thresholds?: { good: number; warning: number }
}) {
  const level = value >= thresholds.good ? 'good' : value >= thresholds.warning ? 'warning' : 'bad'
  const barColor = level === 'good' ? 'bg-green-700' : level === 'warning' ? 'bg-amber-600' : 'bg-red-700'
  const valueColor = level === 'good' ? 'text-green-700' : level === 'warning' ? 'text-amber-700' : 'text-red-700'

  return (
    <div className="px-4 py-3">
      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`text-lg font-semibold ${valueColor} mt-1 leading-none tracking-tight`}>{displayValue}</p>
      <div className="mt-2 w-full bg-slate-100 rounded-full h-[3px] overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor}`}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
    </div>
  )
}
