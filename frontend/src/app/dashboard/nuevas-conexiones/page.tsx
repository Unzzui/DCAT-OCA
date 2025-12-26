'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/Header'
import {
  Card,
  Title,
  Text,
  Flex,
  Grid,
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
  DateRangePicker,
  DateRangePickerValue,
  BarChart,
  DonutChart,
  AreaChart,
  LineChart,
  Tab,
  TabGroup,
  TabList,
  TabPanel,
  TabPanels,
  ProgressBar,
} from '@tremor/react'
import { Search, Filter, CheckCircle, XCircle, Users, Building, BarChart3, TrendingUp, TrendingDown, AlertTriangle, Info, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ExportOverlay } from '@/components/ui/ExportOverlay'
import { ExportDropdown } from '@/components/ui/ExportDropdown'
import { formatNumber } from '@/lib/utils'
import { api } from '@/lib/api'

interface Stats {
  total: number
  efectivas: number
  no_efectivas: number
  bien_ejecutados: number
  mal_ejecutados: number
  tasa_efectividad: number
  por_zona: Record<string, number>
  por_inspector: Array<{ inspector: string; cantidad: number; efectividad: number }>
  por_mes: Array<{ mes: string; cantidad: number; efectividad: number }>
  con_multa: number
  pendientes_normalizar: number
  // Client metrics
  cliente_conforme: { conforme: number; disconforme: number; sin_dato: number; sin_inspeccionar: number }
  estado_empalme: Record<string, number>
  cumple_norma_cc: { cumple: number; no_cumple: number; sin_dato: number; sin_inspeccionar: number }
  // Evolution data
  evolucion_mensual: Array<{
    mes: string
    total: number
    efectivas: number
    efectividad: number
    bien_ejecutados: number
    tasa_bien_ejecutado: number
    cliente_conforme: number
    tasa_conformidad: number
    cumple_norma_cc: number
    tasa_cumple_cc: number
  }>
  // Comparativas
  comparativas: {
    efectividad: { actual: number; anterior: number; diferencia: number }
    bien_ejecutado: { actual: number; anterior: number; diferencia: number }
    conformidad: { actual: number; anterior: number; diferencia: number }
    cumple_norma_cc: { actual: number; anterior: number; diferencia: number }
  }
  // Top comunas problemáticas
  top_comunas_problemas: Array<{
    comuna: string
    total: number
    mal_ejecutados: number
    tasa_mal_ejecutado: number
    disconformes: number
    no_cumple_norma: number
    score_problemas: number
  }>
  // Insights
  insights: Array<{
    tipo: 'success' | 'warning' | 'info'
    titulo: string
    mensaje: string
  }>
}

interface InspeccionItem {
  id: number
  cliente: string
  fecha_inspeccion: string
  estado_efectividad: string
  resultado_inspeccion: string
  comuna: string
  zona: string
  inspector: string
  multa: string
  cliente_conforme: string
  estado_empalme: string
  cumple_norma_cc: string
}

interface PaginatedResponse {
  items: InspeccionItem[]
  total: number
  page: number
  limit: number
  pages: number
}

const META_EFECTIVIDAD = 95

const MESES = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
]

