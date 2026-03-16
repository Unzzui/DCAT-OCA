'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Header } from '@/components/layout/Header'
import {
  Table,
  TableHead,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
  Badge,
  Select,
  SelectItem,
  TextInput,
  Tab,
  TabGroup,
  TabList,
  TabPanel,
  TabPanels,
} from '@tremor/react'
import {
  Search,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  Loader2,
  RefreshCw,
  Maximize2,
  Minimize2,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ExportDropdown } from '@/components/ui/ExportDropdown'
import { EChart } from '@/components/ui/EChart'
import { LeafletMap, getPointCategory, CATEGORY_COLORS } from '@/components/ui/LeafletMap'
import type { MapPoint, MarkerCategory } from '@/components/ui/LeafletMap'
import { formatNumber } from '@/lib/utils'
import { api } from '@/lib/api'

import type {
  OverviewData,
  ContratistaData,
  CausasData,
  DetailItem,
  DetailResponse,
  DrillFilter,
  KpiModalData,
  MalEjecutadosData,
  OcaData,
  NoEfectivosData,
  EjecucionStats,
} from './types'
import { pct, resultadoBadgeColor } from './helpers'
import { CHART_COLORS, CONTRATISTA_COLORS, TOOLTIP_STYLE, GRID_STYLE, AXIS_STYLE, CATEGORY_AXIS, LEGEND_STYLE, BAR_RADIUS, BAR_RADIUS_H } from './chart-theme'
import { HeroKpi, KpiCard, FeatureKpi, ProgressKpi } from './components/KpiCard'
import { KpiModal } from './components/KpiModal'
import { MapDetailModal } from './components/MapDetailModal'
import { MedidoresCruzadosModal } from './components/MedidoresCruzadosModal'
import { ContratistaModal } from './components/ContratistaModal'
import { DayDetailModal } from './components/DayDetailModal'
import { PresentationMode } from './components/PresentationMode'
import { FilterChip } from './components/FilterChip'
import MultiSelect from '@/components/ui/MultiSelect'
import { useSidebar } from '@/contexts/SidebarContext'

// ─── Helpers ────────────────────────────────────────────────────────────────

function getISOWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

function getPeriodKey(fecha: string, view: 'mensual' | 'semanal' | 'diario'): string {
  if (view === 'diario') return fecha.slice(0, 10)     // YYYY-MM-DD
  if (view === 'semanal') return getISOWeek(fecha)       // YYYY-Wnn
  return fecha.slice(0, 7)                               // YYYY-MM
}

function formatPeriodLabel(key: string, view: 'mensual' | 'semanal' | 'diario'): string {
  if (view === 'diario') {
    const [, m, d] = key.split('-')
    return `${d}/${m}`
  }
  if (view === 'semanal') return key.replace('-W', '-S')
  return key
}

// ─── Section wrapper for consistent spacing ──────────────────────────────────

