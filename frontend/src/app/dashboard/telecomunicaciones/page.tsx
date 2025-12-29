'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/Header'
import {
  Card,
  Title,
  Text,
  Flex,
  Table,
  TableHead,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
  Select,
  SelectItem,
  TextInput,
  DateRangePicker,
  DateRangePickerItem,
  DateRangePickerValue,
  BarChart,
  DonutChart,
  AreaChart,
  Tab,
  TabGroup,
  TabList,
  TabPanel,
  TabPanels,
  ProgressBar,
} from '@tremor/react'
import { Search, Filter, CheckCircle, XCircle, TrendingUp, TrendingDown, Info, AlertCircle, Building2, Users, MapPin, FileCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ExportOverlay } from '@/components/ui/ExportOverlay'
import { ExportDropdown } from '@/components/ui/ExportDropdown'
import { formatNumber } from '@/lib/utils'
import { api } from '@/lib/api'
import { es } from 'date-fns/locale'
import { startOfMonth, startOfYear, subDays } from 'date-fns'

// Opciones de rango de fechas en español
const dateRangeOptions = [
  { value: 'today', text: 'Hoy', from: new Date(), to: new Date() },
  { value: 'last7', text: 'Últimos 7 días', from: subDays(new Date(), 7), to: new Date() },
  { value: 'last30', text: 'Últimos 30 días', from: subDays(new Date(), 30), to: new Date() },
  { value: 'month', text: 'Este mes', from: startOfMonth(new Date()), to: new Date() },
  { value: 'year', text: 'Este año', from: startOfYear(new Date()), to: new Date() },
]

interface Stats {
  total: number
  aprobados: number
  rechazados: number
  tasa_aprobacion: number
  total_postes: number
  promedio_postes: number
  con_plano: number
  sin_plano: number
  plano_incompleto: number
  por_empresa: Array<{ empresa: string; cantidad: number; aprobados: number; tasa_aprobacion: number; postes: number }>
  por_comuna: Array<{ comuna: string; cantidad: number }>
  por_inspector: Array<{ inspector: string; cantidad: number; aprobados: number; tasa_aprobacion: number; postes: number }>
  por_resultado: Record<string, number>
  por_mes: Array<{ mes: string; cantidad: number; aprobados: number; tasa_aprobacion: number }>
  por_tiene_plano: Array<{ tipo: string; cantidad: number }>
  motivos_rechazo: Array<{ motivo: string; cantidad: number; porcentaje: number }>
  evolucion_mensual: Array<{ periodo: string; casos: number; postes: number; aprobados: number }>
  comparativas: {
    aprobacion: { actual: number; anterior: number; diferencia: number }
  }
  insights: Array<{ tipo: 'success' | 'warning' | 'info'; titulo: string; mensaje: string }>
}

interface TelecoItem {
  id: number
  numero_caso: string
  family_case: string
  empresa_corta: string
  comuna: string
  cantidad_postes: number
  fecha_inspeccion: string
  resultado: string
  tiene_plano_norm: string
  inspector: string
  observacion: string
  estado_simple: string
}

interface PaginatedResponse {
  items: TelecoItem[]
  total: number
  page: number
  limit: number
  pages: number
}

const META_APROBACION = 50

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