export default function InformeNNCCPage() {
  // Global filters
  const [globalZona, setGlobalZona] = useState('')
  const [globalBase, setGlobalBase] = useState('')
  const [globalMes, setGlobalMes] = useState('')
  const [globalAnio, setGlobalAnio] = useState('')
  const [periodos, setPeriodos] = useState<{ meses: number[]; anios: number[] }>({ meses: [], anios: [] })

  // Table filters
  const [dateRange, setDateRange] = useState<DateRangePickerValue>({})
  const [inspector, setInspector] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)

  // Data
  const [stats, setStats] = useState<Stats | null>(null)
  const [data, setData] = useState<PaginatedResponse | null>(null)
  const [zonas, setZonas] = useState<string[]>([])
  const [bases, setBases] = useState<string[]>([])
  const [inspectors, setInspectors] = useState<Array<{ inspector: string; cantidad: number; efectividad: number }>>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState<'excel' | 'csv'>('excel')

  const fetchPeriodos = useCallback(async () => {
    try {
      const response = await api.get<{ meses: number[]; anios: number[] }>('/api/v1/nuevas-conexiones/periodos')
      setPeriodos(response)
    } catch (error) {
      console.error('Error fetching periodos:', error)
    }
  }, [])

  const fetchStats = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (globalZona) params.append('zona', globalZona)
      if (globalBase) params.append('base', globalBase)
      if (globalMes) params.append('mes', globalMes)
      if (globalAnio) params.append('anio', globalAnio)

      const url = `/api/v1/nuevas-conexiones/stats${params.toString() ? '?' + params.toString() : ''}`
      const response = await api.get<Stats>(url)
      setStats(response)
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }, [globalZona, globalBase, globalMes, globalAnio])

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      params.append('page', page.toString())
      params.append('limit', '10')
      if (searchTerm) params.append('search', searchTerm)
      if (globalZona) params.append('zona', globalZona)
      if (globalBase) params.append('base', globalBase)
      if (globalMes) params.append('mes', globalMes)
      if (globalAnio) params.append('anio', globalAnio)
      if (inspector) params.append('inspector', inspector)
      if (dateRange.from) params.append('fecha_desde', dateRange.from.toISOString().split('T')[0])
      if (dateRange.to) params.append('fecha_hasta', dateRange.to.toISOString().split('T')[0])

      const response = await api.get<PaginatedResponse>(`/api/v1/nuevas-conexiones?${params.toString()}`)
      setData(response)
    } catch (error) {
      console.error('Error fetching data:', error)
    }
  }, [page, searchTerm, globalZona, globalBase, globalMes, globalAnio, inspector, dateRange])

  const fetchZonas = useCallback(async () => {
    try {
      const response = await api.get<string[]>('/api/v1/nuevas-conexiones/zonas')
      setZonas(response)
    } catch (error) {
      console.error('Error fetching zonas:', error)
    }
  }, [])

  const fetchBases = useCallback(async () => {
    try {
      const response = await api.get<string[]>('/api/v1/nuevas-conexiones/bases')
      setBases(response)
    } catch (error) {
      console.error('Error fetching bases:', error)
    }
  }, [])

  const fetchInspectors = useCallback(async () => {
    try {
      const response = await api.get<Array<{ inspector: string; cantidad: number; efectividad: number }>>('/api/v1/nuevas-conexiones/inspectors')
      setInspectors(response)
    } catch (error) {
      console.error('Error fetching inspectors:', error)
    }
  }, [])

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true)
      await Promise.all([fetchZonas(), fetchBases(), fetchInspectors(), fetchPeriodos()])
      setLoading(false)
    }
    loadInitialData()
  }, [fetchZonas, fetchBases, fetchInspectors, fetchPeriodos])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const getStatusBadge = (status: string) => {
    if (!status) return <span className="text-gray-400">-</span>
    const isEfectiva = status.toUpperCase().includes('EFECTIVA') && !status.toUpperCase().includes('NO EFECTIVA')
    return (
      <span className={`inline-flex items-center gap-1 text-sm ${isEfectiva ? 'text-emerald-600' : 'text-red-600'}`}>
        {isEfectiva ? <CheckCircle size={14} /> : <XCircle size={14} />}
        {isEfectiva ? 'Efectiva' : 'No Efectiva'}
      </span>
    )
  }

  const getResultadoBadge = (resultado: string) => {
    if (!resultado) return <span className="text-gray-400">-</span>
    const isBien = resultado.toUpperCase().includes('BIEN')
    return (
      <span className={`text-sm ${isBien ? 'text-emerald-600' : 'text-amber-600'}`}>
        {isBien ? 'Bien' : 'Mal'}
      </span>
    )
  }

  const clearFilters = () => {
    setSearchTerm('')
    setInspector('')
    setDateRange({})
    setPage(1)
  }

  const clearGlobalFilters = () => {
    setGlobalZona('')
    setGlobalBase('')
    setGlobalMes('')
    setGlobalAnio('')
  }

  const hasActiveFilters = Boolean(globalZona || globalBase || globalMes || globalAnio || inspector || searchTerm || dateRange.from || dateRange.to)

  const handleExport = async (format: 'csv' | 'excel') => {
    try {
      setExportFormat(format)
      setExporting(true)
      const params: Record<string, string | undefined> = {
        format,
        zona: globalZona || undefined,
        base: globalBase || undefined,
        mes: globalMes || undefined,
        anio: globalAnio || undefined,
        inspector: inspector || undefined,
        search: searchTerm || undefined,
        fecha_desde: dateRange.from ? dateRange.from.toISOString().split('T')[0] : undefined,
        fecha_hasta: dateRange.to ? dateRange.to.toISOString().split('T')[0] : undefined,
      }
      const filename = format === 'excel' ? 'informe_nncc.xlsx' : 'informe_nncc.csv'
      await api.downloadFile('/api/v1/nuevas-conexiones/export', filename, params)
    } catch (error) {
      console.error('Error exporting:', error)
      alert('Error al exportar los datos')
    } finally {
      setExporting(false)
    }
  }

  const zonaChartData = stats ? Object.entries(stats.por_zona).map(([name, value]) => ({
    name,
    value: value as number
  })) : []

  const inspectorChartData = stats?.por_inspector.slice(0, 10).map(i => ({
    inspector: i.inspector,
    cantidad: i.cantidad,
    efectividad: i.efectividad
  })) || []

  const mensualChartData = stats?.por_mes.map(m => ({
    mes: m.mes,
    cantidad: m.cantidad,
    efectividad: m.efectividad,
    meta: META_EFECTIVIDAD
  })) || []

  // Color mapping for consistent chart colors
  const colorMap: Record<string, string> = {
    'Conforme': 'emerald',
    'Disconforme': 'rose',
    'Cumple': 'emerald',
    'No Cumple': 'rose',
    'Sin Dato': 'slate',
    'Sin Inspeccionar': 'zinc',
    'Efectiva': 'emerald',
    'No Efectiva': 'rose',
  }

  // Helper to get colors array based on data order
  const getColorsForData = (data: Array<{ name: string }>) => {
    return data.map(d => colorMap[d.name] || 'gray')
  }

  // Efectividad OCA data
  const efectividadOCAData = stats ? [
    { name: 'Efectiva', value: stats.efectivas },
    { name: 'No Efectiva', value: stats.no_efectivas },
  ].filter(d => d.value > 0) : []

  // Client metrics chart data - keep all values for consistent colors
  const clienteConformeData = stats ? [
    { name: 'Conforme', value: stats.cliente_conforme.conforme },
    { name: 'Disconforme', value: stats.cliente_conforme.disconforme },
    { name: 'Sin Dato', value: stats.cliente_conforme.sin_dato },
    { name: 'Sin Inspeccionar', value: stats.cliente_conforme.sin_inspeccionar },
  ].filter(d => d.value > 0) : []

  const estadoEmpalmeData = stats ? Object.entries(stats.estado_empalme).map(([name, value]) => ({
    name,
    value: value as number
  })).sort((a, b) => b.value - a.value) : []

  const cumpleNormaCCData = stats ? [
    { name: 'Cumple', value: stats.cumple_norma_cc.cumple },
    { name: 'No Cumple', value: stats.cumple_norma_cc.no_cumple },
    { name: 'Sin Dato', value: stats.cumple_norma_cc.sin_dato },
    { name: 'Sin Inspeccionar', value: stats.cumple_norma_cc.sin_inspeccionar },
  ].filter(d => d.value > 0) : []

  // Base for percentages = EFECTIVAS (inspections actually performed)
  const totalEfectivas = stats?.efectivas || 0

  // Calculate totals for percentages (only items with actual response, not S/N or empty)
  const totalClienteConRespuesta = stats ?
    stats.cliente_conforme.conforme + stats.cliente_conforme.disconforme : 0
  const totalNormaCCConRespuesta = stats ?
    stats.cumple_norma_cc.cumple + stats.cumple_norma_cc.no_cumple : 0

  // Evolution chart data with Meta line
  const evolucionData = stats?.evolucion_mensual.map(m => ({
    mes: m.mes,
    'Efectividad': m.efectividad,
    'Bien Ejecutado': m.tasa_bien_ejecutado,
    'Conformidad': m.tasa_conformidad,
    'Cumple Norma CC': m.tasa_cumple_cc,
    'Meta': META_EFECTIVIDAD,
  })) || []

  const calcPercentage = (value: number, total: number) => {
    if (!total) return 0
    return ((value / total) * 100).toFixed(1)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-oca-blue border-t-transparent mx-auto"></div>
          <p className="mt-3 text-sm text-gray-500">Cargando datos...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ExportOverlay
        isVisible={exporting}
        format={exportFormat}
        recordCount={hasActiveFilters ? data?.total : stats?.total}
        hasFilters={hasActiveFilters}
      />
      <Header
        title="Informe NNCC"
        subtitle="Control de Inspecciones de Cumplimiento"
      />

      <div className="p-6">
        {/* Global Filters Bar */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <Flex justifyContent="between" alignItems="center" className="flex-wrap gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-gray-400" />
                <span className="text-sm font-medium text-gray-600">Filtros:</span>
              </div>
              <div className="w-40">
                <Select value={globalZona} onValueChange={setGlobalZona} placeholder="Zona">
                  <SelectItem value="">Todas las zonas</SelectItem>
                  {zonas.map(z => (
                    <SelectItem key={z} value={z}>{z}</SelectItem>
                  ))}
                </Select>
              </div>
              <div className="w-48">
                <Select value={globalBase} onValueChange={setGlobalBase} placeholder="Periodo">
                  <SelectItem value="">Todos los periodos</SelectItem>
                  {bases.map(b => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </Select>
              </div>
              <div className="flex items-center gap-3 ml-4 pl-4 border-l-2 border-gray-300 bg-white rounded-r-lg py-2 pr-4">
                <span className="text-xs text-gray-600 font-medium whitespace-nowrap">Periodo:</span>
                <Select value={globalAnio} onValueChange={setGlobalAnio} placeholder="Año" className="w-32">
                  <SelectItem value="">Año</SelectItem>
                  {periodos.anios.map(a => (
                    <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                  ))}
                </Select>
                <Select value={globalMes} onValueChange={setGlobalMes} placeholder="Mes" className="w-40">
                  <SelectItem value="">Mes</SelectItem>
                  {MESES.filter(m => periodos.meses.includes(m.value)).map(m => (
                    <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                  ))}
                </Select>
              </div>
              {(globalZona || globalBase || globalMes || globalAnio) && (
                <button
                  onClick={clearGlobalFilters}
                  className="text-sm text-oca-blue hover:text-oca-blue-dark"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
            <div className="text-sm text-gray-500">
              {stats && (
                <span>
                  Mostrando <strong>{formatNumber(stats.total)}</strong> registros
                </span>
              )}
            </div>
          </Flex>
        </div>

        {/* KPIs - Resumen minimalista */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{formatNumber(stats?.total || 0)}</p>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Efectivas</p>
            <p className="text-2xl font-semibold text-emerald-600 mt-1">{formatNumber(stats?.efectivas || 0)}</p>
            <p className="text-xs text-gray-400 mt-1">{calcPercentage(stats?.efectivas || 0, stats?.total || 0)}%</p>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">No Efectivas</p>
            <p className="text-2xl font-semibold text-red-600 mt-1">{formatNumber(stats?.no_efectivas || 0)}</p>
            <p className="text-xs text-gray-400 mt-1">{calcPercentage(stats?.no_efectivas || 0, stats?.total || 0)}%</p>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Efectividad</p>
            <p className={`text-2xl font-semibold mt-1 ${stats && stats.tasa_efectividad >= META_EFECTIVIDAD ? 'text-emerald-600' : 'text-amber-600'}`}>
              {stats?.tasa_efectividad || 0}%
            </p>
            <p className="text-xs text-gray-400 mt-1">Meta: {META_EFECTIVIDAD}%</p>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Con Multa</p>
            <p className="text-2xl font-semibold text-red-600 mt-1">{formatNumber(stats?.con_multa || 0)}</p>
          </div>
        </div>

        {/* Tabs */}
        <TabGroup>
          <TabList className="mb-4">
            <Tab icon={Users}>Resumen Ejecutivo</Tab>
            <Tab icon={BarChart3}>Análisis Territorial</Tab>
            <Tab icon={TrendingUp}>Tendencias</Tab>
            <Tab icon={Building}>Datos</Tab>
          </TabList>
          <TabPanels>
            {/* Resumen Ejecutivo Panel */}
            <TabPanel>
              {/* Primera fila: Efectividad OCA y Calidad del Trabajo */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                {/* Efectividad OCA con comparativa */}
                <Card>
                  <Title>Efectividad OCA</Title>
                  <Text className="text-gray-500">Inspecciones realizadas vs no realizadas</Text>
                  <div className="mt-4">
                    <DonutChart
                      className="h-32"
                      data={efectividadOCAData}
                      category="value"
                      index="name"
                      colors={getColorsForData(efectividadOCAData) as any}
                      valueFormatter={(v) => formatNumber(v)}
                      showAnimation
                    />
                  </div>
                  <div className="mt-3 space-y-1.5">
                    <Flex justifyContent="between">
                      <span className="text-sm flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        Efectiva
                      </span>
                      <span className="text-sm font-semibold text-emerald-600">
                        {formatNumber(stats?.efectivas || 0)}
                      </span>
                    </Flex>
                    <Flex justifyContent="between">
                      <span className="text-sm flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                        No Efectiva
                      </span>
                      <span className="text-sm font-semibold text-rose-600">
                        {formatNumber(stats?.no_efectivas || 0)}
                      </span>
                    </Flex>
                  </div>
                  <div className="mt-4 pt-4 border-t">
                    <Flex justifyContent="between" alignItems="center">
                      <div>
                        <p className="text-2xl font-bold text-oca-blue">{stats?.tasa_efectividad || 0}%</p>
                        <p className="text-xs text-gray-500">Tasa de Efectividad</p>
                      </div>
                      {stats && stats.comparativas.efectividad.diferencia !== 0 && (
                        <div className={`flex items-center gap-1 px-2 py-1 rounded ${
                          stats.comparativas.efectividad.diferencia > 0 ? 'bg-emerald-100' : 'bg-rose-100'
                        }`}>
                          {stats.comparativas.efectividad.diferencia > 0 ? (
                            <TrendingUp size={16} className="text-emerald-600" />
                          ) : (
                            <TrendingDown size={16} className="text-rose-600" />
                          )}
                          <span className={`text-sm font-semibold ${
                            stats.comparativas.efectividad.diferencia > 0 ? 'text-emerald-600' : 'text-rose-600'
                          }`}>
                            {stats.comparativas.efectividad.diferencia > 0 ? '+' : ''}{stats.comparativas.efectividad.diferencia}%
                          </span>
                        </div>
                      )}
                    </Flex>
                  </div>
                </Card>

                {/* Trabajo Ejecutado con comparativa */}
                <Card className="lg:col-span-2">
                  <Flex justifyContent="between" alignItems="start">
                    <div>
                      <Title>Calidad del Trabajo Ejecutado</Title>
                      <Text className="text-gray-500">
                        Sobre {formatNumber(totalEfectivas)} inspecciones efectivas
                      </Text>
                    </div>
                    {stats && stats.comparativas.bien_ejecutado.diferencia !== 0 && (
                      <div className={`flex items-center gap-1 px-2 py-1 rounded ${
                        stats.comparativas.bien_ejecutado.diferencia > 0 ? 'bg-emerald-100' : 'bg-rose-100'
                      }`}>
                        {stats.comparativas.bien_ejecutado.diferencia > 0 ? (
                          <TrendingUp size={16} className="text-emerald-600" />
                        ) : (
                          <TrendingDown size={16} className="text-rose-600" />
                        )}
                        <span className={`text-sm font-semibold ${
                          stats.comparativas.bien_ejecutado.diferencia > 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                          {stats.comparativas.bien_ejecutado.diferencia > 0 ? '+' : ''}{stats.comparativas.bien_ejecutado.diferencia}%
                        </span>
                      </div>
                    )}
                  </Flex>
                  <div className="mt-5 grid grid-cols-2 gap-6">
                    <div className="text-center p-4 bg-emerald-50 rounded-lg">
                      <CheckCircle size={28} className="text-emerald-500 mx-auto mb-2" />
                      <p className="text-3xl font-bold text-emerald-600">{formatNumber(stats?.bien_ejecutados || 0)}</p>
                      <p className="text-sm text-gray-600 mt-1">Bien Ejecutados</p>
                      <p className="text-lg font-semibold text-emerald-600 mt-1">
                        {totalEfectivas > 0 ? ((stats?.bien_ejecutados || 0) / totalEfectivas * 100).toFixed(1) : 0}%
                      </p>
                    </div>
                    <div className="text-center p-4 bg-amber-50 rounded-lg">
                      <XCircle size={28} className="text-amber-500 mx-auto mb-2" />
                      <p className="text-3xl font-bold text-amber-600">{formatNumber(stats?.mal_ejecutados || 0)}</p>
                      <p className="text-sm text-gray-600 mt-1">Mal Ejecutados</p>
                      <p className="text-lg font-semibold text-amber-600 mt-1">
                        {totalEfectivas > 0 ? ((stats?.mal_ejecutados || 0) / totalEfectivas * 100).toFixed(1) : 0}%
                      </p>
                    </div>
                  </div>
                  <div className="mt-5">
                    <Flex justifyContent="between" className="mb-2">
                      <span className="text-sm text-gray-600">Tasa de Trabajo Bien Ejecutado</span>
                      <span className="text-sm font-semibold">
                        {totalEfectivas > 0 ? ((stats?.bien_ejecutados || 0) / totalEfectivas * 100).toFixed(1) : 0}%
                      </span>
                    </Flex>
                    <ProgressBar
                      value={totalEfectivas > 0 ? (stats?.bien_ejecutados || 0) / totalEfectivas * 100 : 0}
                      color="emerald"
                    />
                  </div>
                </Card>
              </div>

              {/* Segunda fila: Cliente Conforme y Norma CC */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Cliente Conforme con comparativa */}
                <Card>
                  <Flex justifyContent="between" alignItems="start">
                    <div>
                      <Title>Satisfaccion del Cliente</Title>
                      <Text className="text-gray-500">
                        Sobre {formatNumber(totalClienteConRespuesta)} inspecciones con respuesta
                      </Text>
                    </div>
                    {stats && stats.comparativas.conformidad.diferencia !== 0 && (
                      <div className={`flex items-center gap-1 px-2 py-1 rounded ${
                        stats.comparativas.conformidad.diferencia > 0 ? 'bg-emerald-100' : 'bg-rose-100'
                      }`}>
                        {stats.comparativas.conformidad.diferencia > 0 ? (
                          <TrendingUp size={14} className="text-emerald-600" />
                        ) : (
                          <TrendingDown size={14} className="text-rose-600" />
                        )}
                        <span className={`text-xs font-semibold ${
                          stats.comparativas.conformidad.diferencia > 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                          {stats.comparativas.conformidad.diferencia > 0 ? '+' : ''}{stats.comparativas.conformidad.diferencia}%
                        </span>
                      </div>
                    )}
                  </Flex>
                  <div className="mt-4 flex items-center gap-6">
                    <DonutChart
                      className="h-36"
                      data={clienteConformeData}
                      category="value"
                      index="name"
                      colors={getColorsForData(clienteConformeData) as any}
                      valueFormatter={(v) => formatNumber(v)}
                      showAnimation
                    />
                    <div className="space-y-2">
                      {clienteConformeData.map(item => (
                        <div key={item.name} className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            item.name === 'Conforme' ? 'bg-emerald-500' :
                            item.name === 'Disconforme' ? 'bg-rose-500' :
                            item.name === 'Sin Dato' ? 'bg-slate-400' : 'bg-zinc-300'
                          }`}></span>
                          <span className="text-sm">{item.name}: <strong>{formatNumber(item.value)}</strong></span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {totalClienteConRespuesta > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <Flex justifyContent="between" className="mb-2">
                        <span className="text-sm text-gray-600">Tasa de Conformidad</span>
                        <span className="text-sm font-semibold text-emerald-600">
                          {((stats?.cliente_conforme.conforme || 0) / totalClienteConRespuesta * 100).toFixed(1)}%
                        </span>
                      </Flex>
                      <ProgressBar
                        value={(stats?.cliente_conforme.conforme || 0) / totalClienteConRespuesta * 100}
                        color="emerald"
                      />
                    </div>
                  )}
                </Card>

                {/* Cumple Norma Codigo Colores con comparativa */}
                <Card>
                  <Flex justifyContent="between" alignItems="start">
                    <div>
                      <Title>Cumplimiento Norma Codigo Colores</Title>
                      <Text className="text-gray-500">
                        Sobre {formatNumber(totalNormaCCConRespuesta)} inspecciones con respuesta
                      </Text>
                    </div>
                    {stats && stats.comparativas.cumple_norma_cc.diferencia !== 0 && (
                      <div className={`flex items-center gap-1 px-2 py-1 rounded ${
                        stats.comparativas.cumple_norma_cc.diferencia > 0 ? 'bg-emerald-100' : 'bg-rose-100'
                      }`}>
                        {stats.comparativas.cumple_norma_cc.diferencia > 0 ? (
                          <TrendingUp size={14} className="text-emerald-600" />
                        ) : (
                          <TrendingDown size={14} className="text-rose-600" />
                        )}
                        <span className={`text-xs font-semibold ${
                          stats.comparativas.cumple_norma_cc.diferencia > 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                          {stats.comparativas.cumple_norma_cc.diferencia > 0 ? '+' : ''}{stats.comparativas.cumple_norma_cc.diferencia}%
                        </span>
                      </div>
                    )}
                  </Flex>
                  <div className="mt-4 flex items-center gap-6">
                    <DonutChart
                      className="h-36"
                      data={cumpleNormaCCData}
                      category="value"
                      index="name"
                      colors={getColorsForData(cumpleNormaCCData) as any}
                      valueFormatter={(v) => formatNumber(v)}
                      showAnimation
                    />
                    <div className="space-y-2">
                      {cumpleNormaCCData.map(item => (
                        <div key={item.name} className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            item.name === 'Cumple' ? 'bg-emerald-500' :
                            item.name === 'No Cumple' ? 'bg-rose-500' :
                            item.name === 'Sin Dato' ? 'bg-slate-400' : 'bg-zinc-300'
                          }`}></span>
                          <span className="text-sm">{item.name}: <strong>{formatNumber(item.value)}</strong></span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {totalNormaCCConRespuesta > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <Flex justifyContent="between" className="mb-2">
                        <span className="text-sm text-gray-600">Tasa de Cumplimiento</span>
                        <span className="text-sm font-semibold text-emerald-600">
                          {((stats?.cumple_norma_cc.cumple || 0) / totalNormaCCConRespuesta * 100).toFixed(1)}%
                        </span>
                      </Flex>
                      <ProgressBar
                        value={(stats?.cumple_norma_cc.cumple || 0) / totalNormaCCConRespuesta * 100}
                        color="emerald"
                      />
                    </div>
                  )}
                </Card>
              </div>

              {/* Tercera fila: Estado Empalme */}
              <div className="grid grid-cols-1 gap-6 mb-6">
                {/* Estado Empalme */}
                <Card>
                  <Title>Estado del Empalme</Title>
                  <Text className="text-gray-500">Condición del empalme al momento de inspección</Text>
                  <BarChart
                    className="mt-4 h-48"
                    data={estadoEmpalmeData}
                    index="name"
                    categories={['value']}
                    colors={['blue']}
                    valueFormatter={(v) => formatNumber(v)}
                    yAxisWidth={48}
                    showAnimation
                  />
                </Card>
              </div>

              {/* Cuarta fila: Evolución Temporal */}
              {evolucionData.length > 0 && (
                <div className="grid grid-cols-1 gap-6">
                  <Card>
                    <Title>Evolución de Indicadores de Calidad</Title>
                    <Text className="text-gray-500">Tendencia mensual de los principales indicadores (%)</Text>
                    <LineChart
                      className="mt-6 h-80"
                      data={evolucionData}
                      index="mes"
                      categories={['Efectividad', 'Bien Ejecutado', 'Conformidad', 'Cumple Norma CC', 'Meta']}
                      colors={['blue', 'emerald', 'amber', 'violet', 'gray']}
                      valueFormatter={(v) => `${v}%`}
                      yAxisWidth={45}
                      showAnimation
                      curveType="monotone"
                    />
                    <div className="mt-4 flex flex-wrap gap-4 justify-center">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                        <span className="text-sm text-gray-600">Efectividad OCA</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                        <span className="text-sm text-gray-600">Bien Ejecutado</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                        <span className="text-sm text-gray-600">Conformidad Cliente</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-violet-500"></span>
                        <span className="text-sm text-gray-600">Cumple Norma CC</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-0.5 bg-gray-400"></span>
                        <span className="text-sm text-gray-600">Meta ({META_EFECTIVIDAD}%)</span>
                      </div>
                    </div>
                  </Card>
                </div>
              )}
            </TabPanel>

            {/* Análisis Territorial Panel */}
            <TabPanel>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                {/* Distribución por zona */}
                <Card>
                  <Title>Distribución por Zona</Title>
                  <DonutChart
                    className="mt-4 h-48"
                    data={zonaChartData}
                    category="value"
                    index="name"
                    colors={['slate', 'blue', 'cyan', 'indigo']}
                    valueFormatter={(v) => formatNumber(v)}
                    showAnimation
                  />
                  <div className="mt-4 space-y-2">
                    {zonaChartData.map((z) => (
                      <Flex key={z.name} justifyContent="between">
                        <Text className="text-sm">{z.name}</Text>
                        <Text className="text-sm font-medium">{formatNumber(z.value)}</Text>
                      </Flex>
                    ))}
                  </div>
                </Card>

                {/* Inspecciones por mes */}
                <Card className="lg:col-span-2">
                  <Title>Volumen de Inspecciones por Mes</Title>
                  <BarChart
                    className="mt-4 h-64"
                    data={mensualChartData}
                    index="mes"
                    categories={['cantidad']}
                    colors={['blue']}
                    valueFormatter={(v) => formatNumber(v)}
                    yAxisWidth={48}
                    showAnimation
                  />
                </Card>
              </div>

              {/* Top 5 Comunas Problemáticas - Movido desde Vista Cliente */}
              <Card className="mb-6">
                <Title>Comunas con Mayor Incidencia de Problemas</Title>
                <Text className="text-gray-500">Comunas con más problemas de ejecución, conformidad y normativa</Text>
                <div className="mt-4 grid grid-cols-1 lg:grid-cols-5 gap-4">
                  {stats?.top_comunas_problemas && stats.top_comunas_problemas.length > 0 ? (
                    stats.top_comunas_problemas.map((comuna, idx) => (
                      <div key={comuna.comuna} className="p-4 bg-gray-50 rounded-lg border-l-4 border-l-rose-400">
                        <div className="flex items-start gap-2 mb-3">
                          <span className={`flex items-center justify-center w-6 h-6 rounded-full text-sm font-bold ${
                            idx === 0 ? 'bg-rose-100 text-rose-600' :
                            idx === 1 ? 'bg-amber-100 text-amber-600' :
                            'bg-gray-200 text-gray-600'
                          }`}>{idx + 1}</span>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{comuna.comuna}</p>
                            <p className="text-xs text-gray-500">{formatNumber(comuna.total)} insp.</p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-500">Mal ejecutados</span>
                            <span className="font-medium text-amber-600">{comuna.mal_ejecutados}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-500">Disconformes</span>
                            <span className="font-medium text-rose-600">{comuna.disconformes}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-500">No cumple norma</span>
                            <span className="font-medium text-violet-600">{comuna.no_cumple_norma}</span>
                          </div>
                          <div className="pt-2 border-t mt-2">
                            <p className="text-lg font-bold text-rose-600">{comuna.tasa_mal_ejecutado}%</p>
                            <p className="text-xs text-gray-400">tasa mal ejecutado</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-5 text-center py-6 text-gray-400">
                      <AlertCircle size={24} className="mx-auto mb-2" />
                      <p className="text-sm">No hay datos suficientes</p>
                    </div>
                  )}
                </div>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Tendencia Efectividad por Zona */}
                <Card>
                  <Title>Tendencia de Efectividad</Title>
                  <Text className="text-gray-500">Meta: {META_EFECTIVIDAD}%</Text>
                  <AreaChart
                    className="mt-4 h-48"
                    data={mensualChartData}
                    index="mes"
                    categories={['efectividad', 'meta']}
                    colors={['emerald', 'gray']}
                    valueFormatter={(v) => `${v}%`}
                    yAxisWidth={40}
                    showAnimation
                  />
                </Card>

                {/* Calidad del Contratista - Multas */}
                <Card>
                  <Title>Calidad del Contratista</Title>
                  <Text className="text-gray-500">Multas aplicadas por incumplimiento</Text>
                  <div className="mt-6 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-red-50 rounded-lg text-center">
                        <p className="text-2xl font-bold text-red-600">{formatNumber(stats?.con_multa || 0)}</p>
                        <Text className="text-sm text-gray-600 mt-1">Con Multa</Text>
                        <p className="text-xs text-gray-400 mt-1">
                          {stats?.total ? ((stats.con_multa / stats.total) * 100).toFixed(1) : 0}% del total
                        </p>
                      </div>
                      <div className="p-4 bg-orange-50 rounded-lg text-center">
                        <p className="text-2xl font-bold text-orange-600">{formatNumber(stats?.pendientes_normalizar || 0)}</p>
                        <Text className="text-sm text-gray-600 mt-1">Pendientes Normalizar</Text>
                      </div>
                    </div>
                    <div>
                      <Flex justifyContent="between" className="mb-2">
                        <Text className="text-sm font-medium">Tasa de Cumplimiento (Sin Multa)</Text>
                        <Text className="text-sm font-semibold text-emerald-600">
                          {stats ? (100 - (stats.con_multa / stats.total) * 100).toFixed(1) : 0}%
                        </Text>
                      </Flex>
                      <ProgressBar
                        value={stats ? 100 - (stats.con_multa / stats.total) * 100 : 0}
                        color="emerald"
                      />
                    </div>
                  </div>
                </Card>
              </div>
            </TabPanel>

            {/* Tendencias Panel */}
            <TabPanel>
              <Card>
                  <Title>Comparativa Mes Actual vs Anterior</Title>
                  <Text className="text-gray-500">Variacion de indicadores clave</Text>
                  <div className="mt-6 space-y-4">
                    {/* Efectividad */}
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <Flex justifyContent="between" alignItems="center">
                        <div>
                          <p className="text-sm font-medium text-gray-700">Efectividad OCA</p>
                          <p className="text-xs text-gray-400 mt-1">
                            Anterior: {stats?.comparativas.efectividad.anterior || 0}%
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-oca-blue">{stats?.comparativas.efectividad.actual || 0}%</p>
                          {stats && stats.comparativas.efectividad.diferencia !== 0 && (
                            <div className={`flex items-center justify-end gap-1 ${
                              stats.comparativas.efectividad.diferencia > 0 ? 'text-emerald-600' : 'text-rose-600'
                            }`}>
                              {stats.comparativas.efectividad.diferencia > 0 ? (
                                <TrendingUp size={14} />
                              ) : (
                                <TrendingDown size={14} />
                              )}
                              <span className="text-sm font-semibold">
                                {stats.comparativas.efectividad.diferencia > 0 ? '+' : ''}
                                {stats.comparativas.efectividad.diferencia}%
                              </span>
                            </div>
                          )}
                        </div>
                      </Flex>
                    </div>

                    {/* Bien Ejecutado */}
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <Flex justifyContent="between" alignItems="center">
                        <div>
                          <p className="text-sm font-medium text-gray-700">Trabajo Bien Ejecutado</p>
                          <p className="text-xs text-gray-400 mt-1">
                            Anterior: {stats?.comparativas.bien_ejecutado.anterior || 0}%
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-emerald-600">{stats?.comparativas.bien_ejecutado.actual || 0}%</p>
                          {stats && stats.comparativas.bien_ejecutado.diferencia !== 0 && (
                            <div className={`flex items-center justify-end gap-1 ${
                              stats.comparativas.bien_ejecutado.diferencia > 0 ? 'text-emerald-600' : 'text-rose-600'
                            }`}>
                              {stats.comparativas.bien_ejecutado.diferencia > 0 ? (
                                <TrendingUp size={14} />
                              ) : (
                                <TrendingDown size={14} />
                              )}
                              <span className="text-sm font-semibold">
                                {stats.comparativas.bien_ejecutado.diferencia > 0 ? '+' : ''}
                                {stats.comparativas.bien_ejecutado.diferencia}%
                              </span>
                            </div>
                          )}
                        </div>
                      </Flex>
                    </div>

                    {/* Conformidad */}
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <Flex justifyContent="between" alignItems="center">
                        <div>
                          <p className="text-sm font-medium text-gray-700">Conformidad del Cliente</p>
                          <p className="text-xs text-gray-400 mt-1">
                            Anterior: {stats?.comparativas.conformidad.anterior || 0}%
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-amber-600">{stats?.comparativas.conformidad.actual || 0}%</p>
                          {stats && stats.comparativas.conformidad.diferencia !== 0 && (
                            <div className={`flex items-center justify-end gap-1 ${
                              stats.comparativas.conformidad.diferencia > 0 ? 'text-emerald-600' : 'text-rose-600'
                            }`}>
                              {stats.comparativas.conformidad.diferencia > 0 ? (
                                <TrendingUp size={14} />
                              ) : (
                                <TrendingDown size={14} />
                              )}
                              <span className="text-sm font-semibold">
                                {stats.comparativas.conformidad.diferencia > 0 ? '+' : ''}
                                {stats.comparativas.conformidad.diferencia}%
                              </span>
                            </div>
                          )}
                        </div>
                      </Flex>
                    </div>

                    {/* Cumple Norma CC */}
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <Flex justifyContent="between" alignItems="center">
                        <div>
                          <p className="text-sm font-medium text-gray-700">Cumplimiento Norma CC</p>
                          <p className="text-xs text-gray-400 mt-1">
                            Anterior: {stats?.comparativas.cumple_norma_cc.anterior || 0}%
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-violet-600">{stats?.comparativas.cumple_norma_cc.actual || 0}%</p>
                          {stats && stats.comparativas.cumple_norma_cc.diferencia !== 0 && (
                            <div className={`flex items-center justify-end gap-1 ${
                              stats.comparativas.cumple_norma_cc.diferencia > 0 ? 'text-emerald-600' : 'text-rose-600'
                            }`}>
                              {stats.comparativas.cumple_norma_cc.diferencia > 0 ? (
                                <TrendingUp size={14} />
                              ) : (
                                <TrendingDown size={14} />
                              )}
                              <span className="text-sm font-semibold">
                                {stats.comparativas.cumple_norma_cc.diferencia > 0 ? '+' : ''}
                                {stats.comparativas.cumple_norma_cc.diferencia}%
                              </span>
                            </div>
                          )}
                        </div>
                      </Flex>
                    </div>
                  </div>
                </Card>

            </TabPanel>

            {/* Datos Panel */}
            <TabPanel>
              {/* Table Filters */}
              <Card className="mb-4">
                <Flex justifyContent="between" alignItems="end" className="flex-wrap gap-4">
                  <div className="flex flex-wrap gap-3">
                    <div className="w-56">
                      <TextInput
                        icon={Search}
                        placeholder="Buscar..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <div className="w-48">
                      <Select value={inspector} onValueChange={setInspector} placeholder="Inspector">
                        <SelectItem value="">Todos</SelectItem>
                        {inspectors.slice(0, 20).map(i => (
                          <SelectItem key={i.inspector} value={i.inspector}>{i.inspector}</SelectItem>
                        ))}
                      </Select>
                    </div>
                    <div className="w-56">
                      <DateRangePicker
                        value={dateRange}
                        onValueChange={setDateRange}
                        placeholder="Fechas"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={clearFilters}>
                      <Filter size={14} />
                      Limpiar
                    </Button>
                    <ExportDropdown
                      onExport={handleExport}
                      loading={exporting}
                      loadingFormat={exporting ? exportFormat : null}
                      totalRecords={data?.total}
                      hasFilters={hasActiveFilters}
                    />
                  </div>
                </Flex>
              </Card>

              {/* Table */}
              <Card>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Cliente</TableHeaderCell>
                      <TableHeaderCell>Fecha</TableHeaderCell>
                      <TableHeaderCell>Estado</TableHeaderCell>
                      <TableHeaderCell>Resultado</TableHeaderCell>
                      <TableHeaderCell>Cliente Conforme</TableHeaderCell>
                      <TableHeaderCell>Zona</TableHeaderCell>
                      <TableHeaderCell>Inspector</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data?.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.cliente}</TableCell>
                        <TableCell className="text-gray-500">{item.fecha_inspeccion}</TableCell>
                        <TableCell>{getStatusBadge(item.estado_efectividad)}</TableCell>
                        <TableCell>{getResultadoBadge(item.resultado_inspeccion)}</TableCell>
                        <TableCell>
                          {item.cliente_conforme?.toUpperCase() === 'SI' ? (
                            <span className="text-emerald-600 text-sm">Si</span>
                          ) : item.cliente_conforme?.toUpperCase() === 'NO' ? (
                            <span className="text-red-600 text-sm">No</span>
                          ) : (
                            <span className="text-gray-400 text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-gray-500">{item.zona}</TableCell>
                        <TableCell className="text-gray-500 truncate max-w-[150px]">{item.inspector}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                <Flex justifyContent="between" className="mt-4 pt-4 border-t">
                  <Text className="text-sm text-gray-500">
                    {((data?.page || 1) - 1) * 10 + 1}-{Math.min((data?.page || 1) * 10, data?.total || 0)} de {formatNumber(data?.total || 0)}
                  </Text>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={page >= (data?.pages || 1)}
                      onClick={() => setPage(p => p + 1)}
                    >
                      Siguiente
                    </Button>
                  </div>
                </Flex>
              </Card>
            </TabPanel>
          </TabPanels>
        </TabGroup>
      </div>
    </div>
  )
}
