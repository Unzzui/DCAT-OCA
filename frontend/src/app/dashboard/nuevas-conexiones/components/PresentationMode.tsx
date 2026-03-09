'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Image from 'next/image'
import { EChart } from '@/components/ui/EChart'
import { LeafletMap, CATEGORY_COLORS } from '@/components/ui/LeafletMap'
import type { MapPoint, MarkerCategory } from '@/components/ui/LeafletMap'
import { formatNumber } from '@/lib/utils'
import { useBrand } from '@/contexts/ThemeContext'
import { CHART_COLORS, CONTRATISTA_COLORS, TOOLTIP_STYLE, GRID_STYLE, AXIS_STYLE, CATEGORY_AXIS, LEGEND_STYLE, BAR_RADIUS } from '../chart-theme'
import { ContratistaModal } from './ContratistaModal'
import { DayDetailModal } from './DayDetailModal'
import { MapDetailModal } from './MapDetailModal'
import type { MalEjecutadosData, TendenciaEfectividad } from '../types'
import type { EChartsCoreOption } from 'echarts/core'

type PeriodView = 'mensual' | 'semanal' | 'diario'

function pct(val: number | undefined | null): string {
  if (val == null || isNaN(val)) return '--'
  return `${val.toFixed(1)}%`
}

function getISOWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

function getPeriodKey(fecha: string, view: PeriodView): string {
  if (view === 'diario') return fecha.slice(0, 10)
  if (view === 'semanal') return getISOWeek(fecha)
  return fecha.slice(0, 7)
}

function formatPeriodLabel(key: string, view: PeriodView): string {
  if (view === 'diario') { const [, m, d] = key.split('-'); return `${d}/${m}` }
  if (view === 'semanal') return key.replace('-W', '-S')
  return key
}

interface ContratistaRanking {
  contratista: string
  inspecciones: number
  mal_ejecutado: number
  tasa_mal: number
  multas: number
  tasa_multas: number
  pend_norm: number
  tasa_cierre: number
}

interface KpisData {
  total_asignadas: number
  total_inspecciones: number
  pct_mal_ejecutado: number
  num_mal_ejecutado: number
  num_multas_si: number
  pct_avance: number
  tasa_efectividad_oca: number
  num_pendientes_normalizar: number
  [key: string]: number
}

interface TendenciaTemporal {
  periodo: string
  total: number
  mal_ejecutado: number
  tasa_mal: number
}

interface PresentationProps {
  selectedBase: string
  kpis: KpisData | null
  lastInspectionDate: string | null
  // Base chart options (mensual, used as fallback)
  tendenciaOption: EChartsCoreOption
  zonaOption: EChartsCoreOption
  scatterOption: EChartsCoreOption
  paretoOption: EChartsCoreOption
  causasPorContratistaOption: EChartsCoreOption | null
  tendenciaEfectividadOption: EChartsCoreOption
  efectividadZonaOption: EChartsCoreOption
  topInspectoresBarOption: EChartsCoreOption
  mapaPoints: MapPoint[]
  contratistaRanking: ContratistaRanking[]
  malEjecutadosData: MalEjecutadosData | null
  // Raw data for recomputing tendencia
  tendenciaTemporal: TendenciaTemporal[]
  ocaTendenciaEfectividad: TendenciaEfectividad[]
  onExit: () => void
}

// ─── Period toggle ──────────────────────────────────────────────────────────

