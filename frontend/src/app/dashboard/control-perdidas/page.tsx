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
  Zap,
  Users,
  Building2,
  Gauge,
  ShieldCheck,
  ShieldAlert,
  Calendar,
  TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ExportOverlay } from '@/components/ui/ExportOverlay'
import { ExportDropdown } from '@/components/ui/ExportDropdown'
import { formatNumber } from '@/lib/utils'
import { api } from '@/lib/api'

interface Stats {
  total_solicitadas: number
  total_ejecutadas: number
  pendientes: number
  tasa_ejecucion: number
  monofasico: { solicitadas: number; ejecutadas: number; tasa: number }
  trifasico: { solicitadas: number; ejecutadas: number; tasa: number }
  por_resultado: Array<{ resultado: string; cantidad: number }>
  por_estado_propiedad: Array<{ estado: string; cantidad: number }>
  por_estado_suministro: Array<{ estado: string; cantidad: number }>
  por_comuna: Array<{ comuna: string; cantidad: number }>
  por_inspector: Array<{ inspector: string; cantidad: number; normales: number; tasa_normalidad: number }>
  por_contratista: Array<{ contratista: string; cantidad: number; normales: number; tasa_normalidad: number }>
  por_giro: Array<{ giro: string; cantidad: number }>
  anomalias: {
    modelo_no_corresponde: number
    medidor_no_corresponde: number
    requiere_normalizacion: number
    perno_no_normalizado: number
  }
  calidad_instalacion: {
    acometida_normal: number
    acometida_anormal: number
    caja_normal: number
    caja_anormal: number
    tapa_normal: number
    tapa_anormal: number
  }
  metricas_electricas: {
    voltaje_promedio: number
    amperaje_promedio: number
    error_promedio: number
    error_max: number
    factor_potencia_promedio: number
  }
  insights: Array<{ tipo: 'success' | 'warning' | 'info'; titulo: string; mensaje: string }>
}

interface CalidadItem {
  id: number
  tipo_sistema: string
  cliente: string
  nombre_cliente: string
  direccion: string
  comuna: string
  medidor: string
  tarifa: string
  inspector: string
  contratista: string
  tipo_resultado: string
  estado_propiedad: string
  estado_suministro: string
  voltaje: number
  error_porcentaje: number
  giro: string
}

interface PaginatedResponse {
  items: CalidadItem[]
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
  normales: number
  tasa_normalidad: number
  anomalias: number
  tasa_anomalias: number
}

const MESES_NOMBRES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

