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
  BarChart,
  DonutChart,
  AreaChart,
  Tab,
  TabGroup,
  TabList,
  TabPanel,
  TabPanels,
  ProgressBar,
  Metric,
} from '@tremor/react'
import {
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Scissors,
  Users,
  MapPin,
  Building2,
  TrendingUp,
  Zap,
  ShieldAlert,
  ShieldCheck,
  Calendar,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ExportOverlay } from '@/components/ui/ExportOverlay'
import { ExportDropdown } from '@/components/ui/ExportDropdown'
import { formatNumber } from '@/lib/utils'
import { api } from '@/lib/api'

interface Stats {
  total: number
  realizadas: number
  pendientes: number
  tasa_ejecucion: number
  bien_ejecutados: number
  no_ejecutados: number
  tasa_calidad: number
  con_multa: number
  sin_multa: number
  tasa_multa: number
  factible_cortar: number
  no_factible_cortar: number
  por_situacion_encontrada: Array<{ situacion: string; cantidad: number }>
  por_situacion_a_inspeccionar: Array<{ situacion: string; cantidad: number }>
  por_zona: Array<{ zona: string; cantidad: number; bien_ejecutados: number; tasa_calidad: number }>
  por_centro_operativo: Array<{ centro: string; cantidad: number; bien_ejecutados: number; tasa_calidad: number }>
  por_comuna: Array<{ comuna: string; cantidad: number }>
  por_inspector: Array<{ inspector: string; cantidad: number; bien_ejecutados: number; con_multa: number; tasa_calidad: number }>
  por_giro: Array<{ giro: string; cantidad: number }>
  por_tipo_empalme: Array<{ tipo: string; cantidad: number }>
  por_accion_cobro: Array<{ accion: string; accion_original: string; cantidad: number }>
  por_mes: Array<{ periodo: string; total: number; bien_ejecutados: number; tasa_calidad: number }>
  insights: Array<{ tipo: 'success' | 'warning' | 'info'; titulo: string; mensaje: string }>
}

interface CorteItem {
  id: number
  suministro: string
  nombre_cliente: string
  direccion: string
  comuna: string
  zona: string
  centro_operativo: string
  situacion_encontrada: string
  situacion_dejada: string
  motivo_multa: string
  multa: string
  inspector: string
  giro: string
  tipo_empalme: string
  es_factible_cortar: string
  fecha_inspeccion: string
}

interface PaginatedResponse {
  items: CorteItem[]
  total: number
  page: number
  limit: number
  pages: number
}

interface Periodos {
  meses: number[]
  anios: number[]
}

interface EvolucionItem {
  periodo: string
  total: number
  bien_ejecutados: number
  tasa_calidad: number
  con_multa: number
  tasa_multa: number
}

const MESES_NOMBRES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