function PeriodToggle({ value, onChange }: { value: PeriodView; onChange: (v: PeriodView) => void }) {
  return (
    <div className="flex gap-0.5 bg-slate-100 rounded p-0.5">
      {(['mensual', 'semanal', 'diario'] as const).map(v => (
        <button
          key={v}
          onClick={(e) => { e.stopPropagation(); onChange(v) }}
          className={`px-2.5 py-1 text-[10px] font-medium rounded transition-colors ${
            value === v
              ? 'bg-white text-slate-700 shadow-sm'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          {v === 'mensual' ? 'Mes' : v === 'semanal' ? 'Sem' : 'Dia'}
        </button>
      ))}
    </div>
  )
}

// ─── Slide wrapper ──────────────────────────────────────────────────────────

function Slide({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`w-full h-full flex flex-col px-12 py-8 animate-fade-in ${className}`}>
      {children}
    </div>
  )
}

function SlideTitle({ children, sub, right }: { children: React.ReactNode; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-6 shrink-0 flex items-start justify-between">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">{children}</h2>
        {sub && <p className="text-sm text-slate-400 mt-1">{sub}</p>}
      </div>
      {right}
    </div>
  )
}

// ─── Individual Slides ──────────────────────────────────────────────────────

function SlideCover({ selectedBase, lastInspectionDate }: { selectedBase: string; lastInspectionDate: string | null }) {
  const { isEnel } = useBrand()
  return (
    <Slide className="items-center justify-center text-center">
      <Image
        src={isEnel ? '/logo-enel.png' : '/logoOcaHorizontal.svg'}
        alt="Logo"
        width={180}
        height={60}
        className="h-14 w-auto mb-10 opacity-80"
      />
      <h1 className="text-4xl font-bold text-slate-800 tracking-tight">
        Presentacion Nuevas Conexiones
      </h1>
      <p className="text-lg text-slate-400 mt-3 font-light">
        Resultados de Inspeccion y Calidad de Ejecucion
      </p>
      <div className="mt-8 flex items-center gap-6 text-sm text-slate-500">
        {selectedBase && (
          <span className="bg-slate-100 rounded-full px-4 py-1.5 font-medium">{selectedBase}</span>
        )}
        {lastInspectionDate && (
          <span>Actualizado al {lastInspectionDate}</span>
        )}
      </div>
    </Slide>
  )
}

function SlideKpis({ kpis }: { kpis: KpisData }) {
  const items = [
    { label: 'Asignadas', value: formatNumber(kpis.total_asignadas), color: 'text-slate-800' },
    { label: 'Inspeccionadas', value: formatNumber(kpis.total_inspecciones), sub: pct(kpis.pct_avance) + ' avance', color: 'text-slate-800' },
    { label: 'Mal Ejecutados', value: formatNumber(kpis.num_mal_ejecutado), sub: pct(kpis.pct_mal_ejecutado), color: 'text-red-600' },
    { label: 'Multas', value: formatNumber(kpis.num_multas_si), color: 'text-amber-600' },
    { label: 'Efectividad OCA', value: pct(kpis.tasa_efectividad_oca), color: kpis.tasa_efectividad_oca >= 80 ? 'text-green-600' : 'text-amber-600' },
    { label: 'Pend. Normalizar', value: formatNumber(kpis.num_pendientes_normalizar), color: 'text-slate-700' },
  ]

  return (
    <Slide className="justify-center">
      <SlideTitle sub="Vision general del periodo">Indicadores Ejecutivos</SlideTitle>
      <div className="grid grid-cols-3 gap-6 max-w-4xl mx-auto w-full">
        {items.map(item => (
          <div key={item.label} className="bg-white rounded-xl border border-slate-200/60 shadow-sm px-6 py-5 text-center">
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{item.label}</p>
            <p className={`text-4xl font-bold mt-2 ${item.color}`}>{item.value}</p>
            {item.sub && <p className="text-sm text-slate-400 mt-1">{item.sub}</p>}
          </div>
        ))}
      </div>
    </Slide>
  )
}

function SlideMapa({ points, onPointClick }: { points: MapPoint[]; onPointClick: (p: MapPoint) => void }) {
  const categories: { key: MarkerCategory; label: string }[] = [
    { key: 'bien', label: 'Bien Ejecutado' },
    { key: 'mal', label: 'Mal Ejecutado' },
    { key: 'no_efectiva', label: 'No Efectiva' },
    { key: 'pendiente', label: 'Pendiente' },
  ]
  return (
    <Slide>
      <SlideTitle sub={`${formatNumber(points.length)} inspecciones geolocalizadas`}>Mapa de Inspecciones</SlideTitle>
      <div className="flex-1 min-h-0 rounded-xl overflow-hidden border border-slate-200/60">
        <LeafletMap points={points} height="calc(100vh - 200px)" onPointClick={onPointClick} />
      </div>
      <div className="flex items-center justify-center gap-6 mt-3">
        {categories.map(c => (
          <div key={c.key} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[c.key] }} />
            <span className="text-[11px] text-slate-500">{c.label}</span>
          </div>
        ))}
      </div>
    </Slide>
  )
}

function SlideContratistas({
  scatterOption,
  ranking,
  onScatterClick,
  onRowClick,
}: {
  scatterOption: EChartsCoreOption
  ranking: ContratistaRanking[]
  onScatterClick: (name: string) => void
  onRowClick: (name: string) => void
}) {
  const scatterEvents = useMemo(() => ({
    click: (p: { data?: { name?: string } }) => {
      if (p.data?.name) onScatterClick(p.data.name)
    },
  }), [onScatterClick])

  const totalInsp = ranking.reduce((s, r) => s + r.inspecciones, 0)

  const donutOption = useMemo((): EChartsCoreOption => ({
    tooltip: { ...TOOLTIP_STYLE, trigger: 'item' as const, formatter: (p: { name?: string; value?: number; percent?: number }) => `<b>${p.name}</b><br/>${formatNumber(p.value ?? 0)} insp. (${p.percent?.toFixed(1)}%)` },
    series: [{
      type: 'pie' as const,
      radius: ['42%', '70%'],
      center: ['50%', '50%'],
      avoidLabelOverlap: true,
      itemStyle: { borderColor: '#fff', borderWidth: 2 },
      label: { show: true, fontSize: 10, color: '#64748b', formatter: (p: { name?: string; percent?: number }) => `${p.name}\n${p.percent?.toFixed(0)}%`, lineHeight: 14 },
      labelLine: { length: 10, length2: 8, lineStyle: { color: '#cbd5e1' } },
      emphasis: { label: { fontSize: 12, fontWeight: 'bold' as const } },
      data: ranking.map((r, idx) => ({
        value: r.inspecciones,
        name: r.contratista,
        itemStyle: { color: CONTRATISTA_COLORS[idx % CONTRATISTA_COLORS.length] },
      })),
    }],
  }), [ranking])

  return (
    <Slide>
      <SlideTitle sub="Volumen vs calidad y ranking general">Analisis de Contratistas</SlideTitle>
      <div className="flex-1 min-h-0 grid grid-cols-2 gap-4">
        {/* Left: Scatter */}
        <div>
          <EChart option={scatterOption} height="calc(100vh - 220px)" onEvents={scatterEvents} />
        </div>
        {/* Right: Donut + Table */}
        <div className="flex flex-col gap-3 min-h-0">
          {/* Donut */}
          <div className="flex-1 min-h-0">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Distribucion de Inspecciones</p>
            <EChart option={donutOption} height="100%" />
          </div>
          {/* Table */}
          <div className="shrink-0 max-h-[40%] overflow-y-auto">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-2 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Contratista</th>
                  <th className="px-2 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-right">Insp.</th>
                  <th className="px-2 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-right">Mal</th>
                  <th className="px-2 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-right">Tasa</th>
                  <th className="px-2 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-right">Multas</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((r, idx) => (
                  <tr
                    key={r.contratista}
                    onClick={() => onRowClick(r.contratista)}
                    className="border-b border-slate-50 hover:bg-slate-100 cursor-pointer transition-colors"
                  >
                    <td className="px-2 py-1.5 text-[11px] font-medium text-slate-700 truncate max-w-[130px]">
                      <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: CONTRATISTA_COLORS[idx % CONTRATISTA_COLORS.length] }} />
                      {r.contratista}
                    </td>
                    <td className="px-2 py-1.5 text-[11px] text-slate-600 text-right">{formatNumber(r.inspecciones)}</td>
                    <td className="px-2 py-1.5 text-[11px] text-red-600 text-right">{formatNumber(r.mal_ejecutado)}</td>
                    <td className="px-2 py-1.5 text-[11px] text-right font-semibold" style={{ color: r.tasa_mal >= 30 ? '#dc2626' : r.tasa_mal >= 15 ? '#d97706' : '#16a34a' }}>
                      {pct(r.tasa_mal)}
                    </td>
                    <td className="px-2 py-1.5 text-[11px] text-amber-600 text-right">{formatNumber(r.multas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Slide>
  )
}

function SlideMalEjecutados({ paretoOption, causasOption }: { paretoOption: EChartsCoreOption; causasOption: EChartsCoreOption | null }) {
  return (
    <Slide>
      <SlideTitle sub="Pareto de causas y distribucion por contratista">Analisis de Mal Ejecutados</SlideTitle>
      <div className="flex-1 min-h-0 grid grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Pareto de Causas</p>
          <EChart option={paretoOption} height="calc(100vh - 240px)" />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Por Contratista</p>
          {causasOption ? (
            <EChart option={causasOption} height="calc(100vh - 240px)" />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400 text-sm">Sin datos</div>
          )}
        </div>
      </div>
    </Slide>
  )
}

// ─── Main Presentation Component ────────────────────────────────────────────

export function PresentationMode({
  selectedBase,
  kpis,
  lastInspectionDate,
  tendenciaOption: baseTendenciaOption,
  zonaOption,
  scatterOption,
  paretoOption,
  causasPorContratistaOption,
  tendenciaEfectividadOption: baseOcaOption,
  efectividadZonaOption,
  topInspectoresBarOption,
  mapaPoints,
  contratistaRanking,
  malEjecutadosData,
  tendenciaTemporal,
  ocaTendenciaEfectividad,
  onExit,
}: PresentationProps) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [transitioning, setTransitioning] = useState(false)
  const [selectedContratista, setSelectedContratista] = useState<string | null>(null)
  const [selectedPoint, setSelectedPoint] = useState<MapPoint | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [tendenciaView, setTendenciaView] = useState<PeriodView>('diario')
  const [ocaView, setOcaView] = useState<PeriodView>('diario')

  const slideCount = 7

  const goTo = useCallback((idx: number) => {
    if (idx < 0 || idx >= slideCount || idx === currentSlide || transitioning) return
    setTransitioning(true)
    setTimeout(() => {
      setCurrentSlide(idx)
      setTransitioning(false)
    }, 150)
  }, [currentSlide, transitioning, slideCount])

  const next = useCallback(() => goTo(currentSlide + 1), [goTo, currentSlide])
  const prev = useCallback(() => goTo(currentSlide - 1), [goTo, currentSlide])

  const hasModal = selectedContratista !== null || selectedPoint !== null || selectedDay !== null

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (hasModal) return
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev() }
      else if (e.key === 'Escape') onExit()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [next, prev, onExit, hasModal])

  // ─── Tendencia Temporal with period toggle ──────────────────────────────
  const computedTendencia = useMemo(() => {
    if (tendenciaView === 'mensual') return tendenciaTemporal
    const pts = mapaPoints.filter(p => p.fecha)
    if (!pts.length) return []
    const byPeriod = new Map<string, { total: number; mal: number }>()
    for (const p of pts) {
      const key = getPeriodKey(p.fecha!, tendenciaView)
      const e = byPeriod.get(key) || { total: 0, mal: 0 }
      e.total++
      if (p.resultado?.toUpperCase().includes('MAL')) e.mal++
      byPeriod.set(key, e)
    }
    return Array.from(byPeriod.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([periodo, s]) => ({
        periodo,
        total: s.total,
        mal_ejecutado: s.mal,
        tasa_mal: s.total > 0 ? Math.round((s.mal / s.total) * 10000) / 100 : 0,
      }))
  }, [tendenciaView, mapaPoints, tendenciaTemporal])

  const tendenciaOption = useMemo((): EChartsCoreOption => {
    if (tendenciaView === 'mensual') return baseTendenciaOption
    if (!computedTendencia.length) return {}
    const d = computedTendencia
    const lastIdx = d.length - 1
    return {
      tooltip: { ...TOOLTIP_STYLE, trigger: 'axis' as const, axisPointer: { type: 'cross' as const, crossStyle: { color: '#94a3b8' } } },
      legend: { ...LEGEND_STYLE, data: ['Total', 'Mal Ejecutado', '% Tasa Mal'] },
      grid: { ...GRID_STYLE, bottom: tendenciaView === 'diario' && d.length > 30 ? 68 : GRID_STYLE.bottom },
      xAxis: { type: 'category' as const, data: d.map(i => formatPeriodLabel(i.periodo, tendenciaView)), ...AXIS_STYLE, axisLabel: { ...AXIS_STYLE.axisLabel, rotate: tendenciaView === 'diario' ? 45 : 0 }, splitLine: { show: false } },
      yAxis: [
        { type: 'value' as const, ...AXIS_STYLE },
        { type: 'value' as const, ...AXIS_STYLE, min: 0, max: 100, axisLabel: { ...AXIS_STYLE.axisLabel, formatter: '{value}%' } },
      ],
      dataZoom: tendenciaView === 'diario' && d.length > 30 ? [
        { type: 'inside', start: Math.max(0, 100 - (30 / d.length) * 100), end: 100 },
        { type: 'slider', height: 18, bottom: 22, borderColor: '#e2e8f0', fillerColor: 'rgba(71,85,105,0.08)', handleSize: '60%', textStyle: { fontSize: 10, color: '#94a3b8' } },
      ] : undefined,
      series: [
        {
          name: 'Total', type: 'bar' as const, barMaxWidth: 32,
          data: d.map((i, idx) => ({
            value: i.total,
            itemStyle: { color: idx === lastIdx ? '#334155' : CHART_COLORS.primary, borderRadius: BAR_RADIUS },
          })),
        },
        {
          name: 'Mal Ejecutado', type: 'bar' as const, barMaxWidth: 32,
          data: d.map((i, idx) => ({
            value: i.mal_ejecutado,
            itemStyle: { color: idx === lastIdx ? '#991b1b' : CHART_COLORS.danger, borderRadius: BAR_RADIUS },
          })),
        },
        {
          name: '% Tasa Mal', type: 'line' as const, yAxisIndex: 1,
          data: d.map(i => i.tasa_mal),
          smooth: true,
          lineStyle: { color: CHART_COLORS.danger, width: 2.5 },
          itemStyle: { color: CHART_COLORS.danger },
          symbol: 'circle',
          symbolSize: (v: number, p: { dataIndex: number }) => p.dataIndex === lastIdx ? 10 : 4,
          showSymbol: true,
          endLabel: { show: true, formatter: '{c}%', fontSize: 11, fontWeight: 'bold' as const, color: CHART_COLORS.danger },
        },
      ],
    }
  }, [tendenciaView, computedTendencia, baseTendenciaOption])

  // ─── OCA Tendencia Efectividad with period toggle ──────────────────────
  const computedOcaTendencia = useMemo(() => {
    if (ocaView === 'mensual') return ocaTendenciaEfectividad
    const pts = mapaPoints.filter(p => p.fecha && p.estado_efectividad)
    if (!pts.length) return []
    const byPeriod = new Map<string, { total: number; efectivas: number }>()
    for (const p of pts) {
      const key = getPeriodKey(p.fecha!, ocaView)
      const e = byPeriod.get(key) || { total: 0, efectivas: 0 }
      e.total++
      const ef = (p.estado_efectividad || '').toUpperCase()
      if (ef.includes('EFECTIVA') && !ef.includes('NO EFECTIVA')) e.efectivas++
      byPeriod.set(key, e)
    }
    return Array.from(byPeriod.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([periodo, s]) => ({
        periodo,
        total: s.total,
        efectivas: s.efectivas,
        tasa_efectividad: s.total > 0 ? Math.round((s.efectivas / s.total) * 10000) / 100 : 0,
      }))
  }, [ocaView, mapaPoints, ocaTendenciaEfectividad])

  const ocaTendenciaOption = useMemo((): EChartsCoreOption => {
    if (ocaView === 'mensual') return baseOcaOption
    if (!computedOcaTendencia.length) return {}
    const d = computedOcaTendencia
    return {
      tooltip: { ...TOOLTIP_STYLE, trigger: 'axis' as const, axisPointer: { type: 'cross' as const } },
      legend: { ...LEGEND_STYLE, data: ['Total Inspeccionadas', 'Efectivas', '% Efectividad'] },
      grid: { ...GRID_STYLE, bottom: ocaView === 'diario' && d.length > 30 ? 68 : GRID_STYLE.bottom },
      xAxis: { type: 'category' as const, data: d.map(i => formatPeriodLabel(i.periodo, ocaView)), ...AXIS_STYLE, axisLabel: { ...AXIS_STYLE.axisLabel, rotate: ocaView === 'diario' ? 45 : 0 }, splitLine: { show: false } },
      yAxis: [
        { type: 'value' as const, ...AXIS_STYLE },
        { type: 'value' as const, ...AXIS_STYLE, min: 0, max: 100, axisLabel: { ...AXIS_STYLE.axisLabel, formatter: '{value}%' } },
      ],
      dataZoom: ocaView === 'diario' && d.length > 30 ? [
        { type: 'inside', start: Math.max(0, 100 - (30 / d.length) * 100), end: 100 },
        { type: 'slider', height: 18, bottom: 22, borderColor: '#e2e8f0', fillerColor: 'rgba(71,85,105,0.08)', handleSize: '60%', textStyle: { fontSize: 10, color: '#94a3b8' } },
      ] : undefined,
      series: [
        {
          name: 'Total Inspeccionadas', type: 'bar' as const, barMaxWidth: 28,
          data: d.map(i => ({ value: i.total, itemStyle: { color: CHART_COLORS.muted, borderRadius: BAR_RADIUS } })),
        },
        {
          name: 'Efectivas', type: 'bar' as const, barMaxWidth: 28,
          data: d.map(i => ({ value: i.efectivas, itemStyle: { color: CHART_COLORS.success, borderRadius: BAR_RADIUS } })),
        },
        {
          name: '% Efectividad', type: 'line' as const, yAxisIndex: 1,
          data: d.map(i => i.tasa_efectividad),
          smooth: true,
          lineStyle: { color: CHART_COLORS.primary, width: 2.5 },
          itemStyle: { color: CHART_COLORS.primary },
          symbol: 'circle', symbolSize: 5, showSymbol: true,
          markLine: {
            silent: true, symbol: 'none',
            data: [{ yAxis: 80, lineStyle: { type: 'dashed' as const, color: CHART_COLORS.success, opacity: 0.5 }, label: { formatter: '80% meta', fontSize: 10, color: '#94a3b8', position: 'insideEndTop' as const } }],
          },
        },
      ],
    }
  }, [ocaView, computedOcaTendencia, baseOcaOption])

  // Tendencia click — only active in diario view
  const tendenciaEvents = useMemo(() => {
    if (tendenciaView !== 'diario') return undefined
    return {
      click: (p: { dataIndex?: number }) => {
        if (p.dataIndex == null || !computedTendencia[p.dataIndex]) return
        setSelectedDay(computedTendencia[p.dataIndex].periodo)
      },
    }
  }, [tendenciaView, computedTendencia])

  const selectedDayPoints = useMemo(() => {
    if (!selectedDay) return []
    return mapaPoints.filter(p => p.fecha?.startsWith(selectedDay))
  }, [selectedDay, mapaPoints])

  // Contratista modal handlers
  const handleScatterClick = useCallback((name: string) => setSelectedContratista(name), [])
  const handleRowClick = useCallback((name: string) => setSelectedContratista(name), [])

  const selectedRanking = useMemo(() => {
    if (!selectedContratista) return null
    return contratistaRanking.find(r => r.contratista === selectedContratista) ?? null
  }, [selectedContratista, contratistaRanking])

  const slideLabels = ['Portada', 'KPIs', 'Tendencia', 'Mapa', 'Contratistas', 'Mal Ejecutados', 'OCA']

  return (
    <div className="fixed inset-0 z-[900] bg-slate-50 flex flex-col">
      {/* Slide area */}
      <div className={`flex-1 min-h-0 transition-opacity duration-150 ${transitioning ? 'opacity-0' : 'opacity-100'}`}>
        {currentSlide === 0 && <SlideCover selectedBase={selectedBase} lastInspectionDate={lastInspectionDate} />}
        {currentSlide === 1 && kpis && <SlideKpis kpis={kpis} />}
        {currentSlide === 2 && (
          <Slide>
            <SlideTitle
              sub="Evolucion de inspecciones y tasa de mal ejecucion"
              right={<PeriodToggle value={tendenciaView} onChange={setTendenciaView} />}
            >
              Tendencia Temporal
            </SlideTitle>
            <div className="flex-1 min-h-0">
              <EChart option={tendenciaOption} height="calc(100vh - 220px)" onEvents={tendenciaEvents} className={tendenciaView === 'diario' ? 'cursor-pointer' : ''} />
            </div>
            {tendenciaView === 'diario' && (
              <p className="text-[10px] text-slate-400 text-center mt-1">Clic en una barra para ver el detalle del dia</p>
            )}
          </Slide>
        )}
        {currentSlide === 3 && <SlideMapa points={mapaPoints} onPointClick={setSelectedPoint} />}
        {currentSlide === 4 && (
          <SlideContratistas
            scatterOption={scatterOption}
            ranking={contratistaRanking}
            onScatterClick={handleScatterClick}
            onRowClick={handleRowClick}
          />
        )}
        {currentSlide === 5 && <SlideMalEjecutados paretoOption={paretoOption} causasOption={causasPorContratistaOption} />}
        {currentSlide === 6 && (
          <Slide>
            <SlideTitle
              sub="Efectividad de inspectores OCA y tendencia"
              right={<PeriodToggle value={ocaView} onChange={setOcaView} />}
            >
              Rendimiento OCA
            </SlideTitle>
            <div className="flex-1 min-h-0 grid grid-cols-5 gap-4">
              <div className="col-span-3">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Tendencia Efectividad</p>
                <EChart option={ocaTendenciaOption} height="calc(100vh - 240px)" />
              </div>
              <div className="col-span-2">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Efectividad por Zona</p>
                <EChart option={efectividadZonaOption} height="calc(100vh - 240px)" />
              </div>
            </div>
          </Slide>
        )}
      </div>

      {/* Navigation arrows */}
      {currentSlide > 0 && (
        <button
          onClick={prev}
          className="fixed left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/80 border border-slate-200 shadow-sm text-slate-400 hover:text-slate-700 hover:bg-white transition-colors"
        >
          <ChevronLeft size={22} />
        </button>
      )}
      {currentSlide < slideCount - 1 && (
        <button
          onClick={next}
          className="fixed right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/80 border border-slate-200 shadow-sm text-slate-400 hover:text-slate-700 hover:bg-white transition-colors"
        >
          <ChevronRight size={22} />
        </button>
      )}

      {/* Bottom bar */}
      <div className="shrink-0 flex items-center justify-center gap-2 py-3 bg-white border-t border-slate-100">
        <button
          onClick={onExit}
          className="absolute left-4 text-[10px] text-slate-400 hover:text-slate-600 uppercase tracking-wider font-medium transition-colors"
        >
          ESC Salir
        </button>
        <div className="flex items-center gap-1.5">
          {slideLabels.map((label, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
                i === currentSlide
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="absolute right-4 text-[10px] text-slate-400">
          {currentSlide + 1} / {slideCount}
        </span>
      </div>

      {/* Contratista Modal */}
      {selectedContratista && selectedRanking && (
        <ContratistaModal
          contratistaName={selectedContratista}
          ranking={selectedRanking}
          malEjecutadosData={malEjecutadosData}
          selectedBase={selectedBase}
          mapaPoints={mapaPoints}
          onClose={() => setSelectedContratista(null)}
          onViewRecords={() => setSelectedContratista(null)}
        />
      )}

      {/* Day Detail Modal */}
      {selectedDay && selectedDayPoints.length > 0 && (
        <DayDetailModal
          date={selectedDay}
          points={selectedDayPoints}
          onClose={() => setSelectedDay(null)}
        />
      )}

      {/* Map Detail Modal */}
      {selectedPoint && (
        <MapDetailModal
          point={selectedPoint}
          onClose={() => setSelectedPoint(null)}
        />
      )}
    </div>
  )
}
