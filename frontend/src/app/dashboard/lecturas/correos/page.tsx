'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
  Tab,
  TabGroup,
  TabList,
  TabPanel,
  TabPanels,
  ProgressBar,
} from '@tremor/react'
import { Search, Filter, CheckCircle, AlertTriangle, Info, Mail, Users, Clock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ExportOverlay } from '@/components/ui/ExportOverlay'
import { ExportDropdown } from '@/components/ui/ExportDropdown'
import { formatNumber } from '@/lib/utils'
import { api } from '@/lib/api'

interface Stats {
  total: number
  respondidos: number
  pendientes: number
  tasa_respuesta: number
  dias_respuesta_promedio: number
  dias_respuesta_min: number
  dias_respuesta_max: number
  por_fuente: Record<string, { cantidad: number; respondidos: number }>
  por_inspector: Array<{ inspector: string; cantidad: number; respondidos: number; tasa_respuesta: number; dias_promedio: number }>
  por_comuna: Array<{ comuna: string; cantidad: number }>
  por_gestion: Array<{ gestion: string; cantidad: number }>
  evolucion_mensual: Array<{ periodo: string; total: number; respondidos: number; tasa: number; dias_promedio: number }>
  insights: Array<{ tipo: 'success' | 'warning' | 'info'; titulo: string; mensaje: string }>
}

interface CorreoItem {
  id: number
  fuente: string
  fecha_recepcion: string
  cliente: string
  quien_envio: string
  reclamo: string
  fecha_terreno: string
  respuesta: string
  fecha_respuesta: string
  inspector: string
  comuna: string
  gestion: string
  dias_respuesta: number
}

interface PaginatedResponse {
  items: CorreoItem[]
  total: number
  page: number
  limit: number
  pages: number
}

const MESES = [
  { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' }, { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' }, { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' }, { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' },
]