export default function TelecomunicacionesPage() {
  // Global filters
  const [globalEmpresa, setGlobalEmpresa] = useState('')
  const [globalComuna, setGlobalComuna] = useState('')
  const [globalMes, setGlobalMes] = useState('')
  const [globalAnio, setGlobalAnio] = useState('')
  const [periodos, setPeriodos] = useState<{ meses: number[]; anios: number[] }>({ meses: [], anios: [] })

  // Table filters
  const [dateRange, setDateRange] = useState<DateRangePickerValue>({})
  const [resultado, setResultado] = useState('')
  const [tienePlano, setTienePlano] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)

  // Data
  const [stats, setStats] = useState<Stats | null>(null)
  const [data, setData] = useState<PaginatedResponse | null>(null)
  const [empresas, setEmpresas] = useState<string[]>([])
  const [comunas, setComunas] = useState<string[]>([])
  const [inspectors, setInspectors] = useState<Array<{ inspector: string; cantidad: number; tasa_aprobacion: number; postes: number }>>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState<'excel' | 'csv'>('excel')

  const fetchPeriodos = useCallback(async () => {
    try {
      const response = await api.get<{ meses: number[]; anios: number[] }>('/api/v1/teleco/periodos')
      setPeriodos(response)
    } catch (error) {
      console.error('Error fetching periodos:', error)
    }
  }, [])

  const fetchStats = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (globalEmpresa) params.append('empresa', globalEmpresa)
      if (globalComuna) params.append('comuna', globalComuna)
      if (globalMes) params.append('mes', globalMes)
      if (globalAnio) params.append('anio', globalAnio)

      const url = `/api/v1/teleco/stats${params.toString() ? '?' + params.toString() : ''}`
      const response = await api.get<Stats>(url)
      setStats(response)
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }, [globalEmpresa, globalComuna, globalMes, globalAnio])

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      params.append('page', page.toString())
      params.append('limit', '10')
      if (searchTerm) params.append('search', searchTerm)
      if (globalEmpresa) params.append('empresa', globalEmpresa)
      if (globalComuna) params.append('comuna', globalComuna)
      if (globalMes) params.append('mes', globalMes)
      if (globalAnio) params.append('anio', globalAnio)
      if (resultado) params.append('resultado', resultado)
      if (tienePlano) params.append('tiene_plano', tienePlano)
      if (dateRange.from) params.append('fecha_desde', dateRange.from.toISOString().split('T')[0])
      if (dateRange.to) params.append('fecha_hasta', dateRange.to.toISOString().split('T')[0])

      const response = await api.get<PaginatedResponse>(`/api/v1/teleco?${params.toString()}`)
      setData(response)
    } catch (error) {
      console.error('Error fetching data:', error)
    }
  }, [page, searchTerm, globalEmpresa, globalComuna, globalMes, globalAnio, resultado, tienePlano, dateRange])

  const fetchEmpresas = useCallback(async () => {
    try {
      const response = await api.get<string[]>('/api/v1/teleco/empresas')
      setEmpresas(response)
    } catch (error) {
      console.error('Error fetching empresas:', error)
    }
  }, [])

  const fetchComunas = useCallback(async () => {
    try {
      const response = await api.get<string[]>('/api/v1/teleco/comunas')
      setComunas(response)
    } catch (error) {
      console.error('Error fetching comunas:', error)
    }
  }, [])

  const fetchInspectors = useCallback(async () => {
    try {
      const response = await api.get<Array<{ inspector: string; cantidad: number; tasa_aprobacion: number; postes: number }>>('/api/v1/teleco/inspectors')
      setInspectors(response)
    } catch (error) {
      console.error('Error fetching inspectors:', error)
    }
  }, [])

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true)
      await Promise.all([fetchEmpresas(), fetchComunas(), fetchInspectors(), fetchPeriodos()])
      setLoading(false)
    }
    loadInitialData()
  }, [fetchEmpresas, fetchComunas, fetchInspectors, fetchPeriodos])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const getResultadoBadge = (resultado: string) => {
    if (!resultado) return <span className="text-gray-400">-</span>
    const aprobado = resultado.toUpperCase() === 'APROBADO'
    return (
      <span className={`inline-flex items-center gap-1 text-sm ${aprobado ? 'text-emerald-600' : 'text-red-600'}`}>
        {aprobado ? <CheckCircle size={14} /> : <XCircle size={14} />}
        {aprobado ? 'Aprobado' : 'Rechazado'}
      </span>
    )
  }

  const getPlanoBadge = (plano: string) => {
    if (!plano) return <span className="text-gray-400">-</span>

    const colorMap: Record<string, string> = {
      'SI': 'text-emerald-600',
      'NO': 'text-red-600',
      'INCOMPLETO': 'text-amber-600',
      'PARCIAL': 'text-amber-600',
      'OTRO': 'text-gray-500',
    }

    const color = colorMap[plano] || 'text-gray-600'
    return <span className={`text-sm ${color}`}>{plano}</span>
  }

  const clearFilters = () => {
    setSearchTerm('')
    setResultado('')
    setTienePlano('')
    setDateRange({})
    setPage(1)
  }

  const clearGlobalFilters = () => {
    setGlobalEmpresa('')
    setGlobalComuna('')
    setGlobalMes('')
    setGlobalAnio('')
  }

  const hasActiveFilters = Boolean(globalEmpresa || globalComuna || globalMes || globalAnio || resultado || tienePlano || searchTerm || dateRange.from || dateRange.to)

  const handleExport = async (format: 'csv' | 'excel') => {
    try {
      setExportFormat(format)
      setExporting(true)
      const params: Record<string, string | undefined> = {
        format,
        empresa: globalEmpresa || undefined,
        comuna: globalComuna || undefined,
        mes: globalMes || undefined,
        anio: globalAnio || undefined,
        resultado: resultado || undefined,
        tiene_plano: tienePlano || undefined,
        search: searchTerm || undefined,
        fecha_desde: dateRange.from ? dateRange.from.toISOString().split('T')[0] : undefined,
        fecha_hasta: dateRange.to ? dateRange.to.toISOString().split('T')[0] : undefined,
      }
      const filename = format === 'excel' ? 'telecomunicaciones.xlsx' : 'telecomunicaciones.csv'
      await api.downloadFile('/api/v1/teleco/export', filename, params)
    } catch (error) {
      console.error('Error exporting:', error)
      alert('Error al exportar los datos')
    } finally {
      setExporting(false)
    }
  }

  // Chart data
  const empresaChartData = stats?.por_empresa.slice(0, 6).map(e => ({
    name: e.empresa,
    Casos: e.cantidad,
    Aprobados: e.aprobados
  })) || []

  const comunaChartData = stats?.por_comuna.slice(0, 10).map(c => ({
    name: c.comuna,
    value: c.cantidad
  })) || []

  const resultadoChartData = stats ? [
    { name: 'Aprobados', value: stats.aprobados },
    { name: 'Rechazados', value: stats.rechazados },
  ].filter(d => d.value > 0) : []

  const planoChartData = stats?.por_tiene_plano.map(p => ({
    name: p.tipo,
    value: p.cantidad
  })) || []

  const evolucionChartData = stats?.evolucion_mensual.map(m => ({
    mes: m.periodo,
    Casos: m.casos,
    Aprobados: m.aprobados,
    Postes: Math.round(m.postes / 10) // Escalar para visualizacion
  })) || []

  const inspectorChartData = stats?.por_inspector.map(i => ({
    inspector: i.inspector,
    cantidad: i.cantidad,
    tasa_aprobacion: i.tasa_aprobacion,
    postes: i.postes
  })) || []

  const colorMap: Record<string, string> = {
    'Aprobados': 'emerald',
    'Rechazados': 'rose',
    'SI': 'emerald',
    'NO': 'red',
    'INCOMPLETO': 'amber',
    'PARCIAL': 'amber',
  }

  const getColorsForData = (data: Array<{ name: string }>) => {
    return data.map(d => colorMap[d.name] || 'gray')
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
        title="Telecomunicaciones"
        subtitle="Inspecciones de Factibilidad en Postes"
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
                <Select value={globalEmpresa} onValueChange={setGlobalEmpresa} placeholder="Empresa">
                  <SelectItem value="">Todas las empresas</SelectItem>
                  {empresas.map(e => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </Select>
              </div>
              <div className="w-48">
                <Select value={globalComuna} onValueChange={setGlobalComuna} placeholder="Comuna">
                  <SelectItem value="">Todas las comunas</SelectItem>
                  {comunas.slice(0, 30).map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
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
              {(globalEmpresa || globalComuna || globalMes || globalAnio) && (
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
                  Mostrando <strong>{formatNumber(stats.total)}</strong> casos
                </span>
              )}
            </div>
          </Flex>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Casos</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{formatNumber(stats?.total || 0)}</p>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Aprobados</p>
            <p className="text-2xl font-semibold text-emerald-600 mt-1">{formatNumber(stats?.aprobados || 0)}</p>
            <p className="text-xs text-gray-400 mt-1">{stats?.tasa_aprobacion || 0}%</p>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Rechazados</p>
            <p className="text-2xl font-semibold text-red-600 mt-1">{formatNumber(stats?.rechazados || 0)}</p>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Postes</p>
            <p className="text-2xl font-semibold text-oca-blue mt-1">{formatNumber(stats?.total_postes || 0)}</p>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Prom. Postes/Caso</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{stats?.promedio_postes || 0}</p>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Con Plano</p>
            <p className="text-2xl font-semibold text-emerald-600 mt-1">{formatNumber(stats?.con_plano || 0)}</p>
            <p className="text-xs text-gray-400 mt-1">Sin: {stats?.sin_plano || 0}</p>
          </div>
        </div>

        {/* Tabs */}
        <TabGroup>
          <TabList className="mb-4">
            <Tab icon={Building2}>Resumen Ejecutivo</Tab>
            <Tab icon={MapPin}>Análisis Territorial</Tab>
            <Tab icon={TrendingUp}>Tendencias</Tab>
            <Tab icon={Search}>Datos</Tab>
          </TabList>
          <TabPanels>
            {/* Resumen Ejecutivo Panel */}
            <TabPanel>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                {/* Resultado Global */}
                <Card>
                  <Title>Resultado de Inspecciones</Title>
                  <Text className="text-gray-500">Aprobados vs Rechazados</Text>
                  <div className="mt-4">
                    <DonutChart
                      className="h-32"
                      data={resultadoChartData}
                      category="value"
                      index="name"
                      colors={getColorsForData(resultadoChartData) as any}
                      valueFormatter={(v) => formatNumber(v)}
                      showAnimation
                    />
                  </div>
                  <div className="mt-3 space-y-1.5">
                    <Flex justifyContent="between">
                      <span className="text-sm flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        Aprobados
                      </span>
                      <span className="text-sm font-semibold text-emerald-600">
                        {formatNumber(stats?.aprobados || 0)}
                      </span>
                    </Flex>
                    <Flex justifyContent="between">
                      <span className="text-sm flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                        Rechazados
                      </span>
                      <span className="text-sm font-semibold text-rose-600">
                        {formatNumber(stats?.rechazados || 0)}
                      </span>
                    </Flex>
                  </div>
                  <div className="mt-4 pt-4 border-t">
                    <Flex justifyContent="between" alignItems="center">
                      <div>
                        <p className="text-2xl font-bold text-oca-blue">{stats?.tasa_aprobacion || 0}%</p>
                        <p className="text-xs text-gray-500">Tasa de Aprobacion</p>
                      </div>
                      {stats && stats.comparativas.aprobacion.diferencia !== 0 && (
                        <div className={`flex items-center gap-1 px-2 py-1 rounded ${
                          stats.comparativas.aprobacion.diferencia > 0 ? 'bg-emerald-100' : 'bg-rose-100'
                        }`}>
                          {stats.comparativas.aprobacion.diferencia > 0 ? (
                            <TrendingUp size={16} className="text-emerald-600" />
                          ) : (
                            <TrendingDown size={16} className="text-rose-600" />
                          )}
                          <span className={`text-sm font-semibold ${
                            stats.comparativas.aprobacion.diferencia > 0 ? 'text-emerald-600' : 'text-rose-600'
                          }`}>
                            {stats.comparativas.aprobacion.diferencia > 0 ? '+' : ''}{stats.comparativas.aprobacion.diferencia}%
                          </span>
                        </div>
                      )}
                    </Flex>
                  </div>
                </Card>

                {/* Por Empresa */}
                <Card className="lg:col-span-2">
                  <Title>Casos por Empresa</Title>
                  <Text className="text-gray-500">Top empresas solicitantes</Text>
                  <BarChart
                    className="mt-4 h-64"
                    data={empresaChartData}
                    index="name"
                    categories={['Casos', 'Aprobados']}
                    colors={['blue', 'emerald']}
                    valueFormatter={(v) => formatNumber(v)}
                    showAnimation
                  />
                </Card>
              </div>

              {/* Tabla de Empresas */}
              <Card>
                <Title>Detalle por Empresa</Title>
                <Table className="mt-4">
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Empresa</TableHeaderCell>
                      <TableHeaderCell className="text-right">Casos</TableHeaderCell>
                      <TableHeaderCell className="text-right">Aprobados</TableHeaderCell>
                      <TableHeaderCell className="text-right">Tasa Aprob.</TableHeaderCell>
                      <TableHeaderCell className="text-right">Postes</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stats?.por_empresa.map((emp) => (
                      <TableRow key={emp.empresa}>
                        <TableCell className="font-medium">{emp.empresa}</TableCell>
                        <TableCell className="text-right">{formatNumber(emp.cantidad)}</TableCell>
                        <TableCell className="text-right text-emerald-600">{formatNumber(emp.aprobados)}</TableCell>
                        <TableCell className="text-right">
                          <span className={emp.tasa_aprobacion >= META_APROBACION ? 'text-emerald-600' : 'text-amber-600'}>
                            {emp.tasa_aprobacion}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{formatNumber(emp.postes)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabPanel>

            {/* Análisis Territorial Panel */}
            <TabPanel>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Top Comunas */}
                <Card>
                  <Title>Top Comunas</Title>
                  <Text className="text-gray-500">Comunas con mas inspecciones</Text>
                  <BarChart
                    className="mt-4 h-72"
                    data={comunaChartData}
                    index="name"
                    categories={['value']}
                    colors={['violet']}
                    valueFormatter={(v) => formatNumber(v)}
                    layout="vertical"
                    yAxisWidth={100}
                    showAnimation
                  />
                </Card>

                {/* Tiene Plano */}
                <Card>
                  <Title>Estado de Planos</Title>
                  <Text className="text-gray-500">Casos con plano completo</Text>
                  <div className="mt-4">
                    <DonutChart
                      className="h-40"
                      data={planoChartData}
                      category="value"
                      index="name"
                      colors={['emerald', 'rose', 'amber', 'amber', 'gray']}
                      valueFormatter={(v) => formatNumber(v)}
                      showAnimation
                    />
                  </div>
                  <div className="mt-4 space-y-2">
                    {stats?.por_tiene_plano.map(p => (
                      <Flex key={p.tipo} justifyContent="between">
                        <Text className="text-sm">{p.tipo}</Text>
                        <Text className="text-sm font-medium">{formatNumber(p.cantidad)}</Text>
                      </Flex>
                    ))}
                  </div>
                </Card>
              </div>

              {/* Evolucion Mensual */}
              <Card>
                <Title>Evolucion Mensual</Title>
                <Text className="text-gray-500">Tendencia de casos y aprobaciones</Text>
                <AreaChart
                  className="mt-4 h-72"
                  data={evolucionChartData}
                  index="mes"
                  categories={['Casos', 'Aprobados']}
                  colors={['blue', 'emerald']}
                  valueFormatter={(v) => formatNumber(v)}
                  showAnimation
                />
              </Card>
            </TabPanel>

            {/* Tendencias Panel */}
            <TabPanel>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {stats?.insights.map((insight, index) => (
                  <Card
                    key={index}
                    decoration="left"
                    decorationColor={insight.tipo === 'success' ? 'emerald' : insight.tipo === 'warning' ? 'amber' : 'blue'}
                  >
                    <Flex alignItems="start" className="gap-3">
                      <div className={`p-2 rounded-lg ${
                        insight.tipo === 'success' ? 'bg-emerald-100' :
                        insight.tipo === 'warning' ? 'bg-amber-100' : 'bg-blue-100'
                      }`}>
                        {insight.tipo === 'success' ? (
                          <CheckCircle className="text-emerald-600" size={20} />
                        ) : insight.tipo === 'warning' ? (
                          <AlertCircle className="text-amber-600" size={20} />
                        ) : (
                          <Info className="text-blue-600" size={20} />
                        )}
                      </div>
                      <div>
                        <Title className="text-base">{insight.titulo}</Title>
                        <Text className="mt-1">{insight.mensaje}</Text>
                      </div>
                    </Flex>
                  </Card>
                ))}
              </div>

              {/* Motivos de Rechazo - CALIDAD */}
              {stats?.motivos_rechazo && stats.motivos_rechazo.length > 0 && (
                <Card className="mt-6">
                  <Title>Motivos de Rechazo</Title>
                  <Text className="text-gray-500">Análisis de causas del {stats?.rechazados || 0} proyectos rechazados ({((stats?.rechazados || 0) / (stats?.total || 1) * 100).toFixed(1)}%)</Text>
                  <div className="mt-4">
                    <BarChart
                      className="h-64"
                      data={stats.motivos_rechazo.map(m => ({
                        name: m.motivo,
                        Cantidad: m.cantidad,
                      }))}
                      index="name"
                      categories={['Cantidad']}
                      colors={['rose']}
                      valueFormatter={(v) => formatNumber(v)}
                      layout="vertical"
                      yAxisWidth={180}
                      showAnimation
                    />
                  </div>
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                    {stats.motivos_rechazo.slice(0, 6).map((m, idx) => (
                      <div key={m.motivo} className={`p-3 rounded-lg ${idx === 0 ? 'bg-rose-50 border-l-4 border-l-rose-500' : 'bg-gray-50'}`}>
                        <p className="text-sm font-medium text-gray-800">{m.motivo}</p>
                        <div className="flex justify-between mt-1">
                          <span className="text-lg font-bold text-rose-600">{m.cantidad}</span>
                          <span className="text-sm text-gray-500">{m.porcentaje}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Resumen de Metricas */}
              <Card className="mt-6">
                <Title>Resumen de Métricas</Title>
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-3xl font-bold text-oca-blue">{formatNumber(stats?.total || 0)}</p>
                    <p className="text-sm text-gray-500 mt-1">Total Casos</p>
                  </div>
                  <div className="text-center p-4 bg-emerald-50 rounded-lg">
                    <p className="text-3xl font-bold text-emerald-600">{stats?.tasa_aprobacion || 0}%</p>
                    <p className="text-sm text-gray-500 mt-1">Tasa Aprobación</p>
                  </div>
                  <div className="text-center p-4 bg-rose-50 rounded-lg">
                    <p className="text-3xl font-bold text-rose-600">{formatNumber(stats?.rechazados || 0)}</p>
                    <p className="text-sm text-gray-500 mt-1">Rechazados</p>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-3xl font-bold text-blue-600">{formatNumber(stats?.total_postes || 0)}</p>
                    <p className="text-sm text-gray-500 mt-1">Postes Evaluados</p>
                  </div>
                </div>
              </Card>
            </TabPanel>

            {/* Datos Panel */}
            <TabPanel>
              {/* Filtros de tabla */}
              <Card className="mb-6">
                <Flex className="flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <TextInput
                      icon={Search}
                      placeholder="Buscar..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="w-40">
                    <Select value={resultado} onValueChange={setResultado} placeholder="Resultado">
                      <SelectItem value="">Todos</SelectItem>
                      <SelectItem value="APROBADO">Aprobado</SelectItem>
                      <SelectItem value="RECHAZADO">Rechazado</SelectItem>
                    </Select>
                  </div>
                  <div className="w-40">
                    <Select value={tienePlano} onValueChange={setTienePlano} placeholder="Plano">
                      <SelectItem value="">Todos</SelectItem>
                      <SelectItem value="SI">Con Plano</SelectItem>
                      <SelectItem value="NO">Sin Plano</SelectItem>
                      <SelectItem value="INCOMPLETO">Incompleto</SelectItem>
                    </Select>
                  </div>
                  <DateRangePicker
                    className="w-64"
                    value={dateRange}
                    onValueChange={setDateRange}
                    placeholder="Rango de fechas"
                    locale={es}
                    selectPlaceholder="Seleccionar"
                    enableSelect
                  >
                    {dateRangeOptions.map((option) => (
                      <DateRangePickerItem
                        key={option.value}
                        value={option.value}
                        from={option.from}
                        to={option.to}
                      >
                        {option.text}
                      </DateRangePickerItem>
                    ))}
                  </DateRangePicker>
                  <Button variant="secondary" onClick={clearFilters}>
                    Limpiar
                  </Button>
                  <ExportDropdown
                    onExport={handleExport}
                    loading={exporting}
                    loadingFormat={exporting ? exportFormat : null}
                    totalRecords={data?.total}
                    hasFilters={hasActiveFilters}
                  />
                </Flex>
              </Card>

              {/* Tabla de datos */}
              <Card>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Caso</TableHeaderCell>
                      <TableHeaderCell>Empresa</TableHeaderCell>
                      <TableHeaderCell>Comuna</TableHeaderCell>
                      <TableHeaderCell className="text-right">Postes</TableHeaderCell>
                      <TableHeaderCell>Fecha</TableHeaderCell>
                      <TableHeaderCell>Resultado</TableHeaderCell>
                      <TableHeaderCell>Plano</TableHeaderCell>
                      <TableHeaderCell>Inspector</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data?.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.numero_caso || item.family_case || '-'}</TableCell>
                        <TableCell>{item.empresa_corta || '-'}</TableCell>
                        <TableCell>{item.comuna || '-'}</TableCell>
                        <TableCell className="text-right">{item.cantidad_postes || 0}</TableCell>
                        <TableCell>{item.fecha_inspeccion || '-'}</TableCell>
                        <TableCell>{getResultadoBadge(item.resultado)}</TableCell>
                        <TableCell>{getPlanoBadge(item.tiene_plano_norm)}</TableCell>
                        <TableCell>{item.inspector || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Paginacion */}
                {data && data.pages > 1 && (
                  <Flex justifyContent="between" className="mt-4 pt-4 border-t">
                    <Text className="text-sm text-gray-500">
                      Pagina {data.page} de {data.pages} ({formatNumber(data.total)} registros)
                    </Text>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        Anterior
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setPage(p => Math.min(data.pages, p + 1))}
                        disabled={page === data.pages}
                      >
                        Siguiente
                      </Button>
                    </div>
                  </Flex>
                )}
              </Card>
            </TabPanel>
          </TabPanels>
        </TabGroup>
      </div>
    </div>
  )
}
