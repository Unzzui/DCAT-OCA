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
  Badge,
  Select,
  SelectItem,
  TextInput,
  DateRangePicker,
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
import { Search, Filter, CheckCircle, XCircle, Clock, AlertTriangle, TrendingUp, TrendingDown, Info, AlertCircle, FileText, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ExportOverlay } from '@/components/ui/ExportOverlay'
import { ExportDropdown } from '@/components/ui/ExportDropdown'
import { formatNumber } from '@/lib/utils'
import { api } from '@/lib/api'

interface Stats {
  total: number
  inspeccionadas: number
  pendientes: number
  tasa_inspeccion: number
  en_plazo: number
  fuera_plazo: number
  tasa_cumplimiento_plazo: number
  dias_respuesta_promedio: number
  dias_respuesta_min: number
  dias_respuesta_max: number
  por_hallazgo: Array<{ hallazgo: string; cantidad: number }>
  por_estado_general: Array<{ estado: string; cantidad: number }>
  por_inspector: Array<{ inspector: string; cantidad: number; en_plazo: number; tasa_cumplimiento: number }>
  por_sector: Record<string, number>
  por_origen: Record<string, number>
  por_canal: Array<{ canal: string; cantidad: number }>
  por_submotivo: Array<{ submotivo: string; cantidad: number }>
  por_gestion: Array<{ gestion: string; cantidad: number }>
  evolucion_diaria: Array<{ dia: string; total: number; inspeccionadas: number }>
  comparativas: {
    inspeccion: { actual: number; anterior: number; diferencia: number }
    cumplimiento_plazo: { actual: number; anterior: number; diferencia: number }
  }
  insights: Array<{ tipo: 'success' | 'warning' | 'info'; titulo: string; mensaje: string }>
}

interface LecturaItem {
  id: number
  orden: string
  cliente: string
  nombre: string
  direccion: string
  comuna: string
  sector: string
  inspector: string
  fecha_ingreso: string
  fecha_inspeccion: string
  fecha_respuesta: string
  hallazgo: string
  estado_general: string
  estado_plazo: string
  submotivo: string
  canal_entrada: string
  gestion: string
  origen: string
  dias_respuesta: number
}

interface PaginatedResponse {
  items: LecturaItem[]
  total: number
  page: number
  limit: number
  pages: number
}

const META_CUMPLIMIENTO = 90

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