export default function CorteReposicionPage() {
  // Global filters
  const [globalZona, setGlobalZona] = useState('')
  const [globalCentro, setGlobalCentro] = useState('')
  const [globalMes, setGlobalMes] = useState('')
  const [globalAnio, setGlobalAnio] = useState('')

  // Table filters
  const [comuna, setComuna] = useState('')
  const [situacion, setSituacion] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)

  // Data
  const [stats, setStats] = useState<Stats | null>(null)
  const [data, setData] = useState<PaginatedResponse | null>(null)
  const [zonas, setZonas] = useState<string[]>([])
  const [centros, setCentros] = useState<string[]>([])
  const [comunas, setComunas] = useState<string[]>([])
  const [situaciones, setSituaciones] = useState<string[]>([])
  const [periodos, setPeriodos] = useState<Periodos>({ meses: [], anios: [] })
  const [evolucion, setEvolucion] = useState<EvolucionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState<'excel' | 'csv'>('excel')

  const fetchStats = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (globalZona) params.append('zona', globalZona)
      if (globalCentro) params.append('centro_operativo', globalCentro)
      if (globalMes) params.append('mes', globalMes)
      if (globalAnio) params.append('anio', globalAnio)

      const url = `/api/v1/corte/stats${params.toString() ? '?' + params.toString() : ''}`
      const response = await api.get<Stats>(url)
      setStats(response)
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }, [globalZona, globalCentro, globalMes, globalAnio])

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      params.append('page', page.toString())
      params.append('limit', '10')
      if (searchTerm) params.append('search', searchTerm)
      if (globalZona) params.append('zona', globalZona)
      if (globalCentro) params.append('centro_operativo', globalCentro)
      if (globalMes) params.append('mes', globalMes)
      if (globalAnio) params.append('anio', globalAnio)
      if (comuna) params.append('comuna', comuna)
      if (situacion) params.append('situacion_encontrada', situacion)

      const response = await api.get<PaginatedResponse>(`/api/v1/corte?${params.toString()}`)
      setData(response)
    } catch (error) {
      console.error('Error fetching data:', error)
    }
  }, [page, searchTerm, globalZona, globalCentro, globalMes, globalAnio, comuna, situacion])

  const fetchFilters = useCallback(async () => {
    try {
      const [zonasRes, centrosRes, comunasRes, situacionesRes, periodosRes] = await Promise.all([
        api.get<string[]>('/api/v1/corte/zonas'),
        api.get<string[]>('/api/v1/corte/centros-operativos'),
        api.get<string[]>('/api/v1/corte/comunas'),
        api.get<string[]>('/api/v1/corte/situaciones'),
        api.get<Periodos>('/api/v1/corte/periodos'),
      ])
      setZonas(zonasRes)
      setCentros(centrosRes)
      setComunas(comunasRes)
      setSituaciones(situacionesRes)
      setPeriodos(periodosRes)
    } catch (error) {
      console.error('Error fetching filters:', error)
    }
  }, [])

  const fetchEvolucion = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (globalZona) params.append('zona', globalZona)
      if (globalCentro) params.append('centro_operativo', globalCentro)

      const url = `/api/v1/corte/evolucion${params.toString() ? '?' + params.toString() : ''}`
      const response = await api.get<EvolucionItem[]>(url)
      setEvolucion(response)
    } catch (error) {
      console.error('Error fetching evolucion:', error)
    }
  }, [globalZona, globalCentro])

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true)
      await fetchFilters()
      setLoading(false)
    }
    loadInitialData()
  }, [fetchFilters])

  useEffect(() => {
    fetchStats()
    fetchEvolucion()
  }, [fetchStats, fetchEvolucion])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const getMotivoMultaBadge = (motivo: string) => {
    if (!motivo) return <span className="text-gray-400">-</span>
    if (motivo.toUpperCase().includes('BIEN EJECUTADO')) {
      return <Badge color="emerald">{motivo}</Badge>
    } else if (motivo.toUpperCase().includes('NO EJECUTADO')) {
      return <Badge color="rose">{motivo}</Badge>
    }
    return <Badge color="gray">{motivo}</Badge>
  }

  const getSituacionBadge = (situacion: string) => {
    if (!situacion) return <span className="text-gray-400">-</span>
    const upperSit = situacion.toUpperCase()

    if (upperSit.includes('CON SUMINISTRO')) {
      return <Badge color="blue">{situacion}</Badge>
    } else if (upperSit.includes('ZONA PELIGROSA')) {
      return <Badge color="rose">{situacion}</Badge>
    } else if (upperSit.includes('NO UBICADO')) {
      return <Badge color="amber">{situacion}</Badge>
    } else if (upperSit.includes('NO PERMITE') || upperSit.includes('CERRADO')) {
      return <Badge color="orange">{situacion}</Badge>
    }
    return <Badge color="gray">{situacion}</Badge>
  }

  const clearFilters = () => {
    setSearchTerm('')
    setComuna('')
    setSituacion('')
    setPage(1)
  }

  const clearGlobalFilters = () => {
    setGlobalZona('')
    setGlobalCentro('')
    setGlobalMes('')
    setGlobalAnio('')
  }

  const hasActiveFilters = Boolean(globalZona || globalCentro || globalMes || globalAnio || comuna || situacion || searchTerm)

  const handleExport = async (format: 'csv' | 'excel') => {
    try {
      setExportFormat(format)
      setExporting(true)
      const params: Record<string, string | undefined> = {
        format,
        zona: globalZona || undefined,
        centro_operativo: globalCentro || undefined,
        mes: globalMes || undefined,
        anio: globalAnio || undefined,
        comuna: comuna || undefined,
        situacion_encontrada: situacion || undefined,
        search: searchTerm || undefined,
      }
      const filename = format === 'excel' ? 'corte_reposicion.xlsx' : 'corte_reposicion.csv'
      await api.downloadFile('/api/v1/corte/export', filename, params)
    } catch (error) {
      console.error('Error exporting:', error)
      alert('Error al exportar los datos')
    } finally {
      setExporting(false)
    }
  }

  // Chart data
  const situacionChartData = stats?.por_situacion_encontrada.slice(0, 8).map(s => ({
    name: s.situacion,
    value: s.cantidad
  })) || []

  const comunaChartData = stats?.por_comuna.slice(0, 10).map(c => ({
    name: c.comuna,
    value: c.cantidad
  })) || []

  const zonaChartData = stats?.por_zona.map(z => ({
    name: z.zona,
    Inspecciones: z.cantidad,
    'Bien Ejecutados': z.bien_ejecutados,
  })) || []

  const giroChartData = stats?.por_giro.slice(0, 8).map(g => ({
    name: g.giro,
    value: g.cantidad
  })) || []

  const tipoEmpalmeChartData = stats?.por_tipo_empalme.map(e => ({
    name: e.tipo,
    value: e.cantidad
  })) || []

  const evolucionChartData = evolucion.map(e => ({
    periodo: e.periodo,
    'Tasa Calidad': e.tasa_calidad,
    'Total': e.total,
  }))

  // Ejecucion data
  const ejecucionData = stats ? [
    { name: 'Bien Ejecutado', value: stats.bien_ejecutados },
    { name: 'No Ejecutado', value: stats.no_ejecutados },
  ].filter(d => d.value > 0) : []

  // Multas data
  const multasData = stats ? [
    { name: 'Sin Multa', value: stats.sin_multa },
    { name: 'Con Multa', value: stats.con_multa },
  ].filter(d => d.value > 0) : []

  // Factibilidad data
  const factibilidadData = stats ? [
    { name: 'Factible', value: stats.factible_cortar },
    { name: 'No Factible', value: stats.no_factible_cortar },
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
        title="Corte y Reposicion"
        subtitle="Inspeccion de Calidad - Cortes y Reposiciones"
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
              <div className="flex items-center gap-3 mr-4 pr-4 border-r-2 border-gray-300 bg-white rounded-l-lg py-2 pl-4">
                <span className="text-xs text-gray-600 font-medium whitespace-nowrap">Periodo:</span>
                <Select value={globalAnio} onValueChange={setGlobalAnio} placeholder="Año" className="w-32">
                  <SelectItem value="">Año</SelectItem>
                  {periodos.anios.map(a => (
                    <SelectItem key={a} value={a.toString()}>{a}</SelectItem>
                  ))}
                </Select>
                <Select value={globalMes} onValueChange={setGlobalMes} placeholder="Mes" className="w-40">
                  <SelectItem value="">Mes</SelectItem>
                  {periodos.meses.map(m => (
                    <SelectItem key={m} value={m.toString()}>{MESES_NOMBRES[m]}</SelectItem>
                  ))}
                </Select>
              </div>
              <div className="w-40">
                <Select value={globalZona} onValueChange={setGlobalZona} placeholder="Zona">
                  <SelectItem value="">Todas</SelectItem>
                  {zonas.map(z => (
                    <SelectItem key={z} value={z}>{z}</SelectItem>
                  ))}
                </Select>
              </div>
              <div className="w-44">
                <Select value={globalCentro} onValueChange={setGlobalCentro} placeholder="Centro Operativo">
                  <SelectItem value="">Todos</SelectItem>
                  {centros.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </Select>
              </div>
              {(globalZona || globalCentro || globalMes || globalAnio) && (
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
                  <strong>{formatNumber(stats.total)}</strong> inspecciones
                </span>
              )}
            </div>
          </Flex>
        </div>

        {/* KPIs - Resumen */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{formatNumber(stats?.total || 0)}</p>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Bien Ejecutados</p>
            <p className="text-2xl font-semibold text-emerald-600 mt-1">{formatNumber(stats?.bien_ejecutados || 0)}</p>
            <p className="text-xs text-gray-400 mt-1">{stats?.tasa_calidad || 0}%</p>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">No Ejecutados</p>
            <p className="text-2xl font-semibold text-rose-600 mt-1">{formatNumber(stats?.no_ejecutados || 0)}</p>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Con Multa</p>
            <p className="text-2xl font-semibold text-amber-600 mt-1">{formatNumber(stats?.con_multa || 0)}</p>
            <p className="text-xs text-gray-400 mt-1">{stats?.tasa_multa || 0}%</p>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Factible Cortar</p>
            <p className="text-2xl font-semibold text-blue-600 mt-1">{formatNumber(stats?.factible_cortar || 0)}</p>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">No Factible</p>
            <p className="text-2xl font-semibold text-gray-600 mt-1">{formatNumber(stats?.no_factible_cortar || 0)}</p>
          </div>
        </div>

        {/* Tabs */}
        <TabGroup>
          <TabList className="mb-4">
            <Tab icon={Scissors}>Resumen Ejecutivo</Tab>
            <Tab icon={MapPin}>Distribucion</Tab>
            <Tab icon={TrendingUp}>Tendencias</Tab>
            <Tab icon={Search}>Datos</Tab>
          </TabList>
          <TabPanels>
            {/* Resumen Panel */}
            <TabPanel>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                {/* Estado de Ejecucion */}
                <Card>
                  <Title>Calidad de Ejecucion</Title>
                  <Text className="text-gray-500">Bien ejecutados vs No ejecutados</Text>
                  <div className="mt-4">
                    <DonutChart
                      className="h-40"
                      data={ejecucionData}
                      category="value"
                      index="name"
                      colors={['emerald', 'rose']}
                      valueFormatter={(v) => formatNumber(v)}
                      showAnimation
                    />
                  </div>
                  <div className="mt-4 pt-4 border-t">
                    <Flex justifyContent="between" alignItems="center">
                      <div>
                        <p className="text-2xl font-bold text-oca-blue">{stats?.tasa_calidad || 0}%</p>
                        <p className="text-xs text-gray-500">Tasa de Calidad</p>
                      </div>
                    </Flex>
                  </div>
                </Card>

                {/* Multas */}
                <Card>
                  <Title>Estado de Multas</Title>
                  <Text className="text-gray-500">Casos con y sin multa</Text>
                  <div className="mt-4">
                    <DonutChart
                      className="h-40"
                      data={multasData}
                      category="value"
                      index="name"
                      colors={['emerald', 'amber']}
                      valueFormatter={(v) => formatNumber(v)}
                      showAnimation
                    />
                  </div>
                  <div className="mt-3 space-y-2">
                    <Flex justifyContent="between">
                      <span className="text-sm flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        Sin Multa
                      </span>
                      <span className="text-sm font-semibold">{formatNumber(stats?.sin_multa || 0)}</span>
                    </Flex>
                    <Flex justifyContent="between">
                      <span className="text-sm flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        Con Multa
                      </span>
                      <span className="text-sm font-semibold">{formatNumber(stats?.con_multa || 0)}</span>
                    </Flex>
                  </div>
                </Card>

                {/* Factibilidad de Corte */}
                <Card>
                  <Title>Factibilidad de Corte</Title>
                  <Text className="text-gray-500">Casos donde es factible realizar corte</Text>
                  <div className="mt-4">
                    <DonutChart
                      className="h-40"
                      data={factibilidadData}
                      category="value"
                      index="name"
                      colors={['blue', 'gray']}
                      valueFormatter={(v) => formatNumber(v)}
                      showAnimation
                    />
                  </div>
                  <div className="mt-3 space-y-2">
                    <Flex justifyContent="between">
                      <span className="text-sm flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        Factible
                      </span>
                      <span className="text-sm font-semibold">{formatNumber(stats?.factible_cortar || 0)}</span>
                    </Flex>
                    <Flex justifyContent="between">
                      <span className="text-sm flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                        No Factible
                      </span>
                      <span className="text-sm font-semibold">{formatNumber(stats?.no_factible_cortar || 0)}</span>
                    </Flex>
                  </div>
                </Card>
              </div>

              {/* Situaciones Encontradas */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <Card>
                  <Title className="flex items-center gap-2">
                    <ShieldAlert size={20} className="text-amber-500" />
                    Situaciones Encontradas
                  </Title>
                  <Text className="text-gray-500">Distribucion de situaciones en inspecciones</Text>
                  <div className="mt-4">
                    <DonutChart
                      className="h-48"
                      data={situacionChartData}
                      category="value"
                      index="name"
                      colors={['blue', 'rose', 'amber', 'orange', 'gray', 'emerald', 'violet', 'cyan']}
                      valueFormatter={(v) => formatNumber(v)}
                      showAnimation
                    />
                  </div>
                  <div className="mt-4 space-y-1.5 max-h-40 overflow-y-auto">
                    {stats?.por_situacion_encontrada.slice(0, 6).map((s) => (
                      <Flex key={s.situacion} justifyContent="between">
                        <span className="text-sm truncate max-w-[200px]">{s.situacion}</span>
                        <span className="text-sm font-medium">{formatNumber(s.cantidad)}</span>
                      </Flex>
                    ))}
                  </div>
                </Card>

                {/* Tipo de Empalme */}
                <Card>
                  <Title className="flex items-center gap-2">
                    <Zap size={20} className="text-blue-500" />
                    Tipo de Empalme
                  </Title>
                  <Text className="text-gray-500">Distribucion por tipo de conexion</Text>
                  <div className="mt-4">
                    <DonutChart
                      className="h-48"
                      data={tipoEmpalmeChartData}
                      category="value"
                      index="name"
                      colors={['blue', 'violet', 'cyan', 'emerald', 'amber']}
                      valueFormatter={(v) => formatNumber(v)}
                      showAnimation
                    />
                  </div>
                  <div className="mt-4 space-y-1.5">
                    {stats?.por_tipo_empalme.map((e) => (
                      <Flex key={e.tipo} justifyContent="between">
                        <span className="text-sm">{e.tipo}</span>
                        <span className="text-sm font-medium">{formatNumber(e.cantidad)}</span>
                      </Flex>
                    ))}
                  </div>
                </Card>
              </div>

              {/* Tipo de Giro */}
              <Card>
                <Title>Tipo de Propiedad (Giro)</Title>
                <Text className="text-gray-500">Distribucion por tipo de uso</Text>
                <BarChart
                  className="mt-4 h-48"
                  data={giroChartData}
                  index="name"
                  categories={['value']}
                  colors={['indigo']}
                  valueFormatter={(v) => formatNumber(v)}
                  showAnimation
                />
              </Card>
            </TabPanel>

            {/* Distribucion Panel */}
            <TabPanel>
              {/* Por Zona y Centro Operativo */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <Card>
                  <Title className="flex items-center gap-2">
                    <MapPin size={20} className="text-blue-500" />
                    Por Zona
                  </Title>
                  <Text className="text-gray-500">Cantidad y calidad por zona</Text>
                  <BarChart
                    className="mt-4 h-64"
                    data={zonaChartData}
                    index="name"
                    categories={['Inspecciones', 'Bien Ejecutados']}
                    colors={['cyan', 'emerald']}
                    valueFormatter={(v) => formatNumber(v)}
                    showAnimation
                  />
                  <div className="mt-4 space-y-2">
                    {stats?.por_zona.map(z => (
                      <div key={z.zona} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm font-medium">{z.zona}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-gray-500">{formatNumber(z.cantidad)} insp.</span>
                          <Badge color={z.tasa_calidad >= 90 ? 'emerald' : z.tasa_calidad >= 70 ? 'amber' : 'rose'}>
                            {z.tasa_calidad}%
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card>
                  <Title className="flex items-center gap-2">
                    <Building2 size={20} className="text-violet-500" />
                    Por Centro Operativo
                  </Title>
                  <Text className="text-gray-500">Rendimiento por centro</Text>
                  <div className="mt-4 space-y-3">
                    {stats?.por_centro_operativo.map(c => (
                      <div key={c.centro} className="p-3 bg-gray-50 rounded-lg">
                        <Flex justifyContent="between" className="mb-2">
                          <span className="text-sm font-semibold">{c.centro}</span>
                          <Badge color={c.tasa_calidad >= 90 ? 'emerald' : c.tasa_calidad >= 70 ? 'amber' : 'rose'}>
                            {c.tasa_calidad}% calidad
                          </Badge>
                        </Flex>
                        <ProgressBar value={c.tasa_calidad} color={c.tasa_calidad >= 90 ? 'emerald' : c.tasa_calidad >= 70 ? 'amber' : 'rose'} />
                        <Flex justifyContent="between" className="mt-2 text-xs text-gray-500">
                          <span>{formatNumber(c.cantidad)} inspecciones</span>
                          <span>{formatNumber(c.bien_ejecutados)} bien ejecutados</span>
                        </Flex>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              {/* Por Comuna */}
              <Card>
                <Title>Distribucion por Comuna</Title>
                <Text className="text-gray-500">Top 10 comunas con mayor cantidad de inspecciones</Text>
                <BarChart
                  className="mt-4 h-64"
                  data={comunaChartData}
                  index="name"
                  categories={['value']}
                  colors={['cyan']}
                  valueFormatter={(v) => formatNumber(v)}
                  showAnimation
                />
              </Card>
            </TabPanel>

            {/* Tendencias Panel */}
            <TabPanel>
              {/* Insights del Periodo */}
              {stats?.insights && stats.insights.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {stats.insights.map((insight, idx) => (
                    <Card
                      key={idx}
                      decoration="left"
                      decorationColor={insight.tipo === 'success' ? 'emerald' : insight.tipo === 'warning' ? 'amber' : 'blue'}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${
                          insight.tipo === 'success' ? 'bg-emerald-100' :
                          insight.tipo === 'warning' ? 'bg-amber-100' : 'bg-blue-100'
                        }`}>
                          {insight.tipo === 'success' ? (
                            <CheckCircle size={20} className="text-emerald-600" />
                          ) : insight.tipo === 'warning' ? (
                            <AlertTriangle size={20} className="text-amber-600" />
                          ) : (
                            <Scissors size={20} className="text-blue-600" />
                          )}
                        </div>
                        <div>
                          <Title className="text-base">{insight.titulo}</Title>
                          <Text className="mt-1">{insight.mensaje}</Text>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* Evolucion Mensual */}
              <Card className="mb-6">
                <Title className="flex items-center gap-2">
                  <TrendingUp size={20} className="text-blue-500" />
                  Evolucion de Calidad
                </Title>
                <Text className="text-gray-500">Tasa de calidad mensual</Text>
                <AreaChart
                  className="mt-4 h-64"
                  data={evolucionChartData}
                  index="periodo"
                  categories={['Tasa Calidad']}
                  colors={['emerald']}
                  valueFormatter={(v) => `${v}%`}
                  showAnimation
                />
              </Card>

              {/* Rendimiento de Inspectores */}
              <Card>
                <Title className="flex items-center gap-2">
                  <Users size={20} className="text-blue-500" />
                  Rendimiento por Inspector
                </Title>
                <Text className="text-gray-500">Tasa de calidad y multas por inspector</Text>
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {stats?.por_inspector.slice(0, 9).map(i => (
                    <div key={i.inspector} className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm font-semibold text-gray-800 mb-2 truncate">{i.inspector}</p>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-500">{formatNumber(i.cantidad)} insp.</span>
                        <span className={`text-lg font-bold ${i.tasa_calidad >= 90 ? 'text-emerald-600' : i.tasa_calidad >= 70 ? 'text-amber-600' : 'text-rose-600'}`}>
                          {i.tasa_calidad}%
                        </span>
                      </div>
                      <ProgressBar
                        value={i.tasa_calidad}
                        color={i.tasa_calidad >= 90 ? 'emerald' : i.tasa_calidad >= 70 ? 'amber' : 'rose'}
                      />
                      <Flex justifyContent="between" className="mt-2 text-xs">
                        <span className="text-emerald-600">{i.bien_ejecutados} bien</span>
                        <span className="text-amber-600">{i.con_multa} multas</span>
                      </Flex>
                    </div>
                  ))}
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
                      <Select value={comuna} onValueChange={setComuna} placeholder="Comuna">
                        <SelectItem value="">Todas</SelectItem>
                        {comunas.map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </Select>
                    </div>
                    <div className="w-52">
                      <Select value={situacion} onValueChange={setSituacion} placeholder="Situacion">
                        <SelectItem value="">Todas</SelectItem>
                        {situaciones.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </Select>
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
                      <TableHeaderCell>Suministro</TableHeaderCell>
                      <TableHeaderCell>Cliente</TableHeaderCell>
                      <TableHeaderCell>Comuna</TableHeaderCell>
                      <TableHeaderCell>Zona</TableHeaderCell>
                      <TableHeaderCell>Situacion</TableHeaderCell>
                      <TableHeaderCell>Calidad</TableHeaderCell>
                      <TableHeaderCell>Inspector</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data?.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.suministro}</TableCell>
                        <TableCell className="text-gray-500 truncate max-w-[150px]">{item.nombre_cliente}</TableCell>
                        <TableCell className="text-gray-500">{item.comuna}</TableCell>
                        <TableCell>
                          <Badge color="blue">{item.zona}</Badge>
                        </TableCell>
                        <TableCell>{getSituacionBadge(item.situacion_encontrada)}</TableCell>
                        <TableCell>{getMotivoMultaBadge(item.motivo_multa)}</TableCell>
                        <TableCell className="text-gray-500 truncate max-w-[120px]">{item.inspector}</TableCell>
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
