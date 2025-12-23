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
import { Download, Search, Filter, CheckCircle, XCircle, Users, Building, BarChart3, TrendingUp, TrendingDown, AlertTriangle, Info, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
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
  monto_estimado: number
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

export default function InformeNNCCPage() {
  // Global filters
  const [globalZona, setGlobalZona] = useState('')
  const [globalBase, setGlobalBase] = useState('')

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

  const fetchStats = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (globalZona) params.append('zona', globalZona)
      if (globalBase) params.append('base', globalBase)

      const url = `/api/v1/nuevas-conexiones/stats${params.toString() ? '?' + params.toString() : ''}`
      const response = await api.get<Stats>(url)
      setStats(response)
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }, [globalZona, globalBase])

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      params.append('page', page.toString())
      params.append('limit', '10')
      if (searchTerm) params.append('search', searchTerm)
      if (globalZona) params.append('zona', globalZona)
      if (globalBase) params.append('base', globalBase)
      if (inspector) params.append('inspector', inspector)
      if (dateRange.from) params.append('fecha_desde', dateRange.from.toISOString().split('T')[0])
      if (dateRange.to) params.append('fecha_hasta', dateRange.to.toISOString().split('T')[0])

      const response = await api.get<PaginatedResponse>(`/api/v1/nuevas-conexiones?${params.toString()}`)
      setData(response)
    } catch (error) {
      console.error('Error fetching data:', error)
    }
  }, [page, searchTerm, globalZona, globalBase, inspector, dateRange])

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
      await Promise.all([fetchZonas(), fetchBases(), fetchInspectors()])
      setLoading(false)
    }
    loadInitialData()
  }, [fetchZonas, fetchBases, fetchInspectors])

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

  const formatCLP = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(value)
  }

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
              {(globalZona || globalBase) && (
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
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

          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Monto Est.</p>
            <p className="text-xl font-semibold text-gray-900 mt-1">{formatCLP(stats?.monto_estimado || 0)}</p>
          </div>
        </div>

        {/* Tabs */}
        <TabGroup>
          <TabList className="mb-4">
            <Tab icon={Users}>Vista Cliente</Tab>
            <Tab icon={BarChart3}>Vista Interna</Tab>
            <Tab icon={AlertCircle}>Insights</Tab>
            <Tab icon={Building}>Datos</Tab>
          </TabList>
          <TabPanels>
            {/* Vista Cliente Panel */}
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
                      {stats?.comparativas.efectividad.diferencia !== 0 && (
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
                    {stats?.comparativas.bien_ejecutado.diferencia !== 0 && (
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
                    {stats?.comparativas.conformidad.diferencia !== 0 && (
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
                    {stats?.comparativas.cumple_norma_cc.diferencia !== 0 && (
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

              {/* Tercera fila: Estado Empalme y Resumen */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Estado Empalme */}
                <Card>
                  <Title>Estado del Empalme</Title>
                  <Text className="text-gray-500">Condicion del empalme al momento de inspeccion</Text>
                  <BarChart
                    className="mt-4 h-64"
                    data={estadoEmpalmeData}
                    index="name"
                    categories={['value']}
                    colors={['blue']}
                    valueFormatter={(v) => formatNumber(v)}
                    layout="vertical"
                    yAxisWidth={150}
                    showAnimation
                  />
                </Card>

                {/* Top 5 Comunas Problemáticas */}
                <Card>
                  <Title>Top 5 Comunas con Mayor Incidencia</Title>
                  <Text className="text-gray-500">Comunas con mas problemas de ejecucion, conformidad y normativa</Text>
                  <div className="mt-4 space-y-3">
                    {stats?.top_comunas_problemas && stats.top_comunas_problemas.length > 0 ? (
                      stats.top_comunas_problemas.map((comuna, idx) => (
                        <div key={comuna.comuna} className="p-3 bg-gray-50 rounded-lg">
                          <Flex justifyContent="between" alignItems="start">
                            <div className="flex items-start gap-3">
                              <span className={`flex items-center justify-center w-6 h-6 rounded-full text-sm font-bold ${
                                idx === 0 ? 'bg-rose-100 text-rose-600' :
                                idx === 1 ? 'bg-amber-100 text-amber-600' :
                                'bg-gray-200 text-gray-600'
                              }`}>{idx + 1}</span>
                              <div>
                                <p className="text-sm font-semibold text-gray-800">{comuna.comuna}</p>
                                <p className="text-xs text-gray-500 mt-1">{formatNumber(comuna.total)} inspecciones</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-rose-600">{comuna.tasa_mal_ejecutado}%</p>
                              <p className="text-xs text-gray-400">mal ejecutado</p>
                            </div>
                          </Flex>
                          <div className="mt-2 flex gap-3 text-xs">
                            <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded">
                              {comuna.mal_ejecutados} mal ejec.
                            </span>
                            <span className="px-2 py-1 bg-rose-100 text-rose-700 rounded">
                              {comuna.disconformes} disconf.
                            </span>
                            <span className="px-2 py-1 bg-violet-100 text-violet-700 rounded">
                              {comuna.no_cumple_norma} no cumple
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 text-gray-400">
                        <AlertCircle size={24} className="mx-auto mb-2" />
                        <p className="text-sm">No hay datos suficientes</p>
                      </div>
                    )}
                  </div>
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

            {/* Vista Interna Panel */}
            <TabPanel>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                {/* Estadisticas por zona */}
                <Card>
                  <Title>Distribucion por Zona</Title>
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
                  <Title>Inspecciones por Mes</Title>
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

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Top Inspectores */}
                <Card>
                  <Title>Top 10 Inspectores</Title>
                  <Text className="text-gray-500">Por cantidad de inspecciones</Text>
                  <BarChart
                    className="mt-4 h-80"
                    data={inspectorChartData}
                    index="inspector"
                    categories={['cantidad']}
                    colors={['blue']}
                    valueFormatter={(v) => formatNumber(v)}
                    layout="vertical"
                    yAxisWidth={120}
                    showAnimation
                  />
                </Card>

                {/* Efectividad por Inspector */}
                <Card>
                  <Title>Efectividad por Inspector</Title>
                  <div className="mt-4 space-y-3">
                    {inspectorChartData.map((insp) => (
                      <div key={insp.inspector}>
                        <Flex justifyContent="between" className="mb-1">
                          <Text className="text-sm truncate max-w-[180px]">{insp.inspector}</Text>
                          <div className="flex items-center gap-3">
                            <Text className="text-xs text-gray-400">{formatNumber(insp.cantidad)}</Text>
                            <span className={`text-sm font-medium ${insp.efectividad >= META_EFECTIVIDAD ? 'text-emerald-600' : 'text-amber-600'}`}>
                              {insp.efectividad}%
                            </span>
                          </div>
                        </Flex>
                        <ProgressBar
                          value={insp.efectividad}
                          color={insp.efectividad >= META_EFECTIVIDAD ? 'emerald' : 'amber'}
                        />
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Tendencia Efectividad */}
                <Card>
                  <Title>Tendencia Efectividad</Title>
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

                {/* Resumen Montos */}
                <Card>
                  <Title>Resumen Financiero</Title>
                  <div className="mt-6 space-y-6">
                    <div>
                      <Text className="text-sm text-gray-500">Monto Total Estimado</Text>
                      <p className="text-3xl font-semibold text-gray-900 mt-1">{formatCLP(stats?.monto_estimado || 0)}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Text className="text-sm text-gray-500">Inspecciones c/Multa</Text>
                        <p className="text-xl font-semibold text-red-600 mt-1">{formatNumber(stats?.con_multa || 0)}</p>
                      </div>
                      <div>
                        <Text className="text-sm text-gray-500">Pendientes Normalizar</Text>
                        <p className="text-xl font-semibold text-orange-600 mt-1">{formatNumber(stats?.pendientes_normalizar || 0)}</p>
                      </div>
                    </div>
                    <div>
                      <Flex justifyContent="between" className="mb-1">
                        <Text className="text-sm">Tasa Sin Multa</Text>
                        <Text className="text-sm font-medium">{stats ? (100 - (stats.con_multa / stats.total) * 100).toFixed(1) : 0}%</Text>
                      </Flex>
                      <ProgressBar value={stats ? 100 - (stats.con_multa / stats.total) * 100 : 0} color="slate" />
                    </div>
                  </div>
                </Card>
              </div>

              {/* Tabla Inspectores */}
              <Card className="mt-6">
                <Title>Todos los Inspectores</Title>
                <Table className="mt-4">
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>#</TableHeaderCell>
                      <TableHeaderCell>Inspector</TableHeaderCell>
                      <TableHeaderCell className="text-right">Cantidad</TableHeaderCell>
                      <TableHeaderCell className="text-right">Efectividad</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {inspectors.slice(0, 15).map((insp, i) => (
                      <TableRow key={insp.inspector}>
                        <TableCell className="text-gray-400">{i + 1}</TableCell>
                        <TableCell>{insp.inspector}</TableCell>
                        <TableCell className="text-right">{formatNumber(insp.cantidad)}</TableCell>
                        <TableCell className="text-right">
                          <span className={insp.efectividad >= META_EFECTIVIDAD ? 'text-emerald-600' : 'text-amber-600'}>
                            {insp.efectividad}%
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabPanel>

            {/* Insights Panel */}
            <TabPanel>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Alertas y Advertencias */}
                <Card>
                  <Title>Alertas y Recomendaciones</Title>
                  <Text className="text-gray-500">Puntos de atencion basados en los datos actuales</Text>
                  <div className="mt-6 space-y-4">
                    {stats?.insights && stats.insights.length > 0 ? (
                      stats.insights.map((insight, idx) => (
                        <div
                          key={idx}
                          className={`p-4 rounded-lg border-l-4 ${
                            insight.tipo === 'success' ? 'bg-emerald-50 border-emerald-500' :
                            insight.tipo === 'warning' ? 'bg-amber-50 border-amber-500' :
                            'bg-blue-50 border-blue-500'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {insight.tipo === 'success' ? (
                              <CheckCircle size={20} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                            ) : insight.tipo === 'warning' ? (
                              <AlertTriangle size={20} className="text-amber-500 mt-0.5 flex-shrink-0" />
                            ) : (
                              <Info size={20} className="text-blue-500 mt-0.5 flex-shrink-0" />
                            )}
                            <div>
                              <p className={`text-sm font-semibold ${
                                insight.tipo === 'success' ? 'text-emerald-700' :
                                insight.tipo === 'warning' ? 'text-amber-700' :
                                'text-blue-700'
                              }`}>{insight.titulo}</p>
                              <p className="text-sm text-gray-600 mt-1">{insight.mensaje}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-400">
                        <CheckCircle size={32} className="mx-auto mb-3 text-emerald-400" />
                        <p className="text-sm font-medium text-gray-600">Todo en orden</p>
                        <p className="text-xs text-gray-400 mt-1">No hay alertas o advertencias activas</p>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Comparativas Mes a Mes */}
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
                          {stats?.comparativas.efectividad.diferencia !== 0 && (
                            <div className={`flex items-center justify-end gap-1 ${
                              (stats?.comparativas.efectividad.diferencia || 0) > 0 ? 'text-emerald-600' : 'text-rose-600'
                            }`}>
                              {(stats?.comparativas.efectividad.diferencia || 0) > 0 ? (
                                <TrendingUp size={14} />
                              ) : (
                                <TrendingDown size={14} />
                              )}
                              <span className="text-sm font-semibold">
                                {(stats?.comparativas.efectividad.diferencia || 0) > 0 ? '+' : ''}
                                {stats?.comparativas.efectividad.diferencia}%
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
                          {stats?.comparativas.bien_ejecutado.diferencia !== 0 && (
                            <div className={`flex items-center justify-end gap-1 ${
                              (stats?.comparativas.bien_ejecutado.diferencia || 0) > 0 ? 'text-emerald-600' : 'text-rose-600'
                            }`}>
                              {(stats?.comparativas.bien_ejecutado.diferencia || 0) > 0 ? (
                                <TrendingUp size={14} />
                              ) : (
                                <TrendingDown size={14} />
                              )}
                              <span className="text-sm font-semibold">
                                {(stats?.comparativas.bien_ejecutado.diferencia || 0) > 0 ? '+' : ''}
                                {stats?.comparativas.bien_ejecutado.diferencia}%
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
                          {stats?.comparativas.conformidad.diferencia !== 0 && (
                            <div className={`flex items-center justify-end gap-1 ${
                              (stats?.comparativas.conformidad.diferencia || 0) > 0 ? 'text-emerald-600' : 'text-rose-600'
                            }`}>
                              {(stats?.comparativas.conformidad.diferencia || 0) > 0 ? (
                                <TrendingUp size={14} />
                              ) : (
                                <TrendingDown size={14} />
                              )}
                              <span className="text-sm font-semibold">
                                {(stats?.comparativas.conformidad.diferencia || 0) > 0 ? '+' : ''}
                                {stats?.comparativas.conformidad.diferencia}%
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
                          {stats?.comparativas.cumple_norma_cc.diferencia !== 0 && (
                            <div className={`flex items-center justify-end gap-1 ${
                              (stats?.comparativas.cumple_norma_cc.diferencia || 0) > 0 ? 'text-emerald-600' : 'text-rose-600'
                            }`}>
                              {(stats?.comparativas.cumple_norma_cc.diferencia || 0) > 0 ? (
                                <TrendingUp size={14} />
                              ) : (
                                <TrendingDown size={14} />
                              )}
                              <span className="text-sm font-semibold">
                                {(stats?.comparativas.cumple_norma_cc.diferencia || 0) > 0 ? '+' : ''}
                                {stats?.comparativas.cumple_norma_cc.diferencia}%
                              </span>
                            </div>
                          )}
                        </div>
                      </Flex>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Top Comunas Problemáticas */}
              <Card className="mt-6">
                <Title>Comunas que Requieren Atencion</Title>
                <Text className="text-gray-500">Top 5 comunas con mayor indice de problemas (mal ejecutados, disconformes, no cumple norma)</Text>
                <div className="mt-6">
                  {stats?.top_comunas_problemas && stats.top_comunas_problemas.length > 0 ? (
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableHeaderCell>#</TableHeaderCell>
                          <TableHeaderCell>Comuna</TableHeaderCell>
                          <TableHeaderCell className="text-right">Total Insp.</TableHeaderCell>
                          <TableHeaderCell className="text-right">Mal Ejecutados</TableHeaderCell>
                          <TableHeaderCell className="text-right">% Mal Ejec.</TableHeaderCell>
                          <TableHeaderCell className="text-right">Disconformes</TableHeaderCell>
                          <TableHeaderCell className="text-right">No Cumple Norma</TableHeaderCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {stats.top_comunas_problemas.map((comuna, idx) => (
                          <TableRow key={comuna.comuna}>
                            <TableCell>
                              <span className={`flex items-center justify-center w-6 h-6 rounded-full text-sm font-bold ${
                                idx === 0 ? 'bg-rose-100 text-rose-600' :
                                idx === 1 ? 'bg-amber-100 text-amber-600' :
                                'bg-gray-100 text-gray-600'
                              }`}>{idx + 1}</span>
                            </TableCell>
                            <TableCell className="font-medium">{comuna.comuna}</TableCell>
                            <TableCell className="text-right">{formatNumber(comuna.total)}</TableCell>
                            <TableCell className="text-right text-amber-600 font-medium">{formatNumber(comuna.mal_ejecutados)}</TableCell>
                            <TableCell className="text-right">
                              <span className={`px-2 py-1 rounded text-sm font-medium ${
                                comuna.tasa_mal_ejecutado >= 30 ? 'bg-rose-100 text-rose-700' :
                                comuna.tasa_mal_ejecutado >= 15 ? 'bg-amber-100 text-amber-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {comuna.tasa_mal_ejecutado}%
                              </span>
                            </TableCell>
                            <TableCell className="text-right text-rose-600 font-medium">{formatNumber(comuna.disconformes)}</TableCell>
                            <TableCell className="text-right text-violet-600 font-medium">{formatNumber(comuna.no_cumple_norma)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <CheckCircle size={32} className="mx-auto mb-3 text-emerald-400" />
                      <p className="text-sm">No hay datos suficientes para analisis</p>
                    </div>
                  )}
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
                    <Button variant="secondary" size="sm">
                      <Download size={14} />
                      Exportar
                    </Button>
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