export default function CorreosPage() {
  // Global filters
  const [globalFuente, setGlobalFuente] = useState('')
  const [globalMes, setGlobalMes] = useState('')
  const [globalAnio, setGlobalAnio] = useState('')
  const [periodos, setPeriodos] = useState<{ meses: number[]; anios: number[]; ultimo_mes: number | null; ultimo_anio: number | null }>({ meses: [], anios: [], ultimo_mes: null, ultimo_anio: null })

  // Table filters
  const [inspector, setInspector] = useState('')
  const [comuna, setComuna] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)

  // Data
  const [stats, setStats] = useState<Stats | null>(null)
  const [data, setData] = useState<PaginatedResponse | null>(null)
  const [fuentes, setFuentes] = useState<string[]>([])
  const [comunas, setComunas] = useState<string[]>([])
  const [inspectores, setInspectores] = useState<Array<{ inspector: string; cantidad: number; dias_promedio: number }>>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState<'excel' | 'csv'>('excel')

  const fetchPeriodos = useCallback(async () => {
    try {
      const response = await api.get<{ meses: number[]; anios: number[]; ultimo_mes: number | null; ultimo_anio: number | null }>('/api/v1/lectura/correos/periodos')
      setPeriodos(response)
      return response
    } catch (error) {
      console.error('Error fetching periodos:', error)
      return null
    }
  }, [])

  const fetchStats = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (globalFuente) params.append('fuente', globalFuente)
      if (globalMes) params.append('mes', globalMes)
      if (globalAnio) params.append('anio', globalAnio)

      const response = await api.get<Stats>(`/api/v1/lectura/correos/stats${params.toString() ? '?' + params.toString() : ''}`)
      setStats(response)
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }, [globalFuente, globalMes, globalAnio])

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      params.append('page', page.toString())
      params.append('limit', '10')
      if (searchTerm) params.append('search', searchTerm)
      if (globalFuente) params.append('fuente', globalFuente)
      if (globalMes) params.append('mes', globalMes)
      if (globalAnio) params.append('anio', globalAnio)
      if (inspector) params.append('inspector', inspector)
      if (comuna) params.append('comuna', comuna)

      const response = await api.get<PaginatedResponse>(`/api/v1/lectura/correos?${params.toString()}`)
      setData(response)
    } catch (error) {
      console.error('Error fetching data:', error)
    }
  }, [page, searchTerm, globalFuente, globalMes, globalAnio, inspector, comuna])

  const fetchFuentes = useCallback(async () => {
    try {
      const response = await api.get<string[]>('/api/v1/lectura/correos/fuentes')
      setFuentes(response)
    } catch (error) {
      console.error('Error fetching fuentes:', error)
    }
  }, [])

  const fetchComunas = useCallback(async () => {
    try {
      const response = await api.get<string[]>('/api/v1/lectura/correos/comunas')
      setComunas(response)
    } catch (error) {
      console.error('Error fetching comunas:', error)
    }
  }, [])

  const fetchInspectores = useCallback(async () => {
    try {
      const response = await api.get<Array<{ inspector: string; cantidad: number; dias_promedio: number }>>('/api/v1/lectura/correos/inspectores')
      setInspectores(response)
    } catch (error) {
      console.error('Error fetching inspectores:', error)
    }
  }, [])

  const renderCount = useRef(0)

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true)
      const [, , , periodosRes] = await Promise.all([fetchFuentes(), fetchComunas(), fetchInspectores(), fetchPeriodos()])

      const initMes = periodosRes?.ultimo_mes ? String(periodosRes.ultimo_mes) : ''
      const initAnio = periodosRes?.ultimo_anio ? String(periodosRes.ultimo_anio) : ''

      const statsParams = new URLSearchParams()
      if (initMes) statsParams.append('mes', initMes)
      if (initAnio) statsParams.append('anio', initAnio)

      const dataParams = new URLSearchParams()
      dataParams.append('page', '1')
      dataParams.append('limit', '10')
      if (initMes) dataParams.append('mes', initMes)
      if (initAnio) dataParams.append('anio', initAnio)

      const [statsRes, dataRes] = await Promise.all([
        api.get<Stats>(`/api/v1/lectura/correos/stats${statsParams.toString() ? '?' + statsParams.toString() : ''}`),
        api.get<PaginatedResponse>(`/api/v1/lectura/correos?${dataParams.toString()}`),
      ])
      setStats(statsRes)
      setData(dataRes)
      setGlobalMes(initMes)
      setGlobalAnio(initAnio)
      setLoading(false)
    }
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (renderCount.current < 2) {
      renderCount.current++
      return
    }
    const doRefresh = async () => {
      setRefreshing(true)
      await Promise.all([fetchStats(), fetchData()])
      setRefreshing(false)
    }
    doRefresh()
  }, [fetchStats, fetchData])

  const clearFilters = () => {
    setSearchTerm('')
    setInspector('')
    setComuna('')
    setPage(1)
  }

  const clearGlobalFilters = () => {
    setGlobalFuente('')
    setGlobalMes('')
    setGlobalAnio('')
  }

  const hasActiveFilters = Boolean(globalFuente || globalMes || globalAnio || inspector || comuna || searchTerm)

  const handleExport = async (format: 'csv' | 'excel') => {
    try {
      setExportFormat(format)
      setExporting(true)
      const params: Record<string, string | undefined> = {
        format,
        fuente: globalFuente || undefined,
        mes: globalMes || undefined,
        anio: globalAnio || undefined,
        inspector: inspector || undefined,
        comuna: comuna || undefined,
        search: searchTerm || undefined,
      }
      const filename = format === 'excel' ? 'inspecciones_correos.xlsx' : 'inspecciones_correos.csv'
      await api.downloadFile('/api/v1/lectura/correos/export', filename, params)
    } catch (error) {
      console.error('Error exporting:', error)
      alert('Error al exportar los datos')
    } finally {
      setExporting(false)
    }
  }

  // Chart data
  const fuenteChartData = stats?.por_fuente ? Object.entries(stats.por_fuente).map(([fuente, data]) => ({
    name: fuente,
    Total: data.cantidad,
    Respondidos: data.respondidos,
  })) : []

  const inspectorChartData = stats?.por_inspector.slice(0, 8).map(i => ({
    name: i.inspector,
    Cantidad: i.cantidad,
    'Dias Promedio': i.dias_promedio,
  })) || []

  const gestionChartData = stats?.por_gestion.slice(0, 8).map(g => ({
    name: g.gestion,
    value: g.cantidad,
  })) || []

  const estadoData = stats ? [
    { name: 'Respondidos', value: stats.respondidos },
    { name: 'Pendientes', value: stats.pendientes },
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
      <ExportOverlay isVisible={exporting} format={exportFormat} recordCount={hasActiveFilters ? data?.total : stats?.total} hasFilters={hasActiveFilters} />
      {refreshing && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-white rounded-full shadow-lg px-4 py-2 flex items-center gap-2 border">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-oca-blue border-t-transparent"></div>
          <span className="text-sm text-gray-600">Actualizando datos...</span>
        </div>
      )}
      <Header title="Correos e Inspecciones Especiales" subtitle="Seguimiento de reclamos y solicitudes por correo" />

      <div className={`p-6 transition-opacity duration-200 ${refreshing ? 'opacity-60 pointer-events-none' : ''}`}>
        {/* Global Filters Bar */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <Flex justifyContent="between" alignItems="center" className="flex-wrap gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-gray-400" />
                <span className="text-sm font-medium text-gray-600">Filtros:</span>
              </div>
              <div className="w-40">
                <Select value={globalFuente} onValueChange={setGlobalFuente} placeholder="Fuente">
                  <SelectItem value="">Todas</SelectItem>
                  {fuentes.map(f => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </Select>
              </div>
              <div className="flex items-center gap-3 ml-4 pl-4 border-l-2 border-gray-300">
                <span className="text-xs text-gray-600 font-medium">Periodo:</span>
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
              {(globalFuente || globalMes || globalAnio) && (
                <button onClick={clearGlobalFilters} className="text-sm text-oca-blue hover:text-oca-blue-dark">
                  Limpiar filtros
                </button>
              )}
            </div>
            <div className="text-sm text-gray-500">
              {stats && <span>Mostrando <strong>{formatNumber(stats.total)}</strong> registros</span>}
            </div>
          </Flex>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Correos</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{formatNumber(stats?.total || 0)}</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Respondidos</p>
            <p className="text-2xl font-semibold text-emerald-600 mt-1">{formatNumber(stats?.respondidos || 0)}</p>
            <p className="text-xs text-gray-400 mt-1">{stats?.tasa_respuesta || 0}%</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pendientes</p>
            <p className="text-2xl font-semibold text-amber-600 mt-1">{formatNumber(stats?.pendientes || 0)}</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Dias Resp. Prom.</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{stats?.dias_respuesta_promedio || 0}</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Min / Max Dias</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{stats?.dias_respuesta_min || 0} / {stats?.dias_respuesta_max || 0}</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tasa Respuesta</p>
            <p className={`text-2xl font-semibold mt-1 ${(stats?.tasa_respuesta || 0) >= 90 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {stats?.tasa_respuesta || 0}%
            </p>
          </div>
        </div>

        {/* Tabs */}
        <TabGroup>
          <TabList className="mb-4">
            <Tab icon={Mail}>Resumen</Tab>
            <Tab icon={Clock}>Tiempos</Tab>
            <Tab icon={Users}>Inspectores</Tab>
            <Tab icon={Search}>Datos</Tab>
          </TabList>
          <TabPanels>
            {/* Resumen Panel */}
            <TabPanel>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                <Card>
                  <Title>Estado de Correos</Title>
                  <Text className="text-gray-500">Respondidos vs Pendientes</Text>
                  <DonutChart
                    className="mt-4 h-40"
                    data={estadoData}
                    category="value"
                    index="name"
                    colors={['emerald', 'amber']}
                    valueFormatter={(v) => formatNumber(v)}
                    showAnimation
                  />
                  <div className="mt-4">
                    <Flex justifyContent="between" className="mb-2">
                      <span className="text-sm text-gray-600">Tasa de Respuesta</span>
                      <span className="text-sm font-semibold">{stats?.tasa_respuesta || 0}%</span>
                    </Flex>
                    <ProgressBar value={stats?.tasa_respuesta || 0} color={stats && stats.tasa_respuesta >= 90 ? 'emerald' : 'amber'} />
                  </div>
                </Card>
                <Card className="lg:col-span-2">
                  <Title>Por Fuente</Title>
                  <Text className="text-gray-500">Correos por origen (ENEL / COLINA)</Text>
                  <BarChart
                    className="mt-4 h-48"
                    data={fuenteChartData}
                    index="name"
                    categories={['Total', 'Respondidos']}
                    colors={['blue', 'emerald']}
                    valueFormatter={(v) => formatNumber(v)}
                    showAnimation
                  />
                </Card>
              </div>
              <Card>
                <Title>Por Tipo de Gestion</Title>
                <Text className="text-gray-500">Distribucion de tipos de gestion</Text>
                <DonutChart
                  className="mt-4 h-48"
                  data={gestionChartData}
                  category="value"
                  index="name"
                  colors={['blue', 'cyan', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose']}
                  valueFormatter={(v) => formatNumber(v)}
                  showAnimation
                />
              </Card>
            </TabPanel>

            {/* Tiempos Panel */}
            <TabPanel>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                <div className="text-center p-6 bg-emerald-50 rounded-lg">
                  <Clock size={32} className="text-emerald-500 mx-auto mb-3" />
                  <p className="text-4xl font-bold text-emerald-600">{stats?.dias_respuesta_min || 0}</p>
                  <p className="text-sm text-gray-600 mt-2">Dias Minimo</p>
                </div>
                <div className="text-center p-6 bg-blue-50 rounded-lg">
                  <Clock size={32} className="text-blue-500 mx-auto mb-3" />
                  <p className="text-4xl font-bold text-blue-600">{stats?.dias_respuesta_promedio || 0}</p>
                  <p className="text-sm text-gray-600 mt-2">Dias Promedio</p>
                </div>
                <div className="text-center p-6 bg-amber-50 rounded-lg">
                  <Clock size={32} className="text-amber-500 mx-auto mb-3" />
                  <p className="text-4xl font-bold text-amber-600">{stats?.dias_respuesta_max || 0}</p>
                  <p className="text-sm text-gray-600 mt-2">Dias Maximo</p>
                </div>
              </div>
              {stats?.insights && stats.insights.length > 0 && (
                <Card>
                  <Title>Insights</Title>
                  <div className="mt-4 space-y-3">
                    {stats.insights.map((insight, idx) => (
                      <div key={idx} className={`p-4 rounded-lg ${
                        insight.tipo === 'success' ? 'bg-emerald-50 border border-emerald-200' :
                        insight.tipo === 'warning' ? 'bg-amber-50 border border-amber-200' :
                        'bg-blue-50 border border-blue-200'
                      }`}>
                        <div className="flex items-start gap-3">
                          {insight.tipo === 'success' ? <CheckCircle size={20} className="text-emerald-600 mt-0.5" /> :
                           insight.tipo === 'warning' ? <AlertTriangle size={20} className="text-amber-600 mt-0.5" /> :
                           <Info size={20} className="text-blue-600 mt-0.5" />}
                          <div>
                            <p className={`font-medium ${insight.tipo === 'success' ? 'text-emerald-800' : insight.tipo === 'warning' ? 'text-amber-800' : 'text-blue-800'}`}>{insight.titulo}</p>
                            <p className="text-sm text-gray-600 mt-1">{insight.mensaje}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </TabPanel>

            {/* Inspectores Panel */}
            <TabPanel>
              <Card>
                <Title>Rendimiento de Inspectores</Title>
                <Text className="text-gray-500">Cantidad de correos y tiempo de respuesta</Text>
                <Table className="mt-4">
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Inspector</TableHeaderCell>
                      <TableHeaderCell className="text-right">Correos</TableHeaderCell>
                      <TableHeaderCell className="text-right">Respondidos</TableHeaderCell>
                      <TableHeaderCell className="text-right">Tasa Resp.</TableHeaderCell>
                      <TableHeaderCell className="text-right">Dias Prom.</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stats?.por_inspector.map((i) => (
                      <TableRow key={i.inspector}>
                        <TableCell className="font-medium">{i.inspector}</TableCell>
                        <TableCell className="text-right">{formatNumber(i.cantidad)}</TableCell>
                        <TableCell className="text-right">{formatNumber(i.respondidos)}</TableCell>
                        <TableCell className="text-right">
                          <Badge color={i.tasa_respuesta >= 90 ? 'emerald' : 'amber'}>
                            {i.tasa_respuesta}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge color={i.dias_promedio <= 3 ? 'emerald' : i.dias_promedio <= 7 ? 'amber' : 'rose'}>
                            {i.dias_promedio} dias
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabPanel>

            {/* Datos Panel */}
            <TabPanel>
              <Card className="mb-4">
                <Flex justifyContent="between" alignItems="end" className="flex-wrap gap-4">
                  <div className="flex flex-wrap gap-3">
                    <div className="w-56">
                      <TextInput icon={Search} placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                    <div className="w-48">
                      <Select value={inspector} onValueChange={setInspector} placeholder="Inspector">
                        <SelectItem value="">Todos</SelectItem>
                        {inspectores.slice(0, 20).map(i => (
                          <SelectItem key={i.inspector} value={i.inspector}>{i.inspector}</SelectItem>
                        ))}
                      </Select>
                    </div>
                    <div className="w-48">
                      <Select value={comuna} onValueChange={setComuna} placeholder="Comuna">
                        <SelectItem value="">Todas</SelectItem>
                        {comunas.map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={clearFilters}><Filter size={14} />Limpiar</Button>
                    <ExportDropdown onExport={handleExport} loading={exporting} loadingFormat={exporting ? exportFormat : null} totalRecords={data?.total} hasFilters={hasActiveFilters} />
                  </div>
                </Flex>
              </Card>
              <Card>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Fecha Recep.</TableHeaderCell>
                      <TableHeaderCell>Cliente</TableHeaderCell>
                      <TableHeaderCell>Fuente</TableHeaderCell>
                      <TableHeaderCell>Inspector</TableHeaderCell>
                      <TableHeaderCell>Gestion</TableHeaderCell>
                      <TableHeaderCell>Dias Resp.</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data?.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-gray-500">{item.fecha_recepcion}</TableCell>
                        <TableCell className="font-medium">{item.cliente}</TableCell>
                        <TableCell><Badge color={item.fuente === 'ENEL' ? 'blue' : 'violet'}>{item.fuente}</Badge></TableCell>
                        <TableCell className="text-gray-500 truncate max-w-[120px]">{item.inspector}</TableCell>
                        <TableCell className="text-gray-500 truncate max-w-[100px]">{item.gestion || '-'}</TableCell>
                        <TableCell>
                          {item.dias_respuesta != null ? (
                            <Badge color={item.dias_respuesta <= 3 ? 'emerald' : item.dias_respuesta <= 7 ? 'amber' : 'rose'}>
                              {item.dias_respuesta} dias
                            </Badge>
                          ) : (
                            <Badge color="gray">Pendiente</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Flex justifyContent="between" className="mt-4 pt-4 border-t">
                  <Text className="text-sm text-gray-500">
                    {((data?.page || 1) - 1) * 10 + 1}-{Math.min((data?.page || 1) * 10, data?.total || 0)} de {formatNumber(data?.total || 0)}
                  </Text>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Anterior</Button>
                    <Button variant="secondary" size="sm" disabled={page >= (data?.pages || 1)} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
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