export default function ControlPerdidasPage() {
  // Global filters
  const [globalTipoSistema, setGlobalTipoSistema] = useState('')
  const [globalContratista, setGlobalContratista] = useState('')
  const [globalMes, setGlobalMes] = useState('')
  const [globalAnio, setGlobalAnio] = useState('')

  // Table filters
  const [comuna, setComuna] = useState('')
  const [tipoResultado, setTipoResultado] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)

  // Data
  const [stats, setStats] = useState<Stats | null>(null)
  const [data, setData] = useState<PaginatedResponse | null>(null)
  const [comunas, setComunas] = useState<string[]>([])
  const [contratistas, setContratistas] = useState<string[]>([])
  const [resultados, setResultados] = useState<string[]>([])
  const [periodos, setPeriodos] = useState<Periodos>({ meses: [], anios: [] })
  const [evolucion, setEvolucion] = useState<EvolucionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState<'excel' | 'csv'>('excel')

  const fetchStats = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (globalTipoSistema) params.append('tipo_sistema', globalTipoSistema)
      if (globalContratista) params.append('contratista', globalContratista)
      if (globalMes) params.append('mes', globalMes)
      if (globalAnio) params.append('anio', globalAnio)

      const url = `/api/v1/calidad/stats${params.toString() ? '?' + params.toString() : ''}`
      const response = await api.get<Stats>(url)
      setStats(response)
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }, [globalTipoSistema, globalContratista, globalMes, globalAnio])

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      params.append('page', page.toString())
      params.append('limit', '10')
      if (searchTerm) params.append('search', searchTerm)
      if (globalTipoSistema) params.append('tipo_sistema', globalTipoSistema)
      if (globalContratista) params.append('contratista', globalContratista)
      if (globalMes) params.append('mes', globalMes)
      if (globalAnio) params.append('anio', globalAnio)
      if (comuna) params.append('comuna', comuna)
      if (tipoResultado) params.append('tipo_resultado', tipoResultado)

      const response = await api.get<PaginatedResponse>(`/api/v1/calidad?${params.toString()}`)
      setData(response)
    } catch (error) {
      console.error('Error fetching data:', error)
    }
  }, [page, searchTerm, globalTipoSistema, globalContratista, globalMes, globalAnio, comuna, tipoResultado])

  const fetchFilters = useCallback(async () => {
    try {
      const [comunasRes, contratistasRes, resultadosRes, periodosRes] = await Promise.all([
        api.get<string[]>('/api/v1/calidad/comunas'),
        api.get<string[]>('/api/v1/calidad/contratistas'),
        api.get<string[]>('/api/v1/calidad/resultados'),
        api.get<Periodos>('/api/v1/calidad/periodos'),
      ])
      setComunas(comunasRes)
      setContratistas(contratistasRes)
      setResultados(resultadosRes)
      setPeriodos(periodosRes)
    } catch (error) {
      console.error('Error fetching filters:', error)
    }
  }, [])

  const fetchEvolucion = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (globalTipoSistema) params.append('tipo_sistema', globalTipoSistema)
      if (globalContratista) params.append('contratista', globalContratista)

      const url = `/api/v1/calidad/evolucion${params.toString() ? '?' + params.toString() : ''}`
      const response = await api.get<EvolucionItem[]>(url)
      setEvolucion(response)
    } catch (error) {
      console.error('Error fetching evolucion:', error)
    }
  }, [globalTipoSistema, globalContratista])

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

  const getResultadoBadge = (resultado: string) => {
    if (!resultado) return <span className="text-gray-400">-</span>
    const isNormal = resultado.toUpperCase().includes('NORMAL') && !resultado.toUpperCase().includes('NO ')
    const isVisual = resultado.toUpperCase().includes('VISUAL')
    const isNoInspeccionado = resultado.toUpperCase().includes('NO INSPECCIONADO')

    if (isNormal && !isVisual) {
      return <Badge color="emerald">{resultado}</Badge>
    } else if (isVisual) {
      return <Badge color="blue">{resultado}</Badge>
    } else if (isNoInspeccionado) {
      return <Badge color="amber">{resultado}</Badge>
    } else {
      return <Badge color="rose">{resultado}</Badge>
    }
  }

  const clearFilters = () => {
    setSearchTerm('')
    setComuna('')
    setTipoResultado('')
    setPage(1)
  }

  const clearGlobalFilters = () => {
    setGlobalTipoSistema('')
    setGlobalContratista('')
    setGlobalMes('')
    setGlobalAnio('')
  }

  const hasActiveFilters = Boolean(globalTipoSistema || globalContratista || globalMes || globalAnio || comuna || tipoResultado || searchTerm)

  const handleExport = async (format: 'csv' | 'excel') => {
    try {
      setExportFormat(format)
      setExporting(true)
      const params: Record<string, string | undefined> = {
        format,
        tipo_sistema: globalTipoSistema || undefined,
        contratista: globalContratista || undefined,
        mes: globalMes || undefined,
        anio: globalAnio || undefined,
        comuna: comuna || undefined,
        tipo_resultado: tipoResultado || undefined,
        search: searchTerm || undefined,
      }
      const filename = format === 'excel' ? 'control_perdidas.xlsx' : 'control_perdidas.csv'
      await api.downloadFile('/api/v1/calidad/export', filename, params)
    } catch (error) {
      console.error('Error exporting:', error)
      alert('Error al exportar los datos')
    } finally {
      setExporting(false)
    }
  }

  // Chart data
  const resultadoChartData = stats?.por_resultado.map(r => ({
    name: r.resultado,
    value: r.cantidad
  })) || []

  const comunaChartData = stats?.por_comuna.slice(0, 10).map(c => ({
    name: c.comuna,
    value: c.cantidad
  })) || []

  const contratistaChartData = stats?.por_contratista.map(c => ({
    name: c.contratista,
    Inspecciones: c.cantidad,
    Normales: c.normales,
  })) || []

  const giroChartData = stats?.por_giro.slice(0, 8).map(g => ({
    name: g.giro,
    value: g.cantidad
  })) || []

  const inspectorChartData = stats?.por_inspector.slice(0, 10).map(i => ({
    inspector: i.inspector,
    cantidad: i.cantidad,
    tasa_normalidad: i.tasa_normalidad
  })) || []

  // Anomalias total
  const totalAnomalias = stats ? Object.values(stats.anomalias).reduce((a, b) => a + b, 0) : 0

  // Ejecucion data
  const ejecucionData = stats ? [
    { name: 'Ejecutadas', value: stats.total_ejecutadas },
    { name: 'Pendientes', value: stats.pendientes },
  ].filter(d => d.value > 0) : []

  // Sistema data
  const sistemaData = stats ? [
    { name: 'Monofasico', value: stats.monofasico.ejecutadas },
    { name: 'Trifasico', value: stats.trifasico.ejecutadas },
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
        recordCount={hasActiveFilters ? data?.total : stats?.total_ejecutadas}
        hasFilters={hasActiveFilters}
      />
      <Header
        title="Control de Perdidas"
        subtitle="Inspecciones de Calidad - CDP y TFS"
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
              <div className="w-44">
                <Select value={globalTipoSistema} onValueChange={setGlobalTipoSistema} placeholder="Tipo Sistema">
                  <SelectItem value="">Todos</SelectItem>
                  <SelectItem value="MONOFASICO">Monofasico (CDP)</SelectItem>
                  <SelectItem value="TRIFASICO">Trifasico (TFS)</SelectItem>
                </Select>
              </div>
              <div className="w-40">
                <Select value={globalContratista} onValueChange={setGlobalContratista} placeholder="Contratista">
                  <SelectItem value="">Todos</SelectItem>
                  {contratistas.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </Select>
              </div>
              {(globalTipoSistema || globalContratista || globalMes || globalAnio) && (
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
                  <strong>{formatNumber(stats.total_ejecutadas)}</strong> inspecciones ejecutadas
                </span>
              )}
            </div>
          </Flex>
        </div>

        {/* KPIs - Resumen */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Solicitadas</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{formatNumber(stats?.total_solicitadas || 0)}</p>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Ejecutadas</p>
            <p className="text-2xl font-semibold text-emerald-600 mt-1">{formatNumber(stats?.total_ejecutadas || 0)}</p>
            <p className="text-xs text-gray-400 mt-1">{stats?.tasa_ejecucion || 0}%</p>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pendientes</p>
            <p className="text-2xl font-semibold text-amber-600 mt-1">{formatNumber(stats?.pendientes || 0)}</p>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Monofasico</p>
            <p className="text-2xl font-semibold text-blue-600 mt-1">{formatNumber(stats?.monofasico.ejecutadas || 0)}</p>
            <p className="text-xs text-gray-400 mt-1">{stats?.monofasico.tasa || 0}% ejec.</p>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Trifasico</p>
            <p className="text-2xl font-semibold text-violet-600 mt-1">{formatNumber(stats?.trifasico.ejecutadas || 0)}</p>
            <p className="text-xs text-gray-400 mt-1">{stats?.trifasico.tasa || 0}% ejec.</p>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Anomalias</p>
            <p className="text-2xl font-semibold text-red-600 mt-1">{formatNumber(totalAnomalias)}</p>
            <p className="text-xs text-gray-400 mt-1">detectadas</p>
          </div>
        </div>

        {/* Tabs */}
        <TabGroup>
          <TabList className="mb-4">
            <Tab icon={Gauge}>Resumen Ejecutivo</Tab>
            <Tab icon={Zap}>Métricas Eléctricas</Tab>
            <Tab icon={TrendingUp}>Tendencias</Tab>
            <Tab icon={Search}>Datos</Tab>
          </TabList>
          <TabPanels>
            {/* Resumen Panel - Con calidad incluida */}
            <TabPanel>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                {/* Estado de Ejecucion */}
                <Card>
                  <Title>Estado de Ejecucion</Title>
                  <Text className="text-gray-500">Inspecciones ejecutadas vs pendientes</Text>
                  <div className="mt-4">
                    <DonutChart
                      className="h-40"
                      data={ejecucionData}
                      category="value"
                      index="name"
                      colors={['emerald', 'amber']}
                      valueFormatter={(v) => formatNumber(v)}
                      showAnimation
                    />
                  </div>
                  <div className="mt-4 pt-4 border-t">
                    <Flex justifyContent="between" alignItems="center">
                      <div>
                        <p className="text-2xl font-bold text-oca-blue">{stats?.tasa_ejecucion || 0}%</p>
                        <p className="text-xs text-gray-500">Tasa de Ejecucion</p>
                      </div>
                    </Flex>
                  </div>
                </Card>

                {/* Tipo de Sistema */}
                <Card>
                  <Title>Por Tipo de Sistema</Title>
                  <Text className="text-gray-500">Monofasico (CDP) vs Trifasico (TFS)</Text>
                  <div className="mt-4">
                    <DonutChart
                      className="h-40"
                      data={sistemaData}
                      category="value"
                      index="name"
                      colors={['blue', 'violet']}
                      valueFormatter={(v) => formatNumber(v)}
                      showAnimation
                    />
                  </div>
                  <div className="mt-3 space-y-2">
                    <Flex justifyContent="between">
                      <span className="text-sm flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        Monofasico (CDP)
                      </span>
                      <span className="text-sm font-semibold">{formatNumber(stats?.monofasico.ejecutadas || 0)}</span>
                    </Flex>
                    <Flex justifyContent="between">
                      <span className="text-sm flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-violet-500"></span>
                        Trifasico (TFS)
                      </span>
                      <span className="text-sm font-semibold">{formatNumber(stats?.trifasico.ejecutadas || 0)}</span>
                    </Flex>
                  </div>
                </Card>

                {/* Resultados */}
                <Card>
                  <Title>Tipo de Resultado</Title>
                  <Text className="text-gray-500">Clasificacion de inspecciones</Text>
                  <div className="mt-4">
                    <DonutChart
                      className="h-40"
                      data={resultadoChartData}
                      category="value"
                      index="name"
                      colors={['emerald', 'blue', 'amber', 'rose']}
                      valueFormatter={(v) => formatNumber(v)}
                      showAnimation
                    />
                  </div>
                  <div className="mt-3 space-y-1.5">
                    {stats?.por_resultado.slice(0, 4).map((r) => (
                      <Flex key={r.resultado} justifyContent="between">
                        <span className="text-sm truncate max-w-[150px]">{r.resultado}</span>
                        <span className="text-sm font-medium">{formatNumber(r.cantidad)}</span>
                      </Flex>
                    ))}
                  </div>
                </Card>
              </div>

              {/* Calidad - Anomalias y Estado Instalacion */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Anomalias Detectadas */}
                <Card>
                  <Title className="flex items-center gap-2">
                    <ShieldAlert size={20} className="text-red-500" />
                    Anomalias Detectadas
                  </Title>
                  <Text className="text-gray-500">Problemas encontrados en inspecciones</Text>
                  <div className="mt-6 space-y-4">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                          <XCircle size={20} className="text-red-600" />
                        </div>
                        <div>
                          <p className="font-medium">Modelo No Corresponde</p>
                          <p className="text-xs text-gray-500">Equipo en terreno distinto a sistema</p>
                        </div>
                      </div>
                      <Metric className="text-red-600">{stats?.anomalias.modelo_no_corresponde || 0}</Metric>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                          <XCircle size={20} className="text-amber-600" />
                        </div>
                        <div>
                          <p className="font-medium">Medidor No Corresponde</p>
                          <p className="text-xs text-gray-500">Numero de medidor no coincide</p>
                        </div>
                      </div>
                      <Metric className="text-amber-600">{stats?.anomalias.medidor_no_corresponde || 0}</Metric>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                          <AlertTriangle size={20} className="text-orange-600" />
                        </div>
                        <div>
                          <p className="font-medium">Requiere Normalizacion</p>
                          <p className="text-xs text-gray-500">Instalacion requiere correccion</p>
                        </div>
                      </div>
                      <Metric className="text-orange-600">{stats?.anomalias.requiere_normalizacion || 0}</Metric>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
                          <XCircle size={20} className="text-rose-600" />
                        </div>
                        <div>
                          <p className="font-medium">Perno No Normalizado</p>
                          <p className="text-xs text-gray-500">Perno de seguridad sin normalizar</p>
                        </div>
                      </div>
                      <Metric className="text-rose-600">{stats?.anomalias.perno_no_normalizado || 0}</Metric>
                    </div>
                  </div>
                </Card>

                {/* Estado de Instalacion */}
                <Card>
                  <Title className="flex items-center gap-2">
                    <ShieldCheck size={20} className="text-emerald-500" />
                    Estado de Instalacion
                  </Title>
                  <Text className="text-gray-500">Condicion de componentes inspeccionados</Text>
                  <div className="mt-6 space-y-4">
                    {/* Acometida */}
                    <div>
                      <Flex justifyContent="between" className="mb-2">
                        <span className="text-sm font-medium">Acometida</span>
                        <span className="text-sm">
                          <span className="text-emerald-600 font-medium">{stats?.calidad_instalacion.acometida_normal || 0}</span>
                          {' / '}
                          <span className="text-rose-600">{stats?.calidad_instalacion.acometida_anormal || 0}</span>
                        </span>
                      </Flex>
                      <ProgressBar
                        value={stats ? (stats.calidad_instalacion.acometida_normal / (stats.calidad_instalacion.acometida_normal + stats.calidad_instalacion.acometida_anormal || 1) * 100) : 0}
                        color="emerald"
                      />
                    </div>

                    {/* Caja */}
                    <div>
                      <Flex justifyContent="between" className="mb-2">
                        <span className="text-sm font-medium">Caja</span>
                        <span className="text-sm">
                          <span className="text-emerald-600 font-medium">{stats?.calidad_instalacion.caja_normal || 0}</span>
                          {' / '}
                          <span className="text-rose-600">{stats?.calidad_instalacion.caja_anormal || 0}</span>
                        </span>
                      </Flex>
                      <ProgressBar
                        value={stats ? (stats.calidad_instalacion.caja_normal / (stats.calidad_instalacion.caja_normal + stats.calidad_instalacion.caja_anormal || 1) * 100) : 0}
                        color="emerald"
                      />
                    </div>

                    {/* Tapa */}
                    <div>
                      <Flex justifyContent="between" className="mb-2">
                        <span className="text-sm font-medium">Tapa</span>
                        <span className="text-sm">
                          <span className="text-emerald-600 font-medium">{stats?.calidad_instalacion.tapa_normal || 0}</span>
                          {' / '}
                          <span className="text-rose-600">{stats?.calidad_instalacion.tapa_anormal || 0}</span>
                        </span>
                      </Flex>
                      <ProgressBar
                        value={stats ? (stats.calidad_instalacion.tapa_normal / (stats.calidad_instalacion.tapa_normal + stats.calidad_instalacion.tapa_anormal || 1) * 100) : 0}
                        color="emerald"
                      />
                    </div>
                  </div>

                  {/* Estado Propiedad y Suministro */}
                  <div className="mt-6 pt-4 border-t grid grid-cols-2 gap-4">
                    <div>
                      <Text className="text-xs text-gray-500 mb-2">Estado Propiedad</Text>
                      {stats?.por_estado_propiedad.slice(0, 3).map(e => (
                        <Flex key={e.estado} justifyContent="between" className="text-sm">
                          <span className="truncate max-w-[100px]">{e.estado}</span>
                          <span className="font-medium">{e.cantidad}</span>
                        </Flex>
                      ))}
                    </div>
                    <div>
                      <Text className="text-xs text-gray-500 mb-2">Estado Suministro</Text>
                      {stats?.por_estado_suministro.map(e => (
                        <Flex key={e.estado} justifyContent="between" className="text-sm">
                          <span className="truncate max-w-[100px]">{e.estado}</span>
                          <span className="font-medium">{e.cantidad}</span>
                        </Flex>
                      ))}
                    </div>
                  </div>
                </Card>
              </div>

              {/* Distribucion por Comuna */}
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

            {/* Métricas Eléctricas Panel */}
            <TabPanel>
              {/* KPIs Eléctricos */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <Card className="text-center">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-2">
                    <Zap size={20} className="text-blue-600" />
                  </div>
                  <p className="text-2xl font-bold text-blue-600">{stats?.metricas_electricas.voltaje_promedio || 220} V</p>
                  <Text className="text-sm">Voltaje Promedio</Text>
                </Card>
                <Card className="text-center">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-2">
                    <Gauge size={20} className="text-amber-600" />
                  </div>
                  <p className="text-2xl font-bold text-amber-600">{stats?.metricas_electricas.amperaje_promedio || 0} A</p>
                  <Text className="text-sm">Amperaje Promedio</Text>
                </Card>
                <Card className="text-center">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-2">
                    <CheckCircle size={20} className="text-emerald-600" />
                  </div>
                  <p className="text-2xl font-bold text-emerald-600">{stats?.metricas_electricas.error_promedio || 0}%</p>
                  <Text className="text-sm">Error Promedio</Text>
                </Card>
                <Card className="text-center">
                  <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-2">
                    <AlertTriangle size={20} className="text-rose-600" />
                  </div>
                  <p className="text-2xl font-bold text-rose-600">{stats?.metricas_electricas.error_max || 0}%</p>
                  <Text className="text-sm">Error Máximo</Text>
                </Card>
              </div>

              {/* Estado de Instalación */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <Card>
                  <Title>Estado de la Instalación</Title>
                  <Text className="text-gray-500">Condición de componentes físicos</Text>
                  <div className="mt-4 space-y-4">
                    <div>
                      <Flex justifyContent="between" className="mb-1">
                        <Text>Acometida Normal</Text>
                        <Text className="font-medium text-emerald-600">
                          {stats?.calidad_instalacion.acometida_normal || 0} / {(stats?.calidad_instalacion.acometida_normal || 0) + (stats?.calidad_instalacion.acometida_anormal || 0)}
                        </Text>
                      </Flex>
                      <ProgressBar
                        value={stats ? (stats.calidad_instalacion.acometida_normal / ((stats.calidad_instalacion.acometida_normal + stats.calidad_instalacion.acometida_anormal) || 1) * 100) : 0}
                        color="emerald"
                      />
                    </div>
                    <div>
                      <Flex justifyContent="between" className="mb-1">
                        <Text>Caja Normal</Text>
                        <Text className="font-medium text-emerald-600">
                          {stats?.calidad_instalacion.caja_normal || 0} / {(stats?.calidad_instalacion.caja_normal || 0) + (stats?.calidad_instalacion.caja_anormal || 0)}
                        </Text>
                      </Flex>
                      <ProgressBar
                        value={stats ? (stats.calidad_instalacion.caja_normal / ((stats.calidad_instalacion.caja_normal + stats.calidad_instalacion.caja_anormal) || 1) * 100) : 0}
                        color="emerald"
                      />
                    </div>
                    <div>
                      <Flex justifyContent="between" className="mb-1">
                        <Text>Tapa Normal</Text>
                        <Text className="font-medium text-emerald-600">
                          {stats?.calidad_instalacion.tapa_normal || 0} / {(stats?.calidad_instalacion.tapa_normal || 0) + (stats?.calidad_instalacion.tapa_anormal || 0)}
                        </Text>
                      </Flex>
                      <ProgressBar
                        value={stats ? (stats.calidad_instalacion.tapa_normal / ((stats.calidad_instalacion.tapa_normal + stats.calidad_instalacion.tapa_anormal) || 1) * 100) : 0}
                        color="emerald"
                      />
                    </div>
                  </div>
                </Card>

                {/* Anomalías Detectadas */}
                <Card>
                  <Title>Anomalías Detectadas</Title>
                  <Text className="text-gray-500">Problemas encontrados en equipos</Text>
                  <div className="mt-4 space-y-3">
                    <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                      <span className="text-sm font-medium">Modelo no corresponde</span>
                      <span className="text-lg font-bold text-red-600">{stats?.anomalias.modelo_no_corresponde || 0}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-amber-50 rounded-lg">
                      <span className="text-sm font-medium">Medidor no corresponde</span>
                      <span className="text-lg font-bold text-amber-600">{stats?.anomalias.medidor_no_corresponde || 0}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                      <span className="text-sm font-medium">Requiere normalización</span>
                      <span className="text-lg font-bold text-orange-600">{stats?.anomalias.requiere_normalizacion || 0}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-rose-50 rounded-lg">
                      <span className="text-sm font-medium">Perno no normalizado</span>
                      <span className="text-lg font-bold text-rose-600">{stats?.anomalias.perno_no_normalizado || 0}</span>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Tipo de Giro/Cliente */}
              {giroChartData.length > 0 && (
                <Card>
                  <Title>Tipo de Cliente (Giro)</Title>
                  <Text className="text-gray-500">Distribución por tipo de uso</Text>
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
              )}
            </TabPanel>

            {/* Tendencias Panel */}
            <TabPanel>
              {/* Insights del Período */}
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
                            <Zap size={20} className="text-blue-600" />
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

              {/* Resumen de Resultados */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <Card>
                  <Title>Distribución por Resultado</Title>
                  <Text className="text-gray-500">Clasificación de las inspecciones ejecutadas</Text>
                  <DonutChart
                    className="mt-4 h-48"
                    data={stats?.por_resultado?.map(r => ({
                      name: r.resultado || 'Sin Clasificar',
                      value: r.cantidad
                    })) || []}
                    category="value"
                    index="name"
                    colors={['emerald', 'amber', 'blue', 'gray', 'rose']}
                    valueFormatter={(v) => formatNumber(v)}
                    showAnimation
                  />
                </Card>

                <Card>
                  <Title>Resumen de Calidad</Title>
                  <Text className="text-gray-500">Indicadores clave del período</Text>
                  <div className="mt-4 space-y-4">
                    <div className="p-4 bg-emerald-50 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Tasa de Ejecución</span>
                        <span className="text-2xl font-bold text-emerald-600">{stats?.tasa_ejecucion || 0}%</span>
                      </div>
                      <ProgressBar value={stats?.tasa_ejecucion || 0} color="emerald" className="mt-2" />
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Inspecciones Normales</span>
                        <span className="text-2xl font-bold text-blue-600">
                          {stats?.por_resultado?.find(r => r.resultado === 'NORMAL')?.cantidad || 0} / {stats?.total_ejecutadas || 0}
                        </span>
                      </div>
                      <ProgressBar
                        value={stats?.total_ejecutadas ? ((stats.por_resultado?.find(r => r.resultado === 'NORMAL')?.cantidad || 0) / stats.total_ejecutadas * 100) : 0}
                        color="blue"
                        className="mt-2"
                      />
                    </div>
                    <div className="p-4 bg-amber-50 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Total Anomalías</span>
                        <span className="text-2xl font-bold text-amber-600">{totalAnomalias}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Calidad del Contratista */}
              <Card>
                <Title className="flex items-center gap-2">
                  <Building2 size={20} className="text-blue-500" />
                  Calidad del Contratista
                </Title>
                <Text className="text-gray-500">Tasa de normalidad por contratista</Text>
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {stats?.por_contratista.map(c => (
                    <div key={c.contratista} className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm font-semibold text-gray-800 mb-2">{c.contratista}</p>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-500">{formatNumber(c.cantidad)} inspecciones</span>
                        <span className={`text-lg font-bold ${c.tasa_normalidad >= 90 ? 'text-emerald-600' : c.tasa_normalidad >= 70 ? 'text-amber-600' : 'text-rose-600'}`}>
                          {c.tasa_normalidad}%
                        </span>
                      </div>
                      <ProgressBar
                        value={c.tasa_normalidad}
                        color={c.tasa_normalidad >= 90 ? 'emerald' : c.tasa_normalidad >= 70 ? 'amber' : 'rose'}
                      />
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
                    <div className="w-48">
                      <Select value={tipoResultado} onValueChange={setTipoResultado} placeholder="Resultado">
                        <SelectItem value="">Todos</SelectItem>
                        {resultados.map(r => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
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
                      <TableHeaderCell>Cliente</TableHeaderCell>
                      <TableHeaderCell>Nombre</TableHeaderCell>
                      <TableHeaderCell>Comuna</TableHeaderCell>
                      <TableHeaderCell>Sistema</TableHeaderCell>
                      <TableHeaderCell>Resultado</TableHeaderCell>
                      <TableHeaderCell>Contratista</TableHeaderCell>
                      <TableHeaderCell>Inspector</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data?.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.cliente}</TableCell>
                        <TableCell className="text-gray-500 truncate max-w-[150px]">{item.nombre_cliente}</TableCell>
                        <TableCell className="text-gray-500">{item.comuna}</TableCell>
                        <TableCell>
                          <Badge color={item.tipo_sistema === 'MONOFASICO' ? 'blue' : 'violet'}>
                            {item.tipo_sistema === 'MONOFASICO' ? 'CDP' : 'TFS'}
                          </Badge>
                        </TableCell>
                        <TableCell>{getResultadoBadge(item.tipo_resultado)}</TableCell>
                        <TableCell className="text-gray-500">{item.contratista}</TableCell>
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