function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-2">
      <h3 className="text-xs font-semibold text-slate-700 tracking-tight">{children}</h3>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function ChartCard({ children, title, sub, className = '' }: { children: React.ReactNode; title?: string; sub?: string; className?: string }) {
  return (
    <div className={`bg-white rounded-lg border border-slate-200/60 shadow-sm px-4 py-3 ${className}`}>
      {title && <SectionTitle sub={sub}>{title}</SectionTitle>}
      {children}
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div className="flex items-center justify-center h-36 text-slate-400 text-[11px] tracking-wide">{text}</div>
}

function detailToMapPoint(item: DetailItem): MapPoint {
  return {
    lat: 0, lng: 0,
    resultado: item.resultado_inspeccion || item.resultado,
    zona: item.zona,
    comuna: item.comuna,
    contratista: item.contratista_enel || item.contratista,
    vta: item.vta,
    cliente: item.cliente || item.nombre_cliente,
    inspector: item.inspector,
    tipo_trabajo: item.tipo_inspeccion || item.tipo_trabajo,
    multa: item.multa,
    causa: item.categoria_mal_ejecutado || item.causa,
    categoria_no_efectivo: item.categoria_no_efectivo,
    direccion: item.direccion,
    n_medidor: item.n_medidor,
    estado_efectividad: item.estado_efectividad,
    observaciones_multa: item.observaciones_multa,
    fecha: item.fecha_inspeccion || item.fecha,
    link_formulario: item.link_formulario,
  }
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NuevasConexionesPage() {
  const { isReportMode, setNormal } = useSidebar()
  const [selectedBase, setSelectedBase] = useState<string>('')
  const [bases, setBases] = useState<string[]>([])
  const [basesLoading, setBasesLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState(0)
  const [selectedZona, setSelectedZona] = useState<string>('')
  const [zonas, setZonas] = useState<string[]>([])

  const [overviewData, setOverviewData] = useState<OverviewData | null>(null)
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const [dashboardError, setDashboardError] = useState<string | null>(null)

  const [contratistaData, setContratistaData] = useState<ContratistaData | null>(null)

  const [causasData, setCausasData] = useState<CausasData | null>(null)

  const [drillFilters, setDrillFilters] = useState<DrillFilter[]>([])
  const [detailSearch, setDetailSearch] = useState('')
  const [detailPage, setDetailPage] = useState(1)
  const [detailData, setDetailData] = useState<DetailResponse | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [exportLoadingFormat, setExportLoadingFormat] = useState<'excel' | 'csv' | null>(null)

  const [mapaPoints, setMapaPoints] = useState<MapPoint[]>([])
  const [mapaLoading, setMapaLoading] = useState(false)

  const [kpiModalData, setKpiModalData] = useState<KpiModalData | null>(null)
  const [activeModal, setActiveModal] = useState<string | null>(null)

  const [malEjecutadosData, setMalEjecutadosData] = useState<MalEjecutadosData | null>(null)

  const [ocaData, setOcaData] = useState<OcaData | null>(null)

  const [selectedMapPoint, setSelectedMapPoint] = useState<MapPoint | null>(null)
  const [selectedContratista, setSelectedContratista] = useState<string | null>(null)
  const [showMedidoresCruzados, setShowMedidoresCruzados] = useState(false)
  // Map always shows only inspected records (with link_formulario)
  const [mapExpanded, setMapExpanded] = useState(false)
  const [tendenciaView, setTendenciaView] = useState<'mensual' | 'semanal' | 'diario'>('diario')
  const [ocaTendenciaView, setOcaTendenciaView] = useState<'mensual' | 'semanal' | 'diario'>('diario')
  const [selectedDay, setSelectedDay] = useState<string | null>(null) // YYYY-MM-DD for day detail modal
  const [mapCategoryFilter, setMapCategoryFilter] = useState<Set<MarkerCategory>>(() => new Set<MarkerCategory>(['bien', 'mal', 'no_efectiva', 'pendiente']))
  const [ejecucionStats, setEjecucionStats] = useState<EjecucionStats | null>(null)

  // ─── Data loaders ─────────────────────────────────────────────────────────

  useEffect(() => {
    async function loadInitial() {
      setBasesLoading(true)
      try {
        const [basesResponse, zonasData] = await Promise.all([
          api.get<{ bases: string[]; ultima_actualizacion: string | null } | string[]>('/api/v1/nuevas-conexiones/dashboard/bases'),
          api.get<string[]>('/api/v1/nuevas-conexiones/zonas'),
        ])
        // Support both old (string[]) and new ({ bases, ultima_actualizacion }) response format
        const basesData = Array.isArray(basesResponse) ? basesResponse : basesResponse.bases
        if (!Array.isArray(basesResponse) && basesResponse.ultima_actualizacion) {
          setLastUpdate(basesResponse.ultima_actualizacion)
        }
        setBases(basesData)
        setZonas(zonasData)
        if (basesData.length > 0) setSelectedBase(basesData[basesData.length - 1])
      } catch { setBases([]); setZonas([]) }
      finally { setBasesLoading(false) }
    }
    loadInitial()
  }, [])

  // ─── Data loading (depends directly on selectedBase) ──────────────────────

  const loadDashboard = useCallback(async (base: string) => {
    setDashboardLoading(true); setDashboardError(null)
    try {
      const params: Record<string, string> = {}
      if (base) params.base = base
      const all = await api.get<{
        overview: OverviewData
        contratistas: ContratistaData
        causas: CausasData
        kpi_modals: KpiModalData
        mal_ejecutados: MalEjecutadosData
        oca: OcaData
      }>('/api/v1/nuevas-conexiones/dashboard/all', params, { noCache: true })
      setOverviewData(all.overview)
      setContratistaData(all.contratistas)
      setCausasData(all.causas)
      setKpiModalData(all.kpi_modals)
      setMalEjecutadosData(all.mal_ejecutados)
      setOcaData(all.oca)
      // Load ejecucion stats (non-blocking)
      if (base) {
        api.get<EjecucionStats>('/api/v1/nuevas-conexiones/dashboard/ejecucion-stats', { base })
          .then(setEjecucionStats)
          .catch(() => setEjecucionStats(null))
      } else {
        setEjecucionStats(null)
      }
    } catch (e: unknown) { setDashboardError(e instanceof Error ? e.message : 'Error al cargar') }
    finally { setDashboardLoading(false) }
  }, [])

  const loadMapaData = useCallback(async (base: string) => {
    setMapaLoading(true)
    try {
      const params: Record<string, string> = {}
      if (base) params.base = base
      setMapaPoints(await api.get<MapPoint[]>('/api/v1/nuevas-conexiones/dashboard/mapa', params, { noCache: true }))
    } catch { setMapaPoints([]) }
    finally { setMapaLoading(false) }
  }, [])

  // Split "resultado" drill filter: "No Efectiva" goes to estado_efectividad, the rest to resultado_inspeccion
  const applyDrillFilters = useCallback((params: Record<string, string | number>) => {
    drillFilters.forEach((f) => {
      if (f.key === 'resultado') {
        const vals = f.value.split(',').map(v => v.trim()).filter(Boolean)
        const estadoVals = vals.filter(v => v.toLowerCase().includes('efectiva'))
        const resultadoVals = vals.filter(v => !v.toLowerCase().includes('efectiva'))
        if (resultadoVals.length) params.resultado = resultadoVals.join(',')
        if (estadoVals.length) params.estado = estadoVals.join(',')
      } else {
        params[f.key] = f.value
      }
    })
  }, [drillFilters])

  const loadDetail = useCallback(async () => {
    setDetailLoading(true)
    try {
      const params: Record<string, string | number> = { page: detailPage, limit: 20 }
      if (selectedBase) params.base = selectedBase
      if (selectedZona) params.zona = selectedZona
      if (detailSearch) params.search = detailSearch
      applyDrillFilters(params)
      setDetailData(await api.get<DetailResponse>('/api/v1/nuevas-conexiones/', params))
    } catch { setDetailData(null) }
    finally { setDetailLoading(false) }
  }, [selectedBase, selectedZona, detailPage, detailSearch, applyDrillFilters])

  // ─── Effects ──────────────────────────────────────────────────────────────

  // Reload ALL data when base changes — direct dependency, no indirection
  useEffect(() => {
    if (!basesLoading) {
      loadDashboard(selectedBase)
      loadMapaData(selectedBase)
    }
  }, [selectedBase, basesLoading, loadDashboard, loadMapaData])

  // Detail tab loads separately (depends on page/filters)
  useEffect(() => { if (!basesLoading && activeTab === 4) loadDetail() }, [loadDetail, basesLoading, activeTab])
  useEffect(() => { setDetailPage(1) }, [selectedBase, selectedZona, detailSearch, drillFilters])

  // ─── Drill-through ────────────────────────────────────────────────────────

  const addDrillFilter = useCallback((key: string, label: string, value: string) => {
    setDrillFilters((prev) => {
      const existing = prev.find((f) => f.key === key)
      if (existing) return prev.map((f) => (f.key === key ? { key, label, value } : f))
      return [...prev, { key, label, value }]
    })
    setActiveTab(4)
  }, [])

  const removeDrillFilter = useCallback((key: string) => { setDrillFilters((prev) => prev.filter((f) => f.key !== key)) }, [])
  const clearAllFilters = useCallback(() => { setDrillFilters([]); setDetailSearch('') }, [])

  const handleExport = useCallback(async (format: 'excel' | 'csv') => {
    setExportLoading(true); setExportLoadingFormat(format)
    try {
      const params: Record<string, string | number> = {}
      if (selectedBase) params.base = selectedBase
      applyDrillFilters(params)
      if (detailSearch) params.search = detailSearch
      await api.downloadFile('/api/v1/nuevas-conexiones/export', `nuevas-conexiones.${format === 'excel' ? 'xlsx' : 'csv'}`, { ...params, format })
    } finally { setExportLoading(false); setExportLoadingFormat(null) }
  }, [selectedBase, applyDrillFilters, detailSearch])

  // ─── Deltas vs previous period ─────────────────────────────────────────
  const deltas = useMemo(() => {
    const t = overviewData?.tendencia_temporal
    if (!t || t.length < 2) return null
    const curr = t[t.length - 1]
    const prev = t[t.length - 2]
    const prevTasa = prev.tasa_mal
    const currTasa = curr.tasa_mal
    return {
      tasa_mal: currTasa - prevTasa,
      periodo: curr.periodo,
    }
  }, [overviewData])

  // Filter map points with medidores cruzados findings
  const medidoresCruzadosPoints = useMemo(() => {
    return mapaPoints.filter(p => p.causa && p.causa.toUpperCase().includes('CRUZADO'))
  }, [mapaPoints])

  // ─── Zona-filtered data (computed client-side from mapa points) ──────────

  const zonaContratistaData = useMemo<ContratistaData | null>(() => {
    if (!selectedZona) return contratistaData
    const pts = mapaPoints.filter(p => p.zona === selectedZona)
    if (!pts.length) return contratistaData
    const byC = new Map<string, { insp: number; mal: number; multas: number }>()
    for (const p of pts) {
      const c = p.contratista || 'Sin contratista'
      const e = byC.get(c) || { insp: 0, mal: 0, multas: 0 }
      e.insp++
      if (p.resultado?.toUpperCase().includes('MAL')) e.mal++
      if (p.multa?.toUpperCase() === 'SI') e.multas++
      byC.set(c, e)
    }
    const ranking = Array.from(byC.entries()).map(([contratista, s]) => ({
      contratista,
      inspecciones: s.insp,
      mal_ejecutado: s.mal,
      tasa_mal: s.insp > 0 ? (s.mal / s.insp) * 100 : 0,
      multas: s.multas,
      tasa_multas: s.insp > 0 ? (s.multas / s.insp) * 100 : 0,
      pend_norm: 0,
      tasa_cierre: 0,
    })).sort((a, b) => b.tasa_mal - a.tasa_mal)
    return {
      ranking_contratistas: ranking,
      scatter_contratistas: ranking.map(r => ({ contratista: r.contratista, volumen: r.inspecciones, tasa_mal: r.tasa_mal, multas: r.multas })),
    }
  }, [selectedZona, mapaPoints, contratistaData])

  const zonaMalEjecutadosData = useMemo<MalEjecutadosData | null>(() => {
    if (!selectedZona) return malEjecutadosData
    const pts = mapaPoints.filter(p => p.zona === selectedZona)
    if (!pts.length) return malEjecutadosData
    const malPts = pts.filter(p => p.resultado?.toUpperCase().includes('MAL'))
    const totalMal = malPts.length
    if (totalMal === 0) return { total_mal: 0, causas_individuales: [], causas_por_zona: [], causas_por_contratista: [], mal_por_mes: [] }
    // Causas individuales (pipe-separated in causa field)
    const causaCounts = new Map<string, number>()
    for (const p of malPts) {
      const causas = (p.causa || '').split('|').map(c => c.trim()).filter(Boolean)
      for (const c of causas) causaCounts.set(c, (causaCounts.get(c) || 0) + 1)
    }
    const totalHallazgos = Array.from(causaCounts.values()).reduce((a, b) => a + b, 0)
    let acum = 0
    const causasInd = Array.from(causaCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([causa, cantidad]) => {
        acum += cantidad
        return { causa, cantidad, pct: totalHallazgos > 0 ? (cantidad / totalHallazgos) * 100 : 0, acumulado_pct: totalHallazgos > 0 ? (acum / totalHallazgos) * 100 : 0 }
      })
    // Por contratista
    const byC = new Map<string, Map<string, number>>()
    for (const p of malPts) {
      const c = p.contratista || 'Sin contratista'
      if (!byC.has(c)) byC.set(c, new Map())
      const causas = (p.causa || '').split('|').map(s => s.trim()).filter(Boolean)
      for (const ca of causas) byC.get(c)!.set(ca, (byC.get(c)!.get(ca) || 0) + 1)
    }
    const causasPorContratista = Array.from(byC.entries()).map(([contratista, cm]) => ({
      contratista,
      total_mal: malPts.filter(p => (p.contratista || 'Sin contratista') === contratista).length,
      causas: Array.from(cm.entries()).sort((a, b) => b[1] - a[1]).map(([causa, cantidad]) => ({ causa, cantidad })),
    })).sort((a, b) => b.total_mal - a.total_mal)
    return {
      total_mal: totalMal,
      causas_individuales: causasInd,
      causas_por_zona: [{ zona: selectedZona, total_mal: totalMal, causas: causasInd.slice(0, 5).map(c => ({ causa: c.causa, cantidad: c.cantidad })) }],
      causas_por_contratista: causasPorContratista,
      mal_por_mes: [],
    }
  }, [selectedZona, mapaPoints, malEjecutadosData])

  // Zona-filtered tendencia temporal (derived from mapaPoints)
  // When view is 'mensual' and no zona selected, use pre-calculated backend data
  const zonaTendencia = useMemo(() => {
    if (!selectedZona && tendenciaView === 'mensual') return overviewData?.tendencia_temporal ?? []
    // For semanal/diario or zona-filtered: compute from mapaPoints
    const pts = selectedZona
      ? mapaPoints.filter(p => p.zona === selectedZona && p.fecha)
      : mapaPoints.filter(p => p.fecha)
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
  }, [selectedZona, mapaPoints, overviewData, tendenciaView])

  // Last inspection date (for "Actualizado al" label)
  const lastInspectionDate = useMemo(() => {
    const pts = selectedZona ? mapaPoints.filter(p => p.zona === selectedZona) : mapaPoints
    let max = ''
    for (const p of pts) {
      if (p.fecha && p.fecha > max) max = p.fecha
    }
    if (!max) return null
    const [y, m, d] = max.slice(0, 10).split('-')
    return `${d}/${m}/${y}`
  }, [mapaPoints, selectedZona])

  // Zona-filtered top comunas problematicas (derived from mapaPoints)
  const zonaTopComunas = useMemo(() => {
    if (!selectedZona) return overviewData?.top_comunas_problemas ?? []
    const pts = mapaPoints.filter(p => p.zona === selectedZona)
    if (!pts.length) return []
    const byComuna = new Map<string, { total: number; mal: number }>()
    for (const p of pts) {
      const c = p.comuna || 'Sin comuna'
      const e = byComuna.get(c) || { total: 0, mal: 0 }
      e.total++
      if (p.resultado?.toUpperCase().includes('MAL')) e.mal++
      byComuna.set(c, e)
    }
    return Array.from(byComuna.entries())
      .map(([comuna, s]) => ({
        comuna,
        total: s.total,
        mal_ejecutado: s.mal,
        tasa_mal: s.total > 0 ? Math.round((s.mal / s.total) * 10000) / 100 : 0,
      }))
      .filter(c => c.mal_ejecutado > 0)
      .sort((a, b) => b.tasa_mal - a.tasa_mal)
      .slice(0, 5)
  }, [selectedZona, mapaPoints, overviewData])

  // ─── Chart options ────────────────────────────────────────────────────────

  const tendenciaOption = useMemo(() => {
    if (!zonaTendencia.length) return {}
    const d = zonaTendencia
    const lastIdx = d.length - 1
    return {
      tooltip: { ...TOOLTIP_STYLE, trigger: 'axis' as const, axisPointer: { type: 'cross' as const, crossStyle: { color: '#94a3b8' } } },
      legend: { ...LEGEND_STYLE, data: ['Total', 'Mal Ejecutado', '% Tasa Mal'] },
      grid: { ...GRID_STYLE, bottom: tendenciaView === 'diario' && d.length > 30 ? 68 : GRID_STYLE.bottom },
      xAxis: { type: 'category' as const, data: d.map(i => formatPeriodLabel(i.periodo, tendenciaView)), ...CATEGORY_AXIS, axisLabel: { ...CATEGORY_AXIS.axisLabel, rotate: tendenciaView === 'diario' ? 45 : 0 } },
      yAxis: [
        { type: 'value' as const, ...AXIS_STYLE, nameTextStyle: { fontSize: 10, color: '#94a3b8' } },
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
  }, [zonaTendencia, tendenciaView])

  const zonaOption = useMemo(() => {
    if (!overviewData?.resultado_por_zona?.length) return {}
    const d = overviewData.resultado_por_zona
    return {
      tooltip: { ...TOOLTIP_STYLE, trigger: 'axis' as const, axisPointer: { type: 'shadow' as const } },
      legend: { ...LEGEND_STYLE, data: ['Bien', 'Mal', 'Otros'] },
      grid: GRID_STYLE,
      xAxis: { type: 'value' as const, ...AXIS_STYLE },
      yAxis: { type: 'category' as const, data: d.map(i => i.zona), ...CATEGORY_AXIS },
      series: [
        { name: 'Bien', type: 'bar' as const, stack: 'total', data: d.map(i => ({ value: i.bien, itemStyle: { opacity: !selectedZona || selectedZona === i.zona ? 1 : 0.25 } })), itemStyle: { color: CHART_COLORS.success } },
        { name: 'Mal', type: 'bar' as const, stack: 'total', data: d.map(i => ({ value: i.mal, itemStyle: { opacity: !selectedZona || selectedZona === i.zona ? 1 : 0.25 } })), itemStyle: { color: CHART_COLORS.danger } },
        { name: 'Otros', type: 'bar' as const, stack: 'total', data: d.map(i => ({ value: i.pendiente, itemStyle: { opacity: !selectedZona || selectedZona === i.zona ? 1 : 0.25 } })), itemStyle: { color: CHART_COLORS.muted } },
      ],
    }
  }, [overviewData, selectedZona])

  // Tendencia chart click — only active in diario view
  const tendenciaEvents = useMemo(() => {
    if (tendenciaView !== 'diario') return undefined
    return {
      click: (p: { dataIndex?: number }) => {
        if (p.dataIndex == null || !zonaTendencia[p.dataIndex]) return
        setSelectedDay(zonaTendencia[p.dataIndex].periodo)
      },
    }
  }, [tendenciaView, zonaTendencia])

  // Points for the selected day modal
  const selectedDayPoints = useMemo(() => {
    if (!selectedDay) return []
    const pts = selectedZona
      ? mapaPoints.filter(p => p.zona === selectedZona)
      : mapaPoints
    return pts.filter(p => p.fecha?.startsWith(selectedDay))
  }, [selectedDay, mapaPoints, selectedZona])

  const zonaEvents = useMemo(() => ({
    click: (p: { name?: string }) => {
      if (p.name) setSelectedZona((prev) => prev === p.name ? '' : p.name!)
    },
  }), [])

  const topComunasOption = useMemo(() => {
    if (!zonaTopComunas.length) return {}
    const d = [...zonaTopComunas].sort((a, b) => b.tasa_mal - a.tasa_mal).slice(0, 5)
    return {
      tooltip: { ...TOOLTIP_STYLE, trigger: 'axis' as const, formatter: (p: Array<{ name: string; value: number }>) => `${p[0].name}: ${p[0].value.toFixed(1)}%` },
      grid: { left: 12, right: 24, bottom: 12, top: 12, containLabel: true },
      xAxis: { type: 'value' as const, ...AXIS_STYLE, axisLabel: { ...AXIS_STYLE.axisLabel, formatter: '{value}%' }, max: 100 },
      yAxis: { type: 'category' as const, data: d.map(i => i.comuna), ...CATEGORY_AXIS },
      series: [{
        type: 'bar' as const, barMaxWidth: 20,
        data: d.map(i => ({
          value: i.tasa_mal,
          itemStyle: { color: i.tasa_mal >= 50 ? CHART_COLORS.danger : i.tasa_mal >= 30 ? CHART_COLORS.warning : CHART_COLORS.primary, borderRadius: BAR_RADIUS_H },
        })),
        label: { show: true, position: 'right' as const, formatter: '{c}%', fontSize: 10, color: '#64748b' },
      }],
    }
  }, [zonaTopComunas])

  const comunaEvents = useMemo(() => ({
    click: (p: { name?: string }) => { if (p.name) addDrillFilter('comuna', 'Comuna', p.name) },
  }), [addDrillFilter])

  const scatterOption = useMemo(() => {
    if (!zonaContratistaData?.scatter_contratistas?.length) return {}
    const d = zonaContratistaData.scatter_contratistas
    const avgVolumen = d.reduce((s, i) => s + i.volumen, 0) / d.length
    return {
      tooltip: {
        ...TOOLTIP_STYLE,
        formatter: (p: { data?: { name?: string; value?: number[] }; name?: string; value?: number[] }) => {
          const v = p.value ?? p.data?.value ?? []; const n = p.name ?? p.data?.name ?? ''
          return `<strong>${n}</strong><br/>Volumen: ${v[0] ?? 0}<br/>Tasa mal: ${(v[1] ?? 0).toFixed(1)}%<br/>Multas: ${v[2] ?? 0}`
        },
      },
      grid: { ...GRID_STYLE, left: 40 },
      xAxis: {
        name: 'Volumen', type: 'value' as const, ...AXIS_STYLE, nameTextStyle: { fontSize: 10, color: '#94a3b8' },
        axisLabel: { ...AXIS_STYLE.axisLabel },
      },
      yAxis: { name: '% Tasa Mal', type: 'value' as const, ...AXIS_STYLE, axisLabel: { ...AXIS_STYLE.axisLabel, formatter: '{value}%' }, nameTextStyle: { fontSize: 10, color: '#94a3b8' } },
      series: [{
        type: 'scatter' as const,
        data: d.map((i, idx) => ({
          name: i.contratista,
          value: [i.volumen, i.tasa_mal, i.multas],
          symbolSize: Math.max(8, Math.min(36, i.multas * 3 + 8)),
          itemStyle: { color: CONTRATISTA_COLORS[idx % CONTRATISTA_COLORS.length], opacity: 0.8 },
        })),
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { width: 1 },
          label: { fontSize: 10, color: '#94a3b8' },
          data: [
            { yAxis: 30, lineStyle: { type: 'dashed' as const, color: CHART_COLORS.danger, opacity: 0.5 }, label: { formatter: '30% riesgo', position: 'insideEndTop' as const } },
            { xAxis: avgVolumen, lineStyle: { type: 'dashed' as const, color: '#94a3b8' }, label: { formatter: 'Prom. vol.', position: 'insideEndTop' as const } },
          ],
        },
      }],
    }
  }, [zonaContratistaData])

  const scatterEvents = useMemo(() => ({
    click: (p: { data?: { name?: string } }) => { if (p.data?.name) setSelectedContratista(p.data.name) },
  }), [])

  const topContratistaBarOption = useMemo(() => {
    if (!zonaContratistaData?.ranking_contratistas?.length) return {}
    const d = [...zonaContratistaData.ranking_contratistas].sort((a, b) => b.tasa_mal - a.tasa_mal).slice(0, 10)
    return {
      tooltip: { ...TOOLTIP_STYLE, trigger: 'axis' as const, formatter: (p: Array<{ name: string; value: number }>) => `${p[0].name}: ${p[0].value.toFixed(1)}%` },
      grid: { left: 12, right: 32, bottom: 12, top: 12, containLabel: true },
      xAxis: { type: 'value' as const, ...AXIS_STYLE, axisLabel: { ...AXIS_STYLE.axisLabel, formatter: '{value}%' } },
      yAxis: { type: 'category' as const, data: d.map(i => i.contratista), ...CATEGORY_AXIS, axisLabel: { fontSize: 10, color: '#64748b', width: 120, overflow: 'truncate' as const } },
      series: [{
        type: 'bar' as const, barMaxWidth: 20,
        data: d.map(i => ({
          value: i.tasa_mal,
          itemStyle: { color: i.tasa_mal >= 40 ? CHART_COLORS.danger : i.tasa_mal >= 20 ? CHART_COLORS.warning : CHART_COLORS.secondary, borderRadius: BAR_RADIUS_H },
        })),
        label: { show: true, position: 'right' as const, formatter: '{c}%', fontSize: 10, color: '#64748b' },
      }],
    }
  }, [zonaContratistaData])

  const contratistaBarEvents = useMemo(() => ({
    click: (p: { name?: string }) => { if (p.name) setSelectedContratista(p.name) },
  }), [])

  const causasPorContratistaOption = useMemo(() => {
    const cpc = zonaMalEjecutadosData?.causas_por_contratista
    if (!cpc?.length) return null
    const sorted = [...cpc].sort((a, b) => b.total_mal - a.total_mal)
    const top8 = sorted.slice(0, sorted.length)
    // Collect all unique causa names across top 8
    const allCausas = new Map<string, number>()
    for (const c of top8) {
      for (const ca of c.causas) allCausas.set(ca.causa, (allCausas.get(ca.causa) || 0) + ca.cantidad)
    }
    const topCausas = Array.from(allCausas.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c]) => c)
    const causaColors: Record<string, string> = {
      [topCausas[0] || '']: CHART_COLORS.danger,
      [topCausas[1] || '']: CHART_COLORS.warning,
      [topCausas[2] || '']: CHART_COLORS.primary,
    }
    const seriesNames = [...topCausas, 'Otras']
    const contratistas = top8.map(c => c.contratista)
    const series = seriesNames.map(name => ({
      name: name.replace(/_/g, ' '),
      type: 'bar' as const,
      stack: 'total',
      barMaxWidth: 18,
      itemStyle: {
        color: name === 'Otras' ? CHART_COLORS.muted : (causaColors[name] || CHART_COLORS.muted),
        borderRadius: name === seriesNames[seriesNames.length - 1] ? BAR_RADIUS_H : ([0, 0, 0, 0] as [number, number, number, number]),
      },
      data: top8.map(c => {
        if (name === 'Otras') {
          const topTotal = c.causas.filter(ca => topCausas.includes(ca.causa)).reduce((s, ca) => s + ca.cantidad, 0)
          return Math.max(0, c.total_mal - topTotal)
        }
        return c.causas.find(ca => ca.causa === name)?.cantidad || 0
      }),
    }))
    return {
      tooltip: { ...TOOLTIP_STYLE, trigger: 'axis' as const },
      legend: { ...LEGEND_STYLE, data: seriesNames.map(n => n.replace(/_/g, ' ')) },
      grid: { left: 8, right: 20, bottom: 28, top: 8, containLabel: true },
      xAxis: { type: 'value' as const, ...AXIS_STYLE },
      yAxis: { type: 'category' as const, data: contratistas, ...CATEGORY_AXIS, axisLabel: { fontSize: 10, color: '#64748b', width: 120, overflow: 'truncate' as const } },
      series,
    }
  }, [zonaMalEjecutadosData])

  const paretoOption = useMemo(() => {
    // Use zona-filtered causas when a zona is selected, otherwise backend data
    const d = selectedZona && zonaMalEjecutadosData?.causas_individuales?.length
      ? zonaMalEjecutadosData.causas_individuales
      : causasData?.pareto_causas
    if (!d?.length) return {}
    return {
      tooltip: { ...TOOLTIP_STYLE, trigger: 'axis' as const, axisPointer: { type: 'cross' as const } },
      legend: { ...LEGEND_STYLE, data: ['Cantidad', '% Acumulado'] },
      grid: GRID_STYLE,
      xAxis: { type: 'category' as const, data: d.map(i => i.causa), ...CATEGORY_AXIS, axisLabel: { rotate: 30, fontSize: 10, color: '#64748b', interval: 0 } },
      yAxis: [
        { type: 'value' as const, ...AXIS_STYLE },
        { type: 'value' as const, ...AXIS_STYLE, min: 0, max: 100, axisLabel: { ...AXIS_STYLE.axisLabel, formatter: '{value}%' } },
      ],
      series: [
        { name: 'Cantidad', type: 'bar' as const, data: d.map(i => i.cantidad), itemStyle: { color: CHART_COLORS.primary, borderRadius: BAR_RADIUS }, barMaxWidth: 32 },
        {
          name: '% Acumulado', type: 'line' as const, yAxisIndex: 1, data: d.map(i => i.acumulado_pct),
          smooth: true, lineStyle: { color: CHART_COLORS.warning, width: 2 }, itemStyle: { color: CHART_COLORS.warning }, showSymbol: false,
          markLine: { data: [{ yAxis: 80, lineStyle: { type: 'dashed' as const, color: '#cbd5e1' } }], label: { formatter: '80%', fontSize: 10, color: '#94a3b8' } },
        },
      ],
    }
  }, [causasData, selectedZona, zonaMalEjecutadosData])

  const trabajosMalOption = useMemo(() => {
    if (!causasData?.trabajos_tipicamente_mal?.length) return {}
    const d = [...causasData.trabajos_tipicamente_mal].sort((a, b) => b.tasa_mal - a.tasa_mal).slice(0, 10)
    return {
      tooltip: { ...TOOLTIP_STYLE, trigger: 'axis' as const },
      legend: { ...LEGEND_STYLE, data: ['Total', 'Mal Ejecutado'] },
      grid: { left: 12, right: 40, bottom: 40, top: 12, containLabel: true },
      xAxis: { type: 'value' as const, ...AXIS_STYLE },
      yAxis: { type: 'category' as const, data: d.map(i => i.tipo_trabajo), ...CATEGORY_AXIS, axisLabel: { fontSize: 10, color: '#64748b', width: 130, overflow: 'truncate' as const } },
      series: [
        { name: 'Total', type: 'bar' as const, data: d.map(i => i.total), itemStyle: { color: CHART_COLORS.primary } },
        { name: 'Mal Ejecutado', type: 'bar' as const, data: d.map(i => i.mal_ejecutado), itemStyle: { color: CHART_COLORS.danger } },
      ],
    }
  }, [causasData])

  // ─── OCA: zona-filtered data ─────────────────────────────────────────────
  const zonaOcaData = useMemo<OcaData | null>(() => {
    if (!ocaData) return null
    if (!selectedZona) return ocaData
    return {
      ranking_inspectores: ocaData.ranking_inspectores.filter(r => r.zonas.includes(selectedZona)),
      efectividad_por_zona: ocaData.efectividad_por_zona.filter(z => z.zona === selectedZona),
      tendencia_efectividad: ocaData.tendencia_efectividad,
    }
  }, [ocaData, selectedZona])

  // OCA tendencia computed from mapaPoints for semanal/diario, backend for mensual
  const zonaOcaTendencia = useMemo(() => {
    if (ocaTendenciaView === 'mensual') return ocaData?.tendencia_efectividad ?? []
    const pts = mapaPoints.filter(p => p.fecha && p.estado_efectividad)
    if (!pts.length) return []
    const byPeriod = new Map<string, { total: number; efectivas: number }>()
    for (const p of pts) {
      const key = getPeriodKey(p.fecha!, ocaTendenciaView)
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
  }, [ocaTendenciaView, mapaPoints, ocaData])

  // ─── OCA chart options ─────────────────────────────────────────────────────
  const tendenciaEfectividadOption = useMemo(() => {
    if (!zonaOcaTendencia.length) return {}
    const d = zonaOcaTendencia
    return {
      tooltip: { ...TOOLTIP_STYLE, trigger: 'axis' as const, axisPointer: { type: 'cross' as const } },
      legend: { ...LEGEND_STYLE, data: ['Total Inspeccionadas', 'Efectivas', '% Efectividad'] },
      grid: { ...GRID_STYLE, bottom: ocaTendenciaView === 'diario' && d.length > 30 ? 68 : GRID_STYLE.bottom },
      xAxis: { type: 'category' as const, data: d.map(i => formatPeriodLabel(i.periodo, ocaTendenciaView)), ...CATEGORY_AXIS, axisLabel: { ...CATEGORY_AXIS.axisLabel, rotate: ocaTendenciaView === 'diario' ? 45 : 0 } },
      yAxis: [
        { type: 'value' as const, ...AXIS_STYLE },
        { type: 'value' as const, ...AXIS_STYLE, min: 0, max: 100, axisLabel: { ...AXIS_STYLE.axisLabel, formatter: '{value}%' } },
      ],
      dataZoom: ocaTendenciaView === 'diario' && d.length > 30 ? [
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
  }, [zonaOcaTendencia, ocaTendenciaView])

  const efectividadZonaOption = useMemo(() => {
    const data = zonaOcaData?.efectividad_por_zona
    if (!data?.length) return {}
    const d = [...data].sort((a, b) => a.tasa_efectividad - b.tasa_efectividad)
    return {
      tooltip: { ...TOOLTIP_STYLE, trigger: 'axis' as const, formatter: (p: Array<{ name: string; value: number }>) => `${p[0].name}: ${p[0].value.toFixed(1)}%` },
      grid: { left: 12, right: 32, bottom: 12, top: 12, containLabel: true },
      xAxis: { type: 'value' as const, ...AXIS_STYLE, axisLabel: { ...AXIS_STYLE.axisLabel, formatter: '{value}%' }, max: 100 },
      yAxis: { type: 'category' as const, data: d.map(i => i.zona), ...CATEGORY_AXIS },
      series: [{
        type: 'bar' as const, barMaxWidth: 20,
        data: d.map(i => ({
          value: i.tasa_efectividad,
          itemStyle: { color: i.tasa_efectividad >= 80 ? CHART_COLORS.success : i.tasa_efectividad >= 50 ? CHART_COLORS.warning : CHART_COLORS.danger, borderRadius: BAR_RADIUS_H },
        })),
        label: { show: true, position: 'right' as const, formatter: '{c}%', fontSize: 10, color: '#64748b' },
      }],
    }
  }, [zonaOcaData])

  const inspectorScatterOption = useMemo(() => {
    const ranking = zonaOcaData?.ranking_inspectores
    if (!ranking?.length) return {}
    const avgVol = ranking.reduce((s, r) => s + r.inspecciones, 0) / ranking.length
    return {
      tooltip: {
        ...TOOLTIP_STYLE,
        formatter: (p: { data?: { name?: string; value?: number[] } }) => {
          const v = p.data?.value ?? []; const n = p.data?.name ?? ''
          return `<strong>${n}</strong><br/>Inspecciones: ${v[0] ?? 0}<br/>Efectividad: ${(v[1] ?? 0).toFixed(1)}%`
        },
      },
      grid: { ...GRID_STYLE, left: 40 },
      xAxis: { name: 'Volumen', type: 'value' as const, ...AXIS_STYLE, nameTextStyle: { fontSize: 10, color: '#94a3b8' } },
      yAxis: { name: '% Efectividad', type: 'value' as const, ...AXIS_STYLE, min: 0, max: 100, axisLabel: { ...AXIS_STYLE.axisLabel, formatter: '{value}%' }, nameTextStyle: { fontSize: 10, color: '#94a3b8' } },
      series: [{
        type: 'scatter' as const,
        data: ranking.map(r => ({
          name: r.inspector,
          value: [r.inspecciones, r.tasa_efectividad],
          symbolSize: Math.max(8, Math.min(30, r.inspecciones / 10 + 6)),
          itemStyle: { color: r.tasa_efectividad >= 80 ? CHART_COLORS.success : r.tasa_efectividad >= 50 ? CHART_COLORS.warning : CHART_COLORS.danger, opacity: 0.75 },
        })),
        markLine: {
          silent: true, symbol: 'none',
          lineStyle: { width: 1 },
          label: { fontSize: 10, color: '#94a3b8' },
          data: [
            { yAxis: 80, lineStyle: { type: 'dashed' as const, color: CHART_COLORS.success, opacity: 0.5 }, label: { formatter: '80% meta', position: 'insideEndTop' as const } },
            { xAxis: avgVol, lineStyle: { type: 'dashed' as const, color: '#94a3b8' }, label: { formatter: 'Prom. vol.', position: 'insideEndTop' as const } },
          ],
        },
      }],
    }
  }, [zonaOcaData])

  const topInspectoresBarOption = useMemo(() => {
    const ranking = zonaOcaData?.ranking_inspectores
    if (!ranking?.length) return {}
    const d = [...ranking].sort((a, b) => b.inspecciones - a.inspecciones).slice(0, 10)
    return {
      tooltip: {
        ...TOOLTIP_STYLE, trigger: 'axis' as const,
        formatter: (p: Array<{ name: string; value: number; dataIndex: number }>) => {
          const idx = p[0].dataIndex
          return `${p[0].name}: ${p[0].value} insp. (${pct(d[idx].tasa_efectividad)} efect.)`
        },
      },
      grid: { left: 12, right: 32, bottom: 12, top: 12, containLabel: true },
      xAxis: { type: 'value' as const, ...AXIS_STYLE },
      yAxis: { type: 'category' as const, data: d.map(i => i.inspector), ...CATEGORY_AXIS, axisLabel: { fontSize: 10, color: '#64748b', width: 120, overflow: 'truncate' as const } },
      series: [{
        type: 'bar' as const, barMaxWidth: 20,
        data: d.map(i => ({
          value: i.inspecciones,
          itemStyle: { color: i.tasa_efectividad >= 80 ? CHART_COLORS.success : i.tasa_efectividad >= 50 ? CHART_COLORS.warning : CHART_COLORS.danger, borderRadius: BAR_RADIUS_H },
        })),
        label: { show: true, position: 'right' as const, formatter: (p: { dataIndex: number }) => `${pct(d[p.dataIndex].tasa_efectividad)}`, fontSize: 10, color: '#64748b' },
      }],
    }
  }, [zonaOcaData])

  // ─── No Efectivos Pareto chart ───────────────────────────────────────────
  const noEfectivosData = ocaData?.no_efectivos_analysis

  const noEfectivosOption = useMemo(() => {
    const cats = noEfectivosData?.categorias
    if (!cats?.length) return {}
    return {
      tooltip: { ...TOOLTIP_STYLE, trigger: 'axis' as const, axisPointer: { type: 'cross' as const } },
      legend: { ...LEGEND_STYLE, data: ['Cantidad', '% Acumulado'] },
      grid: { ...GRID_STYLE, left: 12 },
      xAxis: { type: 'category' as const, data: cats.map(c => c.categoria.replace(/_/g, ' ')), ...CATEGORY_AXIS, axisLabel: { rotate: 35, fontSize: 9, color: '#64748b', interval: 0 } },
      yAxis: [
        { type: 'value' as const, ...AXIS_STYLE },
        { type: 'value' as const, ...AXIS_STYLE, min: 0, max: 100, axisLabel: { ...AXIS_STYLE.axisLabel, formatter: '{value}%' } },
      ],
      series: [
        { name: 'Cantidad', type: 'bar' as const, data: cats.map(c => c.cantidad), itemStyle: { color: CHART_COLORS.primary, borderRadius: BAR_RADIUS }, barMaxWidth: 28 },
        {
          name: '% Acumulado', type: 'line' as const, yAxisIndex: 1, data: cats.map(c => c.acumulado_pct),
          smooth: true, lineStyle: { color: CHART_COLORS.warning, width: 2 }, itemStyle: { color: CHART_COLORS.warning }, showSymbol: false,
          markLine: { data: [{ yAxis: 80, lineStyle: { type: 'dashed' as const, color: '#cbd5e1' } }], label: { formatter: '80%', fontSize: 10, color: '#94a3b8' } },
        },
      ],
    }
  }, [noEfectivosData])

  const noEfectivosPorContratistaOption = useMemo(() => {
    const d = noEfectivosData?.por_contratista
    if (!d?.length) return {}
    const top = d.slice(0, 8)
    return {
      tooltip: { ...TOOLTIP_STYLE, trigger: 'axis' as const },
      grid: { left: 8, right: 20, bottom: 8, top: 8, containLabel: true },
      xAxis: { type: 'value' as const, ...AXIS_STYLE },
      yAxis: { type: 'category' as const, data: top.map(c => c.contratista), ...CATEGORY_AXIS, axisLabel: { fontSize: 10, color: '#64748b', width: 120, overflow: 'truncate' as const } },
      series: [{
        type: 'bar' as const, barMaxWidth: 18,
        data: top.map(c => ({ value: c.total_no_efectivas, itemStyle: { color: CHART_COLORS.primary, borderRadius: BAR_RADIUS_H } })),
        label: { show: true, position: 'right' as const, fontSize: 10, color: '#64748b' },
      }],
    }
  }, [noEfectivosData])

  // Filter mapa points by zona + inspection status + category
  const filteredMapaPoints = useMemo(() => {
    let pts = mapaPoints.filter(p => p.link_formulario && p.link_formulario !== '' && p.link_formulario !== 'None' && p.link_formulario !== 'nan')
    if (selectedZona) pts = pts.filter(p => p.zona === selectedZona)
    if (mapCategoryFilter.size < 4) pts = pts.filter(p => mapCategoryFilter.has(getPointCategory(p)))
    return pts
  }, [mapaPoints, selectedZona, mapCategoryFilter])

  // KPIs: when a zona is selected, derive what we can from resultado_por_zona
  const kpis = useMemo(() => {
    if (!overviewData?.kpis) return undefined
    if (!selectedZona) return overviewData.kpis
    const zonaRow = overviewData.resultado_por_zona?.find(z => z.zona === selectedZona)
    if (!zonaRow) return overviewData.kpis
    const total = zonaRow.total
    const mal = zonaRow.mal
    const efectivas = zonaRow.efectivas
    const totalInsp = zonaRow.total_inspecciones
    const noEfectivas = totalInsp - efectivas
    return {
      ...overviewData.kpis,
      total_asignadas: total,
      total_inspecciones: totalInsp,
      total_efectivas: efectivas,
      num_mal_ejecutado: mal,
      pct_mal_ejecutado: efectivas > 0 ? (mal / efectivas) * 100 : 0,
      pct_avance: total > 0 ? (totalInsp / total) * 100 : 0,
      tasa_efectividad_oca: totalInsp > 0 ? (efectivas / totalInsp) * 100 : 0,
      pct_no_efectiva: totalInsp > 0 ? (noEfectivas / totalInsp) * 100 : 0,
    }
  }, [overviewData, selectedZona])

  // Sparkline data derived from tendencia_temporal (monthly pre-calculated)
  const sparklines = useMemo(() => {
    const t = overviewData?.tendencia_temporal
    if (!t || t.length < 2) return { tasaMal: [], multas: [], total: [] }
    return {
      tasaMal: t.map(p => p.tasa_mal),
      total: t.map(p => p.total),
      multas: t.map(p => p.mal_ejecutado),
    }
  }, [overviewData])

  // ─── Render ─────────────────────────────────────────────────────────────

  if (isReportMode) {
    return (
      <PresentationMode
        selectedBase={selectedBase}
        selectedZona={selectedZona || null}
        kpis={kpis ?? null}
        lastInspectionDate={lastInspectionDate}
        tendenciaOption={tendenciaOption}
        zonaOption={zonaOption}
        scatterOption={scatterOption}
        paretoOption={paretoOption}
        causasPorContratistaOption={causasPorContratistaOption}
        tendenciaEfectividadOption={tendenciaEfectividadOption}
        efectividadZonaOption={efectividadZonaOption}
        topInspectoresBarOption={topInspectoresBarOption}
        mapaPoints={mapaPoints}
        contratistaRanking={zonaContratistaData?.ranking_contratistas ?? []}
        malEjecutadosData={malEjecutadosData ?? null}
        tendenciaTemporal={overviewData?.tendencia_temporal ?? []}
        ocaTendenciaEfectividad={ocaData?.tendencia_efectividad ?? []}
        onExit={setNormal}
      />
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50/80">
      <Header title="Nuevas Conexiones (NNCC)" subtitle="Dashboard de inspecciones y resultados de ejecucion" lastUpdate={lastUpdate} />

      <main className="flex-1 px-4 py-3 space-y-3 max-w-[1600px] mx-auto w-full">
        {/* ── Global filter bar ── */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Base</span>
            <div className="w-52">
              {basesLoading ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-slate-200 bg-white text-xs text-slate-400">
                  <Loader2 size={13} className="animate-spin" /> Cargando...
                </div>
              ) : (
                <Select value={selectedBase} onValueChange={setSelectedBase} placeholder="Todas las bases">
                  <SelectItem value="">Todas las bases</SelectItem>
                  {bases.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </Select>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Zona</span>
            <div className="w-44">
              <Select value={selectedZona} onValueChange={setSelectedZona} placeholder="Todas las zonas">
                <SelectItem value="">Todas las zonas</SelectItem>
                {zonas.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}
              </Select>
            </div>
          </div>
          <div className="flex-1" />
          <button
            onClick={() => { api.clearCache(); loadDashboard(selectedBase); loadMapaData(selectedBase); if (activeTab === 4) loadDetail() }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-white border border-transparent hover:border-slate-200 transition-all"
          >
            <RefreshCw size={13} /> Actualizar
          </button>
        </div>

        {/* ── Tabs ── */}
        <TabGroup index={activeTab} onIndexChange={setActiveTab}>
          <TabList className="mb-0 border-b border-slate-200">
            <Tab>Resumen Ejecutivo</Tab>
            <Tab>Contratistas</Tab>
            <Tab>Mal Ejecutados</Tab>
            <Tab>OCA</Tab>
            <Tab>Detalle</Tab>
          </TabList>

          <TabPanels>
            {/* ═══ TAB A — Resumen Ejecutivo ═══ */}
            <TabPanel>
              {activeTab !== 0 ? null : dashboardLoading ? (
                <div className="flex items-center justify-center h-48"><Loader2 size={24} className="animate-spin text-slate-400" /></div>
              ) : dashboardError ? (
                <div className="bg-white rounded-lg border border-slate-200 p-8 text-center mt-3">
                  <AlertTriangle size={24} className="mx-auto text-red-500 mb-2" />
                  <p className="text-sm text-slate-600 font-medium">{dashboardError}</p>
                  <Button variant="secondary" size="sm" onClick={() => loadDashboard(selectedBase)} className="mt-3">Reintentar</Button>
                </div>
              ) : (
                <div className="space-y-3 mt-3">
                  {/* ── Fila 1: Hero KPIs — strategic risk indicators ── */}
                  <div className="bg-white rounded-lg border border-slate-200/60 shadow-sm overflow-hidden grid grid-cols-3 divide-x divide-slate-100">
                    <HeroKpi
                      label="Mal Ejecutado"
                      value={kpis ? pct(kpis.pct_mal_ejecutado) : '–'}
                      subtitle={`${formatNumber(kpis?.num_mal_ejecutado)} de ${formatNumber(kpis?.total_efectivas)} efectivas`}
                      delta={deltas?.tasa_mal}
                      meta="meta <15%"
                      status={(kpis?.pct_mal_ejecutado ?? 0) <= 15 ? 'good' : (kpis?.pct_mal_ejecutado ?? 0) <= 25 ? 'neutral' : 'bad'}
                      sparkData={sparklines.tasaMal}
                      onClick={() => setActiveModal('mal_ejecutado')}
                    />
                    <HeroKpi
                      label="Multas"
                      value={kpis?.num_multas_si ?? 0}
                      subtitle={kpis && kpis.total_efectivas ? `Tasa: ${pct((kpis.num_multas_si / kpis.total_efectivas) * 100)}` : undefined}
                      meta="meta 0"
                      status={(kpis?.num_multas_si ?? 0) > 0 ? 'bad' : 'good'}
                      sparkData={sparklines.multas}
                      onClick={() => setActiveModal('multas')}
                    />
                    <HeroKpi
                      label="Efectividad OCA"
                      value={kpis ? pct(kpis.tasa_efectividad_oca) : '–'}
                      meta="meta >85%"
                      status={(kpis?.tasa_efectividad_oca ?? 0) >= 85 ? 'good' : (kpis?.tasa_efectividad_oca ?? 0) >= 70 ? 'neutral' : 'bad'}
                      sparkData={sparklines.total}
                    />
                  </div>

                  {/* ── Fila 2: Operational + Hallazgos ── */}
                  <div className="bg-white rounded-lg border border-slate-200/60 shadow-sm overflow-hidden grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-100">
                    <FeatureKpi label="Asignadas" value={kpis?.total_asignadas ?? 0} subtitle={`Base: ${selectedBase || 'Todas'}`} onClick={() => setActiveModal('total')} />
                    <KpiCard label="Inspeccionadas" value={kpis?.total_inspecciones ?? 0} unit={kpis ? pct(kpis.pct_avance) : ''} sparkData={sparklines.total} />
                    {/* Avance + Ejecucion stats */}
                    <div className="px-4 py-3">
                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Avance</p>
                      {(() => {
                        const avanceVal = kpis?.pct_avance ?? 0
                        const level = avanceVal >= 80 ? 'good' : avanceVal >= 50 ? 'warning' : 'bad'
                        const barColor = level === 'good' ? 'bg-green-700' : level === 'warning' ? 'bg-amber-600' : 'bg-red-700'
                        const valueColor = level === 'good' ? 'text-green-700' : level === 'warning' ? 'text-amber-700' : 'text-red-700'
                        const ej = ejecucionStats
                        return (
                          <>
                            <p className={`text-lg font-semibold ${valueColor} mt-1 leading-none tracking-tight`}>
                              {kpis ? pct(avanceVal) : '–'}
                            </p>
                            <div className="mt-2 w-full bg-slate-100 rounded-full h-[3px] overflow-hidden">
                              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, avanceVal)}%` }} />
                            </div>
                            {ej && ej.fecha_envio && (
                              <div className="mt-2 space-y-0.5">
                                <p className="text-[10px] text-slate-500">
                                  {ej.completado
                                    ? `Completado en ${ej.dias_habiles} dias habiles`
                                    : `${ej.dias_habiles} dias habiles`
                                  }
                                  {' · '}{ej.promedio_diario_habil} insp/dia
                                </p>
                                {!ej.completado && ej.fecha_proyectada && (
                                  <p className="text-[10px] font-medium text-slate-600">
                                    Proyeccion: {new Date(ej.fecha_proyectada + 'T00:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  </p>
                                )}
                              </div>
                            )}
                          </>
                        )
                      })()}
                    </div>
                    <KpiCard
                      label="Medidores Cruzados"
                      value={kpis?.num_medidores_cruzados ?? 0}
                      subtitle="Hallazgo en inspección"
                      status={(kpis?.num_medidores_cruzados ?? 0) > 0 ? 'bad' : 'good'}
                      onClick={() => setShowMedidoresCruzados(true)}
                    />
                  </div>

                  {/* ── Fila 3: Tendencia + Resultado por Zona ── */}
                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
                    <div className="bg-white rounded-lg border border-slate-200/60 shadow-sm px-4 py-3 lg:col-span-3">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h3 className="text-xs font-semibold text-slate-700 tracking-tight">Tendencia Temporal</h3>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {selectedZona ? `${selectedZona} · ` : ''}{lastInspectionDate ? `Actualizado al ${lastInspectionDate}` : ''}{tendenciaView === 'diario' ? ' · Clic en barra para ver detalle' : ''}
                          </p>
                        </div>
                        <div className="flex gap-0.5 bg-slate-100 rounded p-0.5">
                          {(['mensual', 'semanal', 'diario'] as const).map(v => (
                            <button
                              key={v}
                              onClick={() => setTendenciaView(v)}
                              className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
                                tendenciaView === v
                                  ? 'bg-white text-slate-700 shadow-sm'
                                  : 'text-slate-400 hover:text-slate-600'
                              }`}
                            >
                              {v === 'mensual' ? 'Mes' : v === 'semanal' ? 'Sem' : 'Dia'}
                            </button>
                          ))}
                        </div>
                      </div>
                      {zonaTendencia.length ? <EChart option={tendenciaOption} height="260px" onEvents={tendenciaEvents} className={tendenciaView === 'diario' ? 'cursor-pointer' : ''} /> : <EmptyState text="Sin datos de tendencia" />}
                    </div>
                    <ChartCard title="Resultado por Zona" sub={selectedZona ? `${selectedZona} — clic para quitar` : 'Clic en zona para filtrar'} className="lg:col-span-2">
                      {overviewData?.resultado_por_zona?.length ? <EChart option={zonaOption} height="260px" onEvents={zonaEvents} /> : <EmptyState text="Sin datos por zona" />}
                    </ChartCard>
                  </div>

                  {/* ── Fila 4: Comunas + Mapa ── */}
                  <div className={mapExpanded ? '' : 'grid grid-cols-1 lg:grid-cols-3 gap-3'}>
                    {!mapExpanded && (
                      <ChartCard title="Top Comunas Problematicas" sub={selectedZona ? `${selectedZona} — clic en comuna para filtrar` : 'Clic en comuna para filtrar'}>
                        {zonaTopComunas.length ? <EChart option={topComunasOption} height="260px" onEvents={comunaEvents} /> : <EmptyState text="Sin datos" />}
                      </ChartCard>
                    )}
                    <div className={mapExpanded ? 'fixed inset-0 z-[900] bg-white p-4 flex flex-col' : 'lg:col-span-2'}>
                      <ChartCard className={mapExpanded ? 'flex-1 flex flex-col' : ''}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <h3 className="text-xs font-semibold text-slate-700">Mapa de Inspecciones</h3>
                            <p className="text-[10px] text-slate-400">
                              {filteredMapaPoints.length > 0 ? `${formatNumber(filteredMapaPoints.length)} puntos${selectedZona ? ` — ${selectedZona}` : ''}` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {([
                              ['bien', CATEGORY_COLORS.bien, 'Bien'],
                              ['mal', CATEGORY_COLORS.mal, 'Mal'],
                              ['no_efectiva', CATEGORY_COLORS.no_efectiva, 'No Efect.'],
                            ] as [MarkerCategory, string, string][]).map(([cat, color, label]) => {
                              const active = mapCategoryFilter.has(cat)
                              return (
                                <button
                                  key={cat}
                                  onClick={() => {
                                    const next = new Set(mapCategoryFilter)
                                    if (active) next.delete(cat); else next.add(cat)
                                    if (next.size === 0) next.add(cat)
                                    setMapCategoryFilter(next)
                                  }}
                                  className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-all ${active ? 'opacity-100' : 'opacity-30'}`}
                                >
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                                  <span className={active ? 'text-slate-600 font-medium' : 'text-slate-400'}>{label}</span>
                                </button>
                              )
                            })}
                            <span className="w-px h-4 bg-slate-200 mx-1" />
                            <button
                              onClick={() => setMapExpanded(!mapExpanded)}
                              className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                              title={mapExpanded ? 'Minimizar mapa' : 'Expandir mapa'}
                            >
                              {mapExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                            </button>
                          </div>
                        </div>
                        {mapaLoading ? (
                          <div className={`flex items-center justify-center bg-slate-50 rounded-lg ${mapExpanded ? 'flex-1' : 'h-[300px]'}`}><Loader2 size={18} className="animate-spin text-slate-400" /></div>
                        ) : filteredMapaPoints.length > 0 ? (
                          <div className={mapExpanded ? 'flex-1 min-h-0' : ''} style={mapExpanded ? { height: '100%' } : undefined}>
                            <LeafletMap points={filteredMapaPoints} height={mapExpanded ? 'calc(100vh - 140px)' : '300px'} onPointClick={(p) => setSelectedMapPoint(p)} />
                          </div>
                        ) : (
                          <div className={`flex items-center justify-center bg-slate-50 rounded-lg text-[11px] text-slate-400 ${mapExpanded ? 'flex-1' : 'h-[200px]'}`}>Sin coordenadas disponibles</div>
                        )}
                      </ChartCard>
                    </div>
                  </div>
                </div>
              )}
            </TabPanel>

            {/* ═══ TAB B — Contratistas ═══ */}
            <TabPanel>
              {activeTab !== 1 ? null : dashboardLoading ? (
                <div className="flex items-center justify-center h-48"><Loader2 size={24} className="animate-spin text-slate-400" /></div>
              ) : dashboardError ? (
                <div className="bg-white rounded-lg border border-slate-200 p-8 text-center mt-3">
                  <AlertTriangle size={24} className="mx-auto text-red-500 mb-2" />
                  <p className="text-sm text-slate-600">{dashboardError}</p>
                  <Button variant="secondary" size="sm" onClick={() => loadDashboard(selectedBase)} className="mt-3">Reintentar</Button>
                </div>
              ) : (
                <div className="space-y-3 mt-3">
                  {/* ── Fila 1: Hero KPIs — Panorama estrategico ── */}
                  {zonaContratistaData?.ranking_contratistas?.length ? (() => {
                    const ranking = zonaContratistaData.ranking_contratistas
                    const peorTasa = Math.max(...ranking.map(r => r.tasa_mal))
                    const peorNombre = ranking.find(r => r.tasa_mal === peorTasa)?.contratista ?? ''
                    const totalMultas = ranking.reduce((s, r) => s + r.multas, 0)
                    const totalInsp = ranking.reduce((s, r) => s + r.inspecciones, 0)
                    const zonaCount = selectedZona ? 1 : zonas.length
                    return (
                      <div className="bg-white rounded-lg border border-slate-200/60 shadow-sm grid grid-cols-3 divide-x divide-slate-100">
                        <HeroKpi
                          label="Contratistas"
                          value={ranking.length}
                          subtitle={selectedZona ? `en ${selectedZona}` : `en ${zonaCount} zonas`}
                          status="neutral"
                        />
                        <HeroKpi
                          label="Peor Tasa Mal"
                          value={pct(peorTasa)}
                          subtitle={peorNombre}
                          status={peorTasa >= 30 ? 'bad' : 'neutral'}
                        />
                        <HeroKpi
                          label="Multas Totales"
                          value={totalMultas}
                          subtitle={totalInsp > 0 ? `Tasa: ${pct((totalMultas / totalInsp) * 100)}` : undefined}
                          status={totalMultas > 0 ? 'bad' : 'good'}
                        />
                      </div>
                    )
                  })() : null}

                  {/* ── Fila 2: Operational KPIs ── */}
                  {zonaContratistaData?.ranking_contratistas?.length ? (() => {
                    const ranking = zonaContratistaData.ranking_contratistas
                    const totalInsp = ranking.reduce((s, r) => s + r.inspecciones, 0)
                    const totalMal = ranking.reduce((s, r) => s + r.mal_ejecutado, 0)
                    const totalPendNorm = ranking.reduce((s, r) => s + r.pend_norm, 0)
                    const weightedCierre = totalInsp > 0
                      ? ranking.reduce((s, r) => s + r.tasa_cierre * r.inspecciones, 0) / totalInsp
                      : 0
                    return (
                      <div className="bg-white rounded-lg border border-slate-200/60 shadow-sm grid grid-cols-2 lg:grid-cols-4 divide-x divide-slate-100">
                        <KpiCard label="Inspeccionadas" value={totalInsp} />
                        <KpiCard
                          label="Mal Ejecutados"
                          value={totalMal}
                          subtitle={totalInsp > 0 ? `${pct((totalMal / totalInsp) * 100)} del total` : undefined}
                          status="bad"
                        />
                        <ProgressKpi
                          label="Tasa Cierre"
                          value={weightedCierre}
                          displayValue={pct(weightedCierre)}
                          thresholds={{ good: 80, warning: 50 }}
                        />
                        <KpiCard
                          label="Pend. Normalizar"
                          value={totalPendNorm}
                          subtitle={totalPendNorm > 0 ? 'requieren seguimiento' : undefined}
                          status={totalPendNorm > 0 ? 'bad' : 'good'}
                        />
                      </div>
                    )
                  })() : null}

                  {/* ── Fila 3: Charts — Scatter 60% + Top Bar 40% ── */}
                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
                    <ChartCard title="Volumen vs Tasa Mal" sub="Cuadrantes: riesgo/volumen · Clic para detalle" className="lg:col-span-3">
                      {zonaContratistaData?.scatter_contratistas?.length ? <EChart option={scatterOption} height="280px" onEvents={scatterEvents} /> : <EmptyState text="Sin datos" />}
                    </ChartCard>
                    <ChartCard title="Top 10 — Tasa Mal (%)" sub="Clic para detalle" className="lg:col-span-2">
                      {zonaContratistaData?.ranking_contratistas?.length ? <EChart option={topContratistaBarOption} height="280px" onEvents={contratistaBarEvents} /> : <EmptyState text="Sin datos" />}
                    </ChartCard>
                  </div>

                  {/* ── Fila 4: Analisis de Causas por Contratista ── */}
                  {zonaMalEjecutadosData && zonaMalEjecutadosData.total_mal > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
                      <ChartCard title="Causas por Contratista" sub={`${zonaMalEjecutadosData.causas_por_contratista.length} contratistas con mal ejecutados`} className="lg:col-span-3">
                        {causasPorContratistaOption ? <EChart option={causasPorContratistaOption} height="280px" /> : <EmptyState text="Sin datos de causas" />}
                      </ChartCard>
                      <ChartCard title="Causa Principal" sub="Por contratista" className="lg:col-span-2">
                        {(() => {
                          const cpc = zonaMalEjecutadosData.causas_por_contratista
                          if (!cpc?.length) return <EmptyState text="Sin datos" />
                          const top8 = [...cpc].sort((a, b) => b.total_mal - a.total_mal)
                          return (
                            <div className="overflow-x-auto -mx-4 px-4">
                              <table className="w-full text-left">
                                <thead className="border-b border-slate-100">
                                  <tr>
                                    <th className="px-3 py-1.5 text-[10px] text-slate-500 uppercase tracking-wider font-medium">Contratista</th>
                                    <th className="px-3 py-1.5 text-[10px] text-slate-500 uppercase tracking-wider font-medium">Causa Principal</th>
                                    <th className="px-3 py-1.5 text-[10px] text-slate-500 uppercase tracking-wider font-medium text-right">Cant.</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {top8.map(c => {
                                    const topCausa = c.causas.length > 0 ? c.causas.reduce((a, b) => b.cantidad > a.cantidad ? b : a) : null
                                    return (
                                      <tr key={c.contratista} className="border-b border-slate-50 hover:bg-slate-50/80 cursor-pointer transition-colors" onClick={() => setSelectedContratista(c.contratista)}>
                                        <td className="px-3 py-2 text-[11px] font-medium text-slate-700 truncate max-w-[160px]">{c.contratista}</td>
                                        <td className="px-3 py-2 text-[11px] text-slate-500 truncate max-w-[180px]">{topCausa ? topCausa.causa.replace(/_/g, ' ') : '–'}</td>
                                        <td className="px-3 py-2 text-[11px] text-right text-slate-600">{topCausa ? formatNumber(topCausa.cantidad) : '–'}</td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )
                        })()}
                      </ChartCard>
                    </div>
                  )}

                  {/* ── Fila 5: Ranking Table — Enriquecida 9 columnas ── */}
                  <ChartCard>
                    <div className="flex items-center justify-between mb-2">
                      <SectionTitle>Ranking de Contratistas</SectionTitle>
                      <span className="text-[10px] text-slate-400">{zonaContratistaData?.ranking_contratistas?.length ?? 0} contratistas{selectedZona ? ` — ${selectedZona}` : ''}</span>
                    </div>
                    <div className="overflow-x-auto -mx-4 px-4">
                      <table className="w-full text-left">
                        <thead className="border-b border-slate-100">
                          <tr>
                            {['#', 'Contratista', 'Insp.', 'Mal Ej.', 'Tasa Mal', 'Multas', 'T. Multas', 'Pend. Norm.', 'T. Cierre'].map(h => (
                              <th key={h} className={`px-2 py-2 text-[10px] text-slate-500 uppercase tracking-wider font-medium ${h !== '#' && h !== 'Contratista' ? 'text-right' : ''} ${h === 'Tasa Mal' ? 'min-w-[130px]' : ''}`}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const ranking = zonaContratistaData?.ranking_contratistas
                            if (!ranking?.length) return <tr><td colSpan={9} className="text-center py-8 text-slate-400 text-[11px]">Sin datos de contratistas</td></tr>
                            const maxTasaMal = Math.max(...ranking.map(r => r.tasa_mal), 1)
                            return ranking.map((row, i) => (
                              <tr key={row.contratista} className="border-b border-slate-50 hover:bg-slate-50/80 cursor-pointer transition-colors" onClick={() => setSelectedContratista(row.contratista)}>
                                <td className="px-2 py-2.5 text-[11px] text-slate-400">{i + 1}</td>
                                <td className="px-2 py-2.5 text-[11px] font-medium text-slate-700">{row.contratista}</td>
                                <td className="px-2 py-2.5 text-[11px] text-right text-slate-600">{formatNumber(row.inspecciones)}</td>
                                <td className="px-2 py-2.5 text-[11px] text-right text-slate-600">{formatNumber(row.mal_ejecutado)}</td>
                                <td className="px-2 py-2.5 text-[11px] text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <div className="w-14 h-[5px] bg-slate-100 rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full ${row.tasa_mal >= 30 ? 'bg-red-600' : row.tasa_mal >= 15 ? 'bg-amber-500' : 'bg-green-600'}`} style={{ width: `${Math.min(100, (row.tasa_mal / maxTasaMal) * 100)}%` }} />
                                    </div>
                                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${row.tasa_mal >= 30 ? 'bg-red-50 text-red-700' : row.tasa_mal >= 15 ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>{pct(row.tasa_mal)}</span>
                                  </div>
                                </td>
                                <td className="px-2 py-2.5 text-[11px] text-right text-slate-600">{formatNumber(row.multas)}</td>
                                <td className="px-2 py-2.5 text-[11px] text-right">
                                  <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${row.tasa_multas >= 10 ? 'bg-red-50 text-red-700' : row.tasa_multas >= 5 ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>{pct(row.tasa_multas)}</span>
                                </td>
                                <td className="px-2 py-2.5 text-[11px] text-right text-slate-600">{formatNumber(row.pend_norm)}</td>
                                <td className="px-2 py-2.5 text-[11px] text-right">
                                  <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${row.tasa_cierre >= 80 ? 'bg-green-50 text-green-700' : row.tasa_cierre >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>{pct(row.tasa_cierre)}</span>
                                </td>
                              </tr>
                            ))
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </ChartCard>
                </div>
              )}
            </TabPanel>

            {/* ═══ TAB C — Mal Ejecutados ═══ */}
            <TabPanel>
              {activeTab !== 2 ? null : dashboardLoading ? (
                <div className="flex items-center justify-center h-48"><Loader2 size={24} className="animate-spin text-slate-400" /></div>
              ) : !zonaMalEjecutadosData || zonaMalEjecutadosData.total_mal === 0 ? (
                <div className="bg-white rounded-lg border border-slate-200 p-8 text-center mt-3">
                  <CheckCircle size={24} className="mx-auto text-green-500 mb-2" />
                  <p className="text-sm text-slate-600">No hay registros mal ejecutados en este periodo</p>
                </div>
              ) : (
                <div className="space-y-3 mt-3">
                  {/* KPI strip — executive style */}
                  {(() => {
                    const d = zonaMalEjecutadosData
                    const causas = d.causas_individuales
                    const totalHallazgos = causas.reduce((s, c) => s + c.cantidad, 0)
                    const causasDistintas = causas.length
                    const topCausa = causas.length > 0 ? causas[0] : null
                    const causas80 = causas.filter(c => c.acumulado_pct <= 80).length
                    const hallazgosPorTrabajo = d.total_mal > 0 ? (totalHallazgos / d.total_mal).toFixed(1) : '0'
                    return (
                      <div className="bg-white rounded-lg border border-slate-200/60 shadow-sm grid grid-cols-2 lg:grid-cols-4 divide-x divide-slate-100">
                        <HeroKpi
                          label="Total Mal Ejecutados"
                          value={d.total_mal}
                          subtitle={`${formatNumber(totalHallazgos)} hallazgos (${hallazgosPorTrabajo}/trabajo)${selectedZona ? ` — ${selectedZona}` : ''}`}
                          status="bad"
                        />
                        <KpiCard label="Causas Distintas" value={causasDistintas} subtitle={`${causas80} causan el 80%`} />
                        <KpiCard
                          label="Causa Principal"
                          value={topCausa ? topCausa.causa.replace(/_/g, ' ') : '–'}
                          subtitle={topCausa ? `${formatNumber(topCausa.cantidad)} hallazgos (${pct(topCausa.pct)})` : ''}
                          status="bad"
                        />
                        <KpiCard label="Contratistas" value={d.causas_por_contratista.length} subtitle={`${d.causas_por_zona.length} zona${d.causas_por_zona.length !== 1 ? 's' : ''}`} />
                      </div>
                    )
                  })()}

                  {/* Pareto + Zona/Contratista */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    <ChartCard title="Pareto de Causas" sub="Linea punteada: 80%" className="lg:col-span-2">
                      {zonaMalEjecutadosData.causas_individuales.length > 0 ? (
                        <EChart
                          option={{
                            tooltip: { ...TOOLTIP_STYLE, trigger: 'axis' as const, axisPointer: { type: 'cross' as const } },
                            legend: { ...LEGEND_STYLE, data: ['Cantidad', '% Acumulado'] },
                            grid: { ...GRID_STYLE, left: 12 },
                            xAxis: { type: 'category' as const, data: zonaMalEjecutadosData.causas_individuales.map(c => c.causa.replace(/_/g, ' ')), ...CATEGORY_AXIS, axisLabel: { rotate: 35, fontSize: 9, color: '#64748b', interval: 0 } },
                            yAxis: [
                              { type: 'value' as const, ...AXIS_STYLE },
                              { type: 'value' as const, ...AXIS_STYLE, min: 0, max: 100, axisLabel: { ...AXIS_STYLE.axisLabel, formatter: '{value}%' } },
                            ],
                            series: [
                              { name: 'Cantidad', type: 'bar' as const, data: zonaMalEjecutadosData.causas_individuales.map(c => c.cantidad), itemStyle: { color: CHART_COLORS.danger, borderRadius: BAR_RADIUS }, barMaxWidth: 28 },
                              {
                                name: '% Acumulado', type: 'line' as const, yAxisIndex: 1, data: zonaMalEjecutadosData.causas_individuales.map(c => c.acumulado_pct),
                                smooth: true, lineStyle: { color: CHART_COLORS.warning, width: 2 }, itemStyle: { color: CHART_COLORS.warning }, showSymbol: false,
                                markLine: { data: [{ yAxis: 80, lineStyle: { type: 'dashed' as const, color: '#cbd5e1' } }], label: { formatter: '80%', fontSize: 10, color: '#94a3b8' } },
                              },
                            ],
                          }}
                          height="260px"
                        />
                      ) : <EmptyState text="Sin datos" />}
                    </ChartCard>
                    <ChartCard title="Por Contratista" sub="Clic para filtrar">
                      {zonaMalEjecutadosData.causas_por_contratista.length > 0 ? (
                        <EChart
                          option={{
                            tooltip: { ...TOOLTIP_STYLE, trigger: 'axis' as const },
                            grid: { left: 8, right: 20, bottom: 8, top: 8, containLabel: true },
                            xAxis: { type: 'value' as const, ...AXIS_STYLE },
                            yAxis: { type: 'category' as const, data: zonaMalEjecutadosData.causas_por_contratista.map(c => c.contratista), ...CATEGORY_AXIS, axisLabel: { fontSize: 10, color: '#64748b', width: 120, overflow: 'truncate' as const } },
                            series: [{
                              type: 'bar' as const, barMaxWidth: 18,
                              data: zonaMalEjecutadosData.causas_por_contratista.map(c => ({ value: c.total_mal, itemStyle: { color: CHART_COLORS.danger, borderRadius: BAR_RADIUS_H } })),
                              label: { show: true, position: 'right' as const, fontSize: 10, color: '#64748b' },
                            }],
                          }}
                          height="260px"
                          onEvents={{ click: (p: { name?: string }) => { if (p.name) addDrillFilter('contratista', 'Contratista', p.name) } }}
                        />
                      ) : <EmptyState text="Sin datos" />}
                    </ChartCard>
                  </div>

                  {/* Causas por contratista table */}
                  <ChartCard title="Causas por Contratista">
                    <div className="overflow-x-auto -mx-4 px-4 max-h-[270px] overflow-y-auto">
                      <table className="w-full text-left">
                        <thead className="border-b border-slate-100">
                          <tr>
                            <th className="px-3 py-2 text-[10px] text-slate-500 uppercase tracking-wider font-medium">Contratista</th>
                            <th className="px-3 py-2 text-[10px] text-slate-500 uppercase tracking-wider font-medium text-right">Mal</th>
                            <th className="px-3 py-2 text-[10px] text-slate-500 uppercase tracking-wider font-medium">Causas</th>
                          </tr>
                        </thead>
                        <tbody>
                          {zonaMalEjecutadosData.causas_por_contratista.map((row) => (
                            <tr key={row.contratista} className="border-b border-slate-50 hover:bg-slate-50/80 cursor-pointer transition-colors" onClick={() => addDrillFilter('contratista', 'Contratista', row.contratista)}>
                              <td className="px-3 py-2.5 text-[11px] font-medium text-slate-700">{row.contratista}</td>
                              <td className="px-3 py-2.5 text-[11px] text-right"><span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-red-600">{row.total_mal}</span></td>
                              <td className="px-3 py-2.5 text-[11px]">
                                <div className="flex flex-wrap gap-1">
                                  {row.causas.slice(0, 3).map((c) => (
                                    <span key={c.causa} className="inline-flex px-1.5 py-0.5 rounded text-[9px] bg-slate-100 text-slate-600">{c.causa.replace(/_/g, ' ')} ({c.cantidad})</span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </ChartCard>

                  {/* All causes table — compact */}
                  <ChartCard title="Todas las Causas">
                    <div className="overflow-x-auto -mx-4 px-4 max-h-[300px] overflow-y-auto">
                      <table className="w-full text-left">
                        <thead className="sticky top-0 bg-white border-b border-slate-100">
                          <tr>
                            {['#', 'Causa', 'Cant.', '%', 'Acum.'].map(h => (
                              <th key={h} className={`px-3 py-2 text-[10px] text-slate-500 uppercase tracking-wider font-medium ${h !== '#' && h !== 'Causa' ? 'text-right' : ''}`}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {zonaMalEjecutadosData.causas_individuales.map((row, i) => (
                            <tr key={row.causa} className="border-b border-slate-50 hover:bg-slate-50/80">
                              <td className="px-3 py-2.5 text-[11px] text-slate-400">{i + 1}</td>
                              <td className="px-3 py-2.5 text-[11px] font-medium text-slate-700">{row.causa.replace(/_/g, ' ')}</td>
                              <td className="px-3 py-2.5 text-[11px] text-right text-slate-600">{formatNumber(row.cantidad)}</td>
                              <td className="px-3 py-2.5 text-[11px] text-right text-slate-600">{pct(row.pct)}</td>
                              <td className="px-3 py-2.5 text-[11px] text-right">
                                <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${row.acumulado_pct <= 80 ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                                  {pct(row.acumulado_pct)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </ChartCard>
                </div>
              )}
            </TabPanel>

            {/* ═══ TAB D — OCA ═══ */}
            <TabPanel>
              {activeTab !== 3 ? null : dashboardLoading ? (
                <div className="flex items-center justify-center h-48"><Loader2 size={24} className="animate-spin text-slate-400" /></div>
              ) : (
                <div className="space-y-3 mt-3">
                  {/* ── Fila 1: Hero KPIs ── */}
                  {(() => {
                    const ranking = zonaOcaData?.ranking_inspectores ?? []
                    const kpisBase = overviewData?.kpis
                    const efectividad = kpisBase?.tasa_efectividad_oca ?? 0
                    const noEfectiva = kpisBase?.pct_no_efectiva ?? 0
                    const uniqueZonas = new Set(ranking.flatMap(r => r.zonas))
                    return (
                      <div className="bg-white rounded-lg border border-slate-200/60 shadow-sm grid grid-cols-3 divide-x divide-slate-100">
                        <HeroKpi
                          label="Tasa Efectividad"
                          value={pct(efectividad)}
                          status={efectividad >= 80 ? 'good' : efectividad >= 50 ? 'neutral' : 'bad'}
                        />
                        <HeroKpi
                          label="Inspectores Activos"
                          value={ranking.length}
                          subtitle={`en ${uniqueZonas.size} zona${uniqueZonas.size !== 1 ? 's' : ''}`}
                          status="neutral"
                        />
                        <HeroKpi
                          label="No Efectivas"
                          value={pct(noEfectiva)}
                          subtitle="del total inspeccionadas"
                          status={noEfectiva > 20 ? 'bad' : 'neutral'}
                        />
                      </div>
                    )
                  })()}

                  {/* ── Fila 2: Operational KPIs ── */}
                  {(() => {
                    const ranking = zonaOcaData?.ranking_inspectores ?? []
                    const kpisBase = overviewData?.kpis
                    const totalInsp = kpisBase?.total_inspecciones ?? 0
                    const promInsp = ranking.length > 0 ? Math.round(ranking.reduce((s, r) => s + r.inspecciones, 0) / ranking.length) : 0
                    const avance = kpisBase?.pct_avance ?? 0
                    const peorEfect = ranking.length > 0 ? Math.min(...ranking.map(r => r.tasa_efectividad)) : 0
                    const peorNombre = ranking.find(r => r.tasa_efectividad === peorEfect)?.inspector ?? ''
                    return (
                      <div className="bg-white rounded-lg border border-slate-200/60 shadow-sm grid grid-cols-2 lg:grid-cols-4 divide-x divide-slate-100">
                        <KpiCard label="Inspeccionadas" value={totalInsp} />
                        <KpiCard label="Prom/Inspector" value={promInsp} />
                        <div className="px-4 py-3">
                          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Avance</p>
                          {(() => {
                            const level = avance >= 80 ? 'good' : avance >= 50 ? 'warning' : 'bad'
                            const barColor = level === 'good' ? 'bg-green-700' : level === 'warning' ? 'bg-amber-600' : 'bg-red-700'
                            const valueColor = level === 'good' ? 'text-green-700' : level === 'warning' ? 'text-amber-700' : 'text-red-700'
                            const ej = ejecucionStats
                            return (
                              <>
                                <p className={`text-lg font-semibold ${valueColor} mt-1 leading-none tracking-tight`}>{pct(avance)}</p>
                                <div className="mt-2 w-full bg-slate-100 rounded-full h-[3px] overflow-hidden">
                                  <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, avance)}%` }} />
                                </div>
                                {ej && ej.fecha_envio && !ej.completado && ej.fecha_proyectada && (
                                  <p className="text-[10px] text-slate-500 mt-1.5">
                                    {ej.dias_habiles}d · Proy: {new Date(ej.fecha_proyectada + 'T00:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
                                  </p>
                                )}
                              </>
                            )
                          })()}
                        </div>
                        <KpiCard
                          label="Peor Efectividad"
                          value={pct(peorEfect)}
                          subtitle={peorNombre}
                          status={peorEfect < 50 ? 'bad' : peorEfect < 80 ? 'neutral' : 'good'}
                        />
                      </div>
                    )
                  })()}

                  {/* ── Causas No Efectivas — Pareto + Por Contratista ── */}
                  {noEfectivosData?.categorias?.length ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                      <ChartCard title="Causas No Efectivas" sub="Linea punteada: 80%" className="lg:col-span-2">
                        <EChart option={noEfectivosOption} height="260px" />
                      </ChartCard>
                      <ChartCard title="Por Contratista" sub="Top no efectivas">
                        {noEfectivosData.por_contratista?.length ? (
                          <EChart option={noEfectivosPorContratistaOption} height="260px" />
                        ) : <EmptyState text="Sin datos" />}
                      </ChartCard>
                    </div>
                  ) : null}

                  {/* ── Fila 3: Charts — Tendencia 60% + Efectividad Zona 40% ── */}
                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
                    <div className="bg-white rounded-lg border border-slate-200/60 shadow-sm px-4 py-3 lg:col-span-3">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h3 className="text-xs font-semibold text-slate-700 tracking-tight">Tendencia Efectividad</h3>
                          <p className="text-[10px] text-slate-400 mt-0.5">Linea punteada: 80% meta</p>
                        </div>
                        <div className="flex gap-0.5 bg-slate-100 rounded p-0.5">
                          {(['mensual', 'semanal', 'diario'] as const).map(v => (
                            <button
                              key={v}
                              onClick={() => setOcaTendenciaView(v)}
                              className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
                                ocaTendenciaView === v
                                  ? 'bg-white text-slate-700 shadow-sm'
                                  : 'text-slate-400 hover:text-slate-600'
                              }`}
                            >
                              {v === 'mensual' ? 'Mes' : v === 'semanal' ? 'Sem' : 'Dia'}
                            </button>
                          ))}
                        </div>
                      </div>
                      {zonaOcaTendencia.length ? <EChart option={tendenciaEfectividadOption} height="280px" /> : <EmptyState text="Sin datos de tendencia" />}
                    </div>
                    <ChartCard title="Efectividad por Zona" sub="Colores: semaforo por umbral" className="lg:col-span-2">
                      {zonaOcaData?.efectividad_por_zona?.length ? <EChart option={efectividadZonaOption} height="280px" /> : <EmptyState text="Sin datos por zona" />}
                    </ChartCard>
                  </div>

                  {/* ── Fila 4: Charts — Scatter 60% + Top 10 Bar 40% ── */}
                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
                    <ChartCard title="Volumen vs Efectividad" sub="Cuadrantes: meta 80% + promedio volumen" className="lg:col-span-3">
                      {zonaOcaData?.ranking_inspectores?.length ? <EChart option={inspectorScatterOption} height="280px" /> : <EmptyState text="Sin datos" />}
                    </ChartCard>
                    <ChartCard title="Top 10 Inspectores" sub="Por volumen — label con % efectividad" className="lg:col-span-2">
                      {zonaOcaData?.ranking_inspectores?.length ? <EChart option={topInspectoresBarOption} height="280px" /> : <EmptyState text="Sin datos" />}
                    </ChartCard>
                  </div>

                  {/* ── Fila 5: Ranking Table — 7 columnas ── */}
                  <ChartCard>
                    <div className="flex items-center justify-between mb-2">
                      <SectionTitle>Ranking de Inspectores</SectionTitle>
                      <span className="text-[10px] text-slate-400">{zonaOcaData?.ranking_inspectores?.length ?? 0} inspectores{selectedZona ? ` — ${selectedZona}` : ''}</span>
                    </div>
                    <div className="overflow-x-auto -mx-4 px-4 max-h-[400px] overflow-y-auto">
                      <table className="w-full text-left">
                        <thead className="sticky top-0 bg-white border-b border-slate-100">
                          <tr>
                            {['#', 'Inspector', 'Insp.', 'Efectivas', 'T. Efectividad', 'Mal Ej.', 'Multas'].map(h => (
                              <th key={h} className={`px-2 py-2 text-[10px] text-slate-500 uppercase tracking-wider font-medium ${h !== '#' && h !== 'Inspector' ? 'text-right' : ''} ${h === 'T. Efectividad' ? 'min-w-[140px]' : ''}`}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const ranking = zonaOcaData?.ranking_inspectores
                            if (!ranking?.length) return <tr><td colSpan={7} className="text-center py-8 text-slate-400 text-[11px]">Sin datos de inspectores</td></tr>
                            const maxEfect = Math.max(...ranking.map(r => r.tasa_efectividad), 1)
                            return ranking.map((row, i) => (
                              <tr key={row.inspector} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                                <td className="px-2 py-2.5 text-[11px] text-slate-400">{i + 1}</td>
                                <td className="px-2 py-2.5 text-[11px] font-medium text-slate-700">{row.inspector}</td>
                                <td className="px-2 py-2.5 text-[11px] text-right text-slate-600">{formatNumber(row.inspecciones)}</td>
                                <td className="px-2 py-2.5 text-[11px] text-right text-slate-600">{formatNumber(row.efectivas)}</td>
                                <td className="px-2 py-2.5 text-[11px] text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <div className="w-14 h-[5px] bg-slate-100 rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full ${row.tasa_efectividad >= 80 ? 'bg-green-600' : row.tasa_efectividad >= 50 ? 'bg-amber-500' : 'bg-red-600'}`} style={{ width: `${Math.min(100, (row.tasa_efectividad / maxEfect) * 100)}%` }} />
                                    </div>
                                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${row.tasa_efectividad >= 80 ? 'bg-green-50 text-green-700' : row.tasa_efectividad >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>{pct(row.tasa_efectividad)}</span>
                                  </div>
                                </td>
                                <td className="px-2 py-2.5 text-[11px] text-right text-slate-600">{formatNumber(row.mal_ejecutado)}</td>
                                <td className="px-2 py-2.5 text-[11px] text-right text-slate-600">{formatNumber(row.multas)}</td>
                              </tr>
                            ))
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </ChartCard>
                </div>
              )}
            </TabPanel>

            {/* ═══ TAB E — Detalle ═══ */}
            <TabPanel>
              {activeTab === 4 && <div className="space-y-3 mt-3">
                {/* Filter bar */}
                <div className="bg-white rounded-lg border border-slate-200/60 shadow-sm px-4 py-2.5 space-y-2">
                  {/* Row 1: Dropdown filters */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mr-1">Filtrar:</span>
                    <MultiSelect
                      options={bases}
                      selected={(drillFilters.find(f => f.key === 'base')?.value ?? '').split(',').filter(Boolean)}
                      onChange={(vals) => vals.length ? addDrillFilter('base', 'Base', vals.join(',')) : removeDrillFilter('base')}
                      placeholder="Todas las bases"
                      className="min-w-[160px]"
                    />
                    <MultiSelect
                      options={zonas}
                      selected={(drillFilters.find(f => f.key === 'zona')?.value ?? '').split(',').filter(Boolean)}
                      onChange={(vals) => vals.length ? addDrillFilter('zona', 'Zona', vals.join(',')) : removeDrillFilter('zona')}
                      placeholder="Todas las zonas"
                      className="min-w-[130px]"
                    />
                    <MultiSelect
                      options={(contratistaData?.ranking_contratistas ?? []).map(c => c.contratista)}
                      selected={(drillFilters.find(f => f.key === 'contratista')?.value ?? '').split(',').filter(Boolean)}
                      onChange={(vals) => vals.length ? addDrillFilter('contratista', 'Contratista', vals.join(',')) : removeDrillFilter('contratista')}
                      placeholder="Todos los contratistas"
                      className="min-w-[160px]"
                    />
                    <MultiSelect
                      options={['Bien Ejecutado', 'Mal Ejecutado', 'No Efectiva']}
                      selected={(drillFilters.find(f => f.key === 'resultado')?.value ?? '').split(',').filter(Boolean)}
                      onChange={(vals) => vals.length ? addDrillFilter('resultado', 'Resultado', vals.join(',')) : removeDrillFilter('resultado')}
                      placeholder="Todos los resultados"
                      className="min-w-[150px]"
                    />
                    <div className="flex-1" />
                    <div className="w-48"><TextInput placeholder="Buscar..." value={detailSearch} onChange={(e) => setDetailSearch(e.target.value)} icon={Search} /></div>
                    <ExportDropdown onExport={handleExport} loading={exportLoading} loadingFormat={exportLoadingFormat} totalRecords={detailData?.total} hasFilters={drillFilters.length > 0 || !!detailSearch} />
                  </div>
                  {/* Row 2: Active filter chips */}
                  {drillFilters.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
                      <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Activos:</span>
                      {drillFilters.map((f) => <FilterChip key={f.key} filter={f} onRemove={removeDrillFilter} />)}
                      <button onClick={clearAllFilters} className="text-[10px] text-slate-400 hover:text-slate-600 transition-colors ml-1">Limpiar todo</button>
                    </div>
                  )}
                </div>

                {/* Detail table */}
                <ChartCard>
                  <div className="flex items-center justify-between mb-2">
                    <SectionTitle>Registros de Inspecciones</SectionTitle>
                    {detailData && <span className="text-[10px] text-slate-400">{formatNumber(detailData.total)} reg. — pag. {detailData.page}/{detailData.pages}</span>}
                  </div>

                  {detailLoading ? (
                    <div className="flex items-center justify-center h-40"><Loader2 size={20} className="animate-spin text-slate-400" /></div>
                  ) : (
                    <div className="overflow-x-auto -mx-4 px-4">
                      <table className="w-full text-left">
                        <thead className="border-b border-slate-100">
                          <tr>
                            {['VTA', 'Fecha', 'Zona', 'Comuna', 'Contratista', 'Resultado', 'Multa', 'Causa', ''].map(h => (
                              <th key={h} className="px-3 py-2 text-[10px] text-slate-500 uppercase tracking-wider font-medium">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {detailData?.items?.map((item) => {
                            const vta = (item.vta || '').toString().replace(/\.0$/, '')
                            const resultado = item.resultado_inspeccion || item.resultado || ''
                            const isMalEj = resultado.toUpperCase().includes('MAL')
                            const isNoEfectiva = (item.estado_efectividad || '').toUpperCase().includes('NO EFECTIVA') || resultado.toUpperCase() === 'OTROS'
                            const causa = isMalEj
                              ? (item.categoria_mal_ejecutado || item.causa || '')
                              : isNoEfectiva
                                ? (item.categoria_no_efectivo || '')
                                : ''
                            const multa = item.multa || ''
                            const contratista = item.contratista_enel || item.contratista || ''
                            const hasLink = item.link_formulario && item.link_formulario !== '' && item.link_formulario !== 'None'
                            return (
                              <tr
                                key={item.id}
                                className="border-b border-slate-50 hover:bg-slate-50/80 cursor-pointer transition-colors"
                                onClick={() => setSelectedMapPoint(detailToMapPoint(item))}
                              >
                                <td className="px-3 py-2.5 text-[11px] font-medium text-slate-700 whitespace-nowrap">{vta || '–'}</td>
                                <td className="px-3 py-2.5 text-[11px] text-slate-500 whitespace-nowrap">{item.fecha_inspeccion || item.fecha || '–'}</td>
                                <td className="px-3 py-2.5 text-[11px] text-slate-600">{item.zona}</td>
                                <td className="px-3 py-2.5 text-[11px] text-slate-600">{item.comuna}</td>
                                <td className="px-3 py-2.5 text-[11px] font-medium text-slate-700">{contratista}</td>
                                <td className="px-3 py-2.5 text-[11px]">
                                  <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${resultado.toUpperCase().includes('MAL') ? 'bg-red-50 text-red-700' : resultado.toUpperCase().includes('BIEN') ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                    {resultado || '–'}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5 text-[11px]">
                                  {multa.toUpperCase() === 'SI' ? (
                                    <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-semibold bg-red-50 text-red-600">SI</span>
                                  ) : (
                                    <span className="text-slate-400">{multa || '–'}</span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-[11px] text-slate-400 max-w-[180px] truncate" title={causa.replace(/_/g, ' ')}>{causa ? causa.replace(/_/g, ' ') : '–'}</td>
                                <td className="px-3 py-2.5 text-[11px]">
                                  {hasLink && (
                                    <a
                                      href={item.link_formulario!}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                                    >
                                      <ExternalLink size={11} />
                                    </a>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                          {!detailData?.items?.length && (
                            <tr><td colSpan={9} className="text-center py-8 text-slate-400 text-[11px]">{detailLoading ? 'Cargando...' : 'No se encontraron registros'}</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Pagination */}
                  {detailData && detailData.pages > 1 && (
                    <div className="flex items-center justify-center mt-3 gap-0.5">
                      <button onClick={() => setDetailPage((p) => Math.max(1, p - 1))} disabled={detailData.page <= 1 || detailLoading} className="px-2 py-1 rounded text-[11px] text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-colors">
                        <ChevronLeft size={13} />
                      </button>
                      {Array.from({ length: Math.min(7, detailData.pages) }, (_, i) => {
                        const page = detailData.pages <= 7 ? i + 1 : detailData.page <= 4 ? i + 1 : detailData.page >= detailData.pages - 3 ? detailData.pages - 6 + i : detailData.page - 3 + i
                        return (
                          <button key={page} onClick={() => setDetailPage(page)} disabled={detailLoading}
                            className={`w-7 h-7 rounded text-[11px] font-medium transition-colors ${page === detailData.page ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                            {page}
                          </button>
                        )
                      })}
                      <button onClick={() => setDetailPage((p) => Math.min(detailData.pages, p + 1))} disabled={detailData.page >= detailData.pages || detailLoading} className="px-2 py-1 rounded text-[11px] text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-colors">
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  )}
                </ChartCard>

              </div>}
            </TabPanel>
          </TabPanels>
        </TabGroup>
      </main>

      {/* Modals */}
      {activeModal && kpiModalData && (
        <KpiModal
          title={activeModal === 'total' ? 'Inspecciones por Zona' : activeModal === 'mal_ejecutado' ? 'Top Causas de Mal Ejecucion' : activeModal === 'multas' ? 'Top Contratistas con Multas' : activeModal === 'no_efectiva' ? 'No Efectiva por Zona' : ''}
          modalKey={activeModal} data={kpiModalData} onClose={() => setActiveModal(null)}
        />
      )}
      {selectedMapPoint && <MapDetailModal point={selectedMapPoint} onClose={() => setSelectedMapPoint(null)} />}
      {showMedidoresCruzados && (
        <MedidoresCruzadosModal
          points={medidoresCruzadosPoints}
          onClose={() => setShowMedidoresCruzados(false)}
          onSelectPoint={(p) => setSelectedMapPoint(p)}
        />
      )}
      {selectedContratista && (() => {
        const ranking = contratistaData?.ranking_contratistas?.find(r => r.contratista === selectedContratista)
        if (!ranking) return null
        return (
          <ContratistaModal
            contratistaName={selectedContratista}
            ranking={ranking}
            malEjecutadosData={malEjecutadosData}
            selectedBase={selectedBase}
            mapaPoints={mapaPoints}
            onClose={() => setSelectedContratista(null)}
            onViewRecords={() => {
              setSelectedContratista(null)
              addDrillFilter('contratista', 'Contratista', selectedContratista)
            }}
          />
        )
      })()}
      {selectedDay && selectedDayPoints.length > 0 && (
        <DayDetailModal
          date={selectedDay}
          points={selectedDayPoints}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  )
}