export default function LecturasPage() {
  // Global filters
  const [globalSector, setGlobalSector] = useState('')
  const [globalOrigen, setGlobalOrigen] = useState('')
  const [globalMes, setGlobalMes] = useState('')
  const [globalAnio, setGlobalAnio] = useState('')
  const [periodos, setPeriodos] = useState<{ meses: number[]; anios: number[] }>({ meses: [], anios: [] })

  // Table filters
  const [dateRange, setDateRange] = useState<DateRangePickerValue>({})
  const [inspector, setInspector] = useState('')
  const [hallazgo, setHallazgo] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)

  // Data
  const [stats, setStats] = useState<Stats | null>(null)
  const [data, setData] = useState<PaginatedResponse | null>(null)
  const [sectores, setSectores] = useState<string[]>([])
  const [hallazgos, setHallazgos] = useState<string[]>([])
  const [inspectors, setInspectors] = useState<Array<{ inspector: string; cantidad: number; tasa_cumplimiento: number }>>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState<'excel' | 'csv'>('excel')

  const fetchPeriodos = useCallback(async () => {
    try {
      const response = await api.get<{ meses: number[]; anios: number[] }>('/api/v1/lecturas/periodos')
      setPeriodos(response)
    } catch (error) {
      console.error('Error fetching periodos:', error)
    }
  }, [])

  const fetchStats = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (globalSector) params.append('sector', globalSector)
      if (globalOrigen) params.append('origen', globalOrigen)
      if (globalMes) params.append('mes', globalMes)
      if (globalAnio) params.append('anio', globalAnio)

      const url = `/api/v1/lecturas/stats${params.toString() ? '?' + params.toString() : ''}`
      const response = await api.get<Stats>(url)
      setStats(response)
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }, [globalSector, globalOrigen, globalMes, globalAnio])

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      params.append('page', page.toString())
      params.append('limit', '10')
      if (searchTerm) params.append('search', searchTerm)
      if (globalSector) params.append('sector', globalSector)
      if (globalOrigen) params.append('origen', globalOrigen)
      if (globalMes) params.append('mes', globalMes)
      if (globalAnio) params.append('anio', globalAnio)
      if (inspector) params.append('inspector', inspector)
      if (hallazgo) params.append('hallazgo', hallazgo)
      if (dateRange.from) params.append('fecha_desde', dateRange.from.toISOString().split('T')[0])
      if (dateRange.to) params.append('fecha_hasta', dateRange.to.toISOString().split('T')[0])

      const response = await api.get<PaginatedResponse>(`/api/v1/lecturas?${params.toString()}`)
      setData(response)
    } catch (error) {
      console.error('Error fetching data:', error)
    }
  }, [page, searchTerm, globalSector, globalOrigen, globalMes, globalAnio, inspector, hallazgo, dateRange])

  const fetchSectores = useCallback(async () => {
    try {
      const response = await api.get<string[]>('/api/v1/lecturas/sectores')
      setSectores(response)
    } catch (error) {
      console.error('Error fetching sectores:', error)
    }
  }, [])

  const fetchHallazgos = useCallback(async () => {
    try {
      const response = await api.get<string[]>('/api/v1/lecturas/hallazgos')
      setHallazgos(response)
    } catch (error) {
      console.error('Error fetching hallazgos:', error)
    }
  }, [])

  const fetchInspectors = useCallback(async () => {
    try {
      const response = await api.get<Array<{ inspector: string; cantidad: number; tasa_cumplimiento: number }>>('/api/v1/lecturas/inspectors')
      setInspectors(response)
    } catch (error) {
      console.error('Error fetching inspectors:', error)
    }
  }, [])

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true)
      await Promise.all([fetchSectores(), fetchHallazgos(), fetchInspectors(), fetchPeriodos()])
      setLoading(false)
    }
    loadInitialData()
  }, [fetchSectores, fetchHallazgos, fetchInspectors, fetchPeriodos])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const getEstadoPlazoBadge = (estado: string) => {
    if (!estado) return <span className="text-gray-400">-</span>
    const enPlazo = estado.toLowerCase().includes('en el plazo')
    return (
      <span className={`inline-flex items-center gap-1 text-sm ${enPlazo ? 'text-emerald-600' : 'text-red-600'}`}>
        {enPlazo ? <CheckCircle size={14} /> : <XCircle size={14} />}
        {enPlazo ? 'En Plazo' : 'Fuera de Plazo'}
      </span>
    )
  }

  const getHallazgoBadge = (hallazgo: string) => {
    if (!hallazgo) return <span className="text-gray-400">-</span>

    const colorMap: Record<string, string> = {
      'LECTURA NORMAL': 'text-emerald-600',
      'REGULARIZACION DE LECTURA': 'text-blue-600',
      'PROPIEDAD CERRADA': 'text-amber-600',
      'ERROR DE LECTURA': 'text-red-600',
      'MEDIDOR DEFECTUOSO O EN MAL ESTADO': 'text-red-600',
      'CLIENTE NO PERMITE': 'text-amber-600',
      'MEDIDOR NO UBICADO EN TERRENO': 'text-amber-600',
      'ACTUALIZAR MEDIDOR': 'text-violet-600',
    }

    const color = colorMap[hallazgo] || 'text-gray-600'
    return <span className={`text-sm ${color}`}>{hallazgo}</span>
  }

  const clearFilters = () => {
    setSearchTerm('')
    setInspector('')
    setHallazgo('')
    setDateRange({})
    setPage(1)
  }

  const clearGlobalFilters = () => {
    setGlobalSector('')
    setGlobalOrigen('')
    setGlobalMes('')
    setGlobalAnio('')
  }

  const hasActiveFilters = Boolean(globalSector || globalOrigen || globalMes || globalAnio || inspector || hallazgo || searchTerm || dateRange.from || dateRange.to)

  const handleExport = async (format: 'csv' | 'excel') => {
    try {
      setExportFormat(format)
      setExporting(true)
      const params: Record<string, string | undefined> = {
        format,
        sector: globalSector || undefined,
        origen: globalOrigen || undefined,
        mes: globalMes || undefined,
        anio: globalAnio || undefined,
        inspector: inspector || undefined,
        hallazgo: hallazgo || undefined,
        search: searchTerm || undefined,
        fecha_desde: dateRange.from ? dateRange.from.toISOString().split('T')[0] : undefined,
        fecha_hasta: dateRange.to ? dateRange.to.toISOString().split('T')[0] : undefined,
      }
      const filename = format === 'excel' ? 'lecturas.xlsx' : 'lecturas.csv'
      await api.downloadFile('/api/v1/lecturas/export', filename, params)
    } catch (error) {
      console.error('Error exporting:', error)
      alert('Error al exportar los datos')
    } finally {
      setExporting(false)
    }
  }

  // Chart data
  const hallazgoChartData = stats?.por_hallazgo.slice(0, 8).map(h => ({
    name: h.hallazgo,
    value: h.cantidad
  })) || []

  const estadoGeneralChartData = stats?.por_estado_general.map(e => ({
    name: e.estado,
    value: e.cantidad
  })) || []

  const sectorChartData = stats ? Object.entries(stats.por_sector).map(([name, value]) => ({
    name,
    value: value as number
  })) : []

  const origenChartData = stats ? Object.entries(stats.por_origen).map(([name, value]) => ({
    name,
    value: value as number
  })) : []

  const inspectorChartData = stats?.por_inspector.slice(0, 10).map(i => ({
    inspector: i.inspector,
    cantidad: i.cantidad,
    tasa_cumplimiento: i.tasa_cumplimiento
  })) || []

  const evolucionChartData = stats?.evolucion_diaria.map(d => ({
    dia: d.dia,
    'Ingresadas': d.total,
    'Inspeccionadas': d.inspeccionadas
  })) || []

  const canalChartData = stats?.por_canal.slice(0, 6).map(c => ({
    name: c.canal,
    value: c.cantidad
  })) || []

  const gestionChartData = stats?.por_gestion.slice(0, 8).map(g => ({
    name: g.gestion,
    value: g.cantidad
  })) || []

  const colorMap: Record<string, string> = {
    'Inspeccionadas': 'emerald',
    'Pendientes': 'amber',
    'En Plazo': 'emerald',
    'Fuera de Plazo': 'rose',
    'CON HALLAZGO': 'blue',
    'NORMAL': 'emerald',
    'OTROS': 'slate',
    'ORIENTE': 'blue',
    'PONIENTE': 'violet',
    'ORDENES': 'blue',
    'SEC': 'amber',
    'VISITA VIRTUAL': 'violet',
  }

  const getColorsForData = (data: Array<{ name: string }>) => {
    return data.map(d => colorMap[d.name] || 'gray')
  }

  // Estado de inspeccion data
  const inspeccionData = stats ? [
    { name: 'Inspeccionadas', value: stats.inspeccionadas },
    { name: 'Pendientes', value: stats.pendientes },
  ].filter(d => d.value > 0) : []

  // Estado plazo data
  const plazoData = stats ? [
    { name: 'En Plazo', value: stats.en_plazo },
    { name: 'Fuera de Plazo', value: stats.fuera_plazo },
  ].filter(d => d.value > 0) : []

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
        title="Control de Lecturas"
        subtitle="Verificacion y Hallazgos de Lectura"
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
                <Select value={globalSector} onValueChange={setGlobalSector} placeholder="Sector">
                  <SelectItem value="">Todos los sectores</SelectItem>
                  {sectores.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </Select>
              </div>
              <div className="w-48">
                <Select value={globalOrigen} onValueChange={setGlobalOrigen} placeholder="Origen">
                  <SelectItem value="">Todos los origenes</SelectItem>
                  <SelectItem value="ORDENES">ORDENES</SelectItem>
                  <SelectItem value="SEC">SEC</SelectItem>
                  <SelectItem value="VISITA VIRTUAL">VISITA VIRTUAL</SelectItem>
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
              {(globalSector || globalOrigen || globalMes || globalAnio) && (
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
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Ordenes</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{formatNumber(stats?.total || 0)}</p>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Inspeccionadas</p>
            <p className="text-2xl font-semibold text-emerald-600 mt-1">{formatNumber(stats?.inspeccionadas || 0)}</p>
            <p className="text-xs text-gray-400 mt-1">{stats?.tasa_inspeccion || 0}%</p>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pendientes</p>
            <p className="text-2xl font-semibold text-amber-600 mt-1">{formatNumber(stats?.pendientes || 0)}</p>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">En Plazo</p>
            <p className="text-2xl font-semibold text-emerald-600 mt-1">{formatNumber(stats?.en_plazo || 0)}</p>
            <p className="text-xs text-gray-400 mt-1">{stats?.tasa_cumplimiento_plazo || 0}%</p>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Fuera de Plazo</p>
            <p className="text-2xl font-semibold text-red-600 mt-1">{formatNumber(stats?.fuera_plazo || 0)}</p>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Dias Resp. Prom.</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{stats?.dias_respuesta_promedio || 0}</p>
            <p className="text-xs text-gray-400 mt-1">Min: {stats?.dias_respuesta_min || 0} / Max: {stats?.dias_respuesta_max || 0}</p>
          </div>
        </div>

        {/* Tabs */}
        <TabGroup>
          <TabList className="mb-4">
            <Tab icon={FileText}>Resumen Ejecutivo</Tab>
            <Tab icon={Clock}>Análisis de Plazos</Tab>
            <Tab icon={TrendingUp}>Tendencias</Tab>
            <Tab icon={Search}>Datos</Tab>
          </TabList>
          <TabPanels>
            {/* Resumen Ejecutivo Panel */}
            <TabPanel>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                {/* Estado de Inspeccion */}
                <Card>
                  <Title>Estado de Inspeccion</Title>
                  <Text className="text-gray-500">Ordenes inspeccionadas vs pendientes</Text>
                  <div className="mt-4">
                    <DonutChart
                      className="h-32"
                      data={inspeccionData}
                      category="value"
                      index="name"
                      colors={getColorsForData(inspeccionData) as any}
                      valueFormatter={(v) => formatNumber(v)}
                      showAnimation
                    />
                  </div>
                  <div className="mt-3 space-y-1.5">
                    <Flex justifyContent="between">
                      <span className="text-sm flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        Inspeccionadas
                      </span>
                      <span className="text-sm font-semibold text-emerald-600">
                        {formatNumber(stats?.inspeccionadas || 0)}
                      </span>
                    </Flex>
                    <Flex justifyContent="between">
                      <span className="text-sm flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        Pendientes
                      </span>
                      <span className="text-sm font-semibold text-amber-600">
                        {formatNumber(stats?.pendientes || 0)}
                      </span>
                    </Flex>
                  </div>
                  <div className="mt-4 pt-4 border-t">
                    <Flex justifyContent="between" alignItems="center">
                      <div>
                        <p className="text-2xl font-bold text-oca-blue">{stats?.tasa_inspeccion || 0}%</p>
                        <p className="text-xs text-gray-500">Tasa de Inspeccion</p>
                      </div>
                      {stats && stats.comparativas.inspeccion.diferencia !== 0 && (
                        <div className={`flex items-center gap-1 px-2 py-1 rounded ${
                          stats.comparativas.inspeccion.diferencia > 0 ? 'bg-emerald-100' : 'bg-rose-100'
                        }`}>
                          {stats.comparativas.inspeccion.diferencia > 0 ? (
                            <TrendingUp size={16} className="text-emerald-600" />
                          ) : (
                            <TrendingDown size={16} className="text-rose-600" />
                          )}
                          <span className={`text-sm font-semibold ${
                            stats.comparativas.inspeccion.diferencia > 0 ? 'text-emerald-600' : 'text-rose-600'
                          }`}>
                            {stats.comparativas.inspeccion.diferencia > 0 ? '+' : ''}{stats.comparativas.inspeccion.diferencia}%
                          </span>
                        </div>
                      )}
                    </Flex>
                  </div>
                </Card>

                {/* Hallazgos */}
                <Card className="lg:col-span-2">
                  <Title>Tipos de Hallazgo</Title>
                  <Text className="text-gray-500">Distribucion de hallazgos encontrados</Text>
                  <BarChart
                    className="mt-4 h-64"
                    data={hallazgoChartData}
                    index="name"
                    categories={['value']}
                    colors={['blue']}
                    valueFormatter={(v) => formatNumber(v)}
                    layout="vertical"
                    yAxisWidth={200}
                    showAnimation
                  />
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Estado General */}
                <Card>
                  <Title>Estado General</Title>
                  <Text className="text-gray-500">Clasificacion de resultados</Text>
                  <div className="mt-4 flex items-center gap-6">
                    <DonutChart
                      className="h-36"
                      data={estadoGeneralChartData}
                      category="value"
                      index="name"
                      colors={getColorsForData(estadoGeneralChartData) as any}
                      valueFormatter={(v) => formatNumber(v)}
                      showAnimation
                    />
                    <div className="space-y-2">
                      {estadoGeneralChartData.map(item => (
                        <div key={item.name} className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            item.name === 'NORMAL' ? 'bg-emerald-500' :
                            item.name === 'CON HALLAZGO' ? 'bg-blue-500' : 'bg-slate-400'
                          }`}></span>
                          <span className="text-sm">{item.name}: <strong>{formatNumber(item.value)}</strong></span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>

                {/* Por Sector y Origen */}
                <Card>
                  <Title>Distribucion por Sector y Origen</Title>
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                      <Text className="text-sm text-gray-500 mb-2">Por Sector</Text>
                      <DonutChart
                        className="h-28"
                        data={sectorChartData}
                        category="value"
                        index="name"
                        colors={getColorsForData(sectorChartData) as any}
                        valueFormatter={(v) => formatNumber(v)}
                        showAnimation
                      />
                      <div className="mt-2 space-y-1">
                        {sectorChartData.map(s => (
                          <Flex key={s.name} justifyContent="between">
                            <Text className="text-xs">{s.name}</Text>
                            <Text className="text-xs font-medium">{formatNumber(s.value)}</Text>
                          </Flex>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Text className="text-sm text-gray-500 mb-2">Por Origen</Text>
                      <DonutChart
                        className="h-28"
                        data={origenChartData}
                        category="value"
                        index="name"
                        colors={getColorsForData(origenChartData) as any}
                        valueFormatter={(v) => formatNumber(v)}
                        showAnimation
                      />
                      <div className="mt-2 space-y-1">
                        {origenChartData.map(o => (
                          <Flex key={o.name} justifyContent="between">
                            <Text className="text-xs">{o.name}</Text>
                            <Text className="text-xs font-medium">{formatNumber(o.value)}</Text>
                          </Flex>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Canal de Entrada */}
              <Card>
                <Title>Canal de Entrada</Title>
                <Text className="text-gray-500">Origen de las ordenes de verificacion</Text>
                <BarChart
                  className="mt-4 h-48"
                  data={canalChartData}
                  index="name"
                  categories={['value']}
                  colors={['cyan']}
                  valueFormatter={(v) => formatNumber(v)}
                  showAnimation
                />
              </Card>
            </TabPanel>

            {/* Análisis de Plazos Panel */}
            <TabPanel>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                {/* Cumplimiento de Plazo */}
                <Card>
                  <Title>Cumplimiento de Plazo</Title>
                  <Text className="text-gray-500">Ordenes dentro y fuera de plazo</Text>
                  <div className="mt-4">
                    <DonutChart
                      className="h-32"
                      data={plazoData}
                      category="value"
                      index="name"
                      colors={getColorsForData(plazoData) as any}
                      valueFormatter={(v) => formatNumber(v)}
                      showAnimation
                    />
                  </div>
                  <div className="mt-3 space-y-1.5">
                    <Flex justifyContent="between">
                      <span className="text-sm flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        En Plazo
                      </span>
                      <span className="text-sm font-semibold text-emerald-600">
                        {formatNumber(stats?.en_plazo || 0)}
                      </span>
                    </Flex>
                    <Flex justifyContent="between">
                      <span className="text-sm flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                        Fuera de Plazo
                      </span>
                      <span className="text-sm font-semibold text-rose-600">
                        {formatNumber(stats?.fuera_plazo || 0)}
                      </span>
                    </Flex>
                  </div>
                  <div className="mt-4 pt-4 border-t">
                    <Flex justifyContent="between" alignItems="center">
                      <div>
                        <p className={`text-2xl font-bold ${stats && stats.tasa_cumplimiento_plazo >= META_CUMPLIMIENTO ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {stats?.tasa_cumplimiento_plazo || 0}%
                        </p>
                        <p className="text-xs text-gray-500">Tasa de Cumplimiento</p>
                        <p className="text-xs text-gray-400">Meta: {META_CUMPLIMIENTO}%</p>
                      </div>
                      {stats && stats.comparativas.cumplimiento_plazo.diferencia !== 0 && (
                        <div className={`flex items-center gap-1 px-2 py-1 rounded ${
                          stats.comparativas.cumplimiento_plazo.diferencia > 0 ? 'bg-emerald-100' : 'bg-rose-100'
                        }`}>
                          {stats.comparativas.cumplimiento_plazo.diferencia > 0 ? (
                            <TrendingUp size={16} className="text-emerald-600" />
                          ) : (
                            <TrendingDown size={16} className="text-rose-600" />
                          )}
                          <span className={`text-sm font-semibold ${
                            stats.comparativas.cumplimiento_plazo.diferencia > 0 ? 'text-emerald-600' : 'text-rose-600'
                          }`}>
                            {stats.comparativas.cumplimiento_plazo.diferencia > 0 ? '+' : ''}{stats.comparativas.cumplimiento_plazo.diferencia}%
                          </span>
                        </div>
                      )}
                    </Flex>
                  </div>
                </Card>

                {/* Tiempos de Respuesta */}
                <Card className="lg:col-span-2">
                  <Title>Tiempos de Respuesta</Title>
                  <Text className="text-gray-500">Dias desde ingreso hasta respuesta</Text>
                  <div className="mt-6 grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-emerald-50 rounded-lg">
                      <Clock size={24} className="text-emerald-500 mx-auto mb-2" />
                      <p className="text-3xl font-bold text-emerald-600">{stats?.dias_respuesta_min || 0}</p>
                      <p className="text-sm text-gray-600 mt-1">Minimo</p>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <Clock size={24} className="text-blue-500 mx-auto mb-2" />
                      <p className="text-3xl font-bold text-blue-600">{stats?.dias_respuesta_promedio || 0}</p>
                      <p className="text-sm text-gray-600 mt-1">Promedio</p>
                    </div>
                    <div className="text-center p-4 bg-amber-50 rounded-lg">
                      <Clock size={24} className="text-amber-500 mx-auto mb-2" />
                      <p className="text-3xl font-bold text-amber-600">{stats?.dias_respuesta_max || 0}</p>
                      <p className="text-sm text-gray-600 mt-1">Maximo</p>
                    </div>
                  </div>
                  <div className="mt-6">
                    <Flex justifyContent="between" className="mb-2">
                      <span className="text-sm text-gray-600">Progreso hacia meta de cumplimiento</span>
                      <span className="text-sm font-semibold">{stats?.tasa_cumplimiento_plazo || 0}% / {META_CUMPLIMIENTO}%</span>
                    </Flex>
                    <ProgressBar
                      value={stats?.tasa_cumplimiento_plazo || 0}
                      color={stats && stats.tasa_cumplimiento_plazo >= META_CUMPLIMIENTO ? 'emerald' : 'amber'}
                    />
                  </div>
                </Card>
              </div>

              {/* Evolucion Diaria */}
              {evolucionChartData.length > 0 && (
                <Card>
                  <Title>Evolucion de Ordenes</Title>
                  <Text className="text-gray-500">Ingresadas vs Inspeccionadas por dia</Text>
                  <AreaChart
                    className="mt-4 h-64"
                    data={evolucionChartData}
                    index="dia"
                    categories={['Ingresadas', 'Inspeccionadas']}
                    colors={['blue', 'emerald']}
                    valueFormatter={(v) => formatNumber(v)}
                    showAnimation
                  />
                </Card>
              )}

              {/* Gestion SEC */}
              {gestionChartData.length > 0 && (
                <Card className="mt-6">
                  <Title>Estado de Gestion (SEC)</Title>
                  <Text className="text-gray-500">Acciones realizadas en ordenes SEC</Text>
                  <BarChart
                    className="mt-4 h-48"
                    data={gestionChartData}
                    index="name"
                    categories={['value']}
                    colors={['violet']}
                    valueFormatter={(v) => formatNumber(v)}
                    showAnimation
                  />
                </Card>
              )}
            </TabPanel>

            {/* Tendencias Panel */}
            <TabPanel>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Insights Automaticos */}
                <Card>
                  <Title>Insights Automaticos</Title>
                  <Text className="text-gray-500">Observaciones clave del periodo</Text>
                  <div className="mt-4 space-y-3">
                    {stats?.insights && stats.insights.length > 0 ? (
                      stats.insights.map((insight, idx) => (
                        <div key={idx} className={`p-4 rounded-lg ${
                          insight.tipo === 'success' ? 'bg-emerald-50 border border-emerald-200' :
                          insight.tipo === 'warning' ? 'bg-amber-50 border border-amber-200' :
                          'bg-blue-50 border border-blue-200'
                        }`}>
                          <div className="flex items-start gap-3">
                            {insight.tipo === 'success' ? (
                              <CheckCircle size={20} className="text-emerald-600 mt-0.5" />
                            ) : insight.tipo === 'warning' ? (
                              <AlertTriangle size={20} className="text-amber-600 mt-0.5" />
                            ) : (
                              <Info size={20} className="text-blue-600 mt-0.5" />
                            )}
                            <div>
                              <p className={`font-medium ${
                                insight.tipo === 'success' ? 'text-emerald-800' :
                                insight.tipo === 'warning' ? 'text-amber-800' :
                                'text-blue-800'
                              }`}>{insight.titulo}</p>
                              <p className="text-sm text-gray-600 mt-1">{insight.mensaje}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-400">
                        <CheckCircle size={32} className="mx-auto mb-3 text-emerald-400" />
                        <p className="text-sm">Sin observaciones relevantes</p>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Comparativas */}
                <Card>
                  <Title>Comparativa del Periodo</Title>
                  <Text className="text-gray-500">Primera vs segunda mitad del periodo</Text>
                  <div className="mt-6 space-y-4">
                    {/* Tasa de Inspeccion */}
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <Flex justifyContent="between" alignItems="center">
                        <div>
                          <p className="text-sm font-medium text-gray-700">Tasa de Inspeccion</p>
                          <p className="text-xs text-gray-400 mt-1">
                            Anterior: {stats?.comparativas.inspeccion.anterior || 0}%
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-oca-blue">{stats?.comparativas.inspeccion.actual || 0}%</p>
                          {stats && stats.comparativas.inspeccion.diferencia !== 0 && (
                            <div className={`flex items-center justify-end gap-1 ${
                              stats.comparativas.inspeccion.diferencia > 0 ? 'text-emerald-600' : 'text-rose-600'
                            }`}>
                              {stats.comparativas.inspeccion.diferencia > 0 ? (
                                <TrendingUp size={14} />
                              ) : (
                                <TrendingDown size={14} />
                              )}
                              <span className="text-sm font-semibold">
                                {stats.comparativas.inspeccion.diferencia > 0 ? '+' : ''}
                                {stats.comparativas.inspeccion.diferencia}%
                              </span>
                            </div>
                          )}
                        </div>
                      </Flex>
                    </div>

                    {/* Cumplimiento de Plazo */}
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <Flex justifyContent="between" alignItems="center">
                        <div>
                          <p className="text-sm font-medium text-gray-700">Cumplimiento de Plazo</p>
                          <p className="text-xs text-gray-400 mt-1">
                            Anterior: {stats?.comparativas.cumplimiento_plazo.anterior || 0}%
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-xl font-bold ${stats && stats.comparativas.cumplimiento_plazo.actual >= META_CUMPLIMIENTO ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {stats?.comparativas.cumplimiento_plazo.actual || 0}%
                          </p>
                          {stats && stats.comparativas.cumplimiento_plazo.diferencia !== 0 && (
                            <div className={`flex items-center justify-end gap-1 ${
                              stats.comparativas.cumplimiento_plazo.diferencia > 0 ? 'text-emerald-600' : 'text-rose-600'
                            }`}>
                              {stats.comparativas.cumplimiento_plazo.diferencia > 0 ? (
                                <TrendingUp size={14} />
                              ) : (
                                <TrendingDown size={14} />
                              )}
                              <span className="text-sm font-semibold">
                                {stats.comparativas.cumplimiento_plazo.diferencia > 0 ? '+' : ''}
                                {stats.comparativas.cumplimiento_plazo.diferencia}%
                              </span>
                            </div>
                          )}
                        </div>
                      </Flex>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Submotivos */}
              {stats?.por_submotivo && stats.por_submotivo.length > 0 && (
                <Card className="mt-6">
                  <Title>Submotivos de Ordenes</Title>
                  <Text className="text-gray-500">Razon de la solicitud de verificacion</Text>
                  <Table className="mt-4">
                    <TableHead>
                      <TableRow>
                        <TableHeaderCell>Submotivo</TableHeaderCell>
                        <TableHeaderCell className="text-right">Cantidad</TableHeaderCell>
                        <TableHeaderCell className="text-right">%</TableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {stats.por_submotivo.map((s) => (
                        <TableRow key={s.submotivo}>
                          <TableCell>{s.submotivo}</TableCell>
                          <TableCell className="text-right">{formatNumber(s.cantidad)}</TableCell>
                          <TableCell className="text-right">
                            {((s.cantidad / stats.total) * 100).toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              )}
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
                      <Select value={hallazgo} onValueChange={setHallazgo} placeholder="Hallazgo">
                        <SelectItem value="">Todos</SelectItem>
                        {hallazgos.map(h => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
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
                      <TableHeaderCell>Nombre</TableHeaderCell>
                      <TableHeaderCell>Fecha Ingreso</TableHeaderCell>
                      <TableHeaderCell>Estado Plazo</TableHeaderCell>
                      <TableHeaderCell>Hallazgo</TableHeaderCell>
                      <TableHeaderCell>Sector</TableHeaderCell>
                      <TableHeaderCell>Inspector</TableHeaderCell>
                      <TableHeaderCell>Origen</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data?.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.cliente}</TableCell>
                        <TableCell className="text-gray-500 truncate max-w-[150px]">{item.nombre}</TableCell>
                        <TableCell className="text-gray-500">{item.fecha_ingreso}</TableCell>
                        <TableCell>{getEstadoPlazoBadge(item.estado_plazo)}</TableCell>
                        <TableCell>{getHallazgoBadge(item.hallazgo)}</TableCell>
                        <TableCell className="text-gray-500">{item.sector}</TableCell>
                        <TableCell className="text-gray-500 truncate max-w-[120px]">{item.inspector}</TableCell>
                        <TableCell>
                          <Badge color={item.origen === 'SEC' ? 'amber' : 'blue'}>
                            {item.origen}
                          </Badge>
                        </TableCell>
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
