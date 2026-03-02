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
  Tab,
  TabGroup,
  TabList,
  TabPanel,
  TabPanels,
} from '@tremor/react'
import { Search, Filter, CheckCircle, AlertTriangle, Info, Receipt, Users, TrendingUp, TrendingDown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ExportOverlay } from '@/components/ui/ExportOverlay'
import { ExportDropdown } from '@/components/ui/ExportDropdown'
import { formatNumber } from '@/lib/utils'
import { api } from '@/lib/api'

interface Stats {
  total: number
  total_kwh_cobrar: number
  total_kwh_rebajar: number
  impacto_neto: number
  lectores_unicos: number
  clientes_afectados: number
  por_lector: Array<{ leido_por: string; cantidad: number; kwh_cobrar: number; kwh_rebajar: number; impacto: number }>
  por_comuna: Array<{ comuna: string; cantidad: number; kwh_cobrar: number; kwh_rebajar: number; impacto: number }>
  evolucion_mensual: Array<{ periodo: string; total: number; kwh_cobrar: number; kwh_rebajar: number; impacto: number }>
  insights: Array<{ tipo: 'success' | 'warning' | 'info'; titulo: string; mensaje: string }>
}

interface RefaItem {
  id: number
  cliente: string
  ruta: string
  medidor: string
  lectura_normal: number
  fecha_normal: string
  lectura_erronea: number
  fecha_erronea: string
  kwh_cobrar: number
  kwh_rebajar: number
  comuna: string
  leido_por: string
}

interface PaginatedResponse {
  items: RefaItem[]
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

export default function RefacturacionesPage() {
  // Global filters
  const [globalComuna, setGlobalComuna] = useState('')
  const [globalMes, setGlobalMes] = useState('')
  const [globalAnio, setGlobalAnio] = useState('')
  const [periodos, setPeriodos] = useState<{ meses: number[]; anios: number[]; ultimo_mes: number | null; ultimo_anio: number | null }>({ meses: [], anios: [], ultimo_mes: null, ultimo_anio: null })

  // Table filters
  const [leidoPor, setLeidoPor] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)

  // Data
  const [stats, setStats] = useState<Stats | null>(null)
  const [data, setData] = useState<PaginatedResponse | null>(null)
  const [comunas, setComunas] = useState<string[]>([])
  const [lectores, setLectores] = useState<Array<{ leido_por: string; cantidad: number }>>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState<'excel' | 'csv'>('excel')

  const fetchPeriodos = useCallback(async () => {
    try {
      const response = await api.get<{ meses: number[]; anios: number[]; ultimo_mes: number | null; ultimo_anio: number | null }>('/api/v1/lectura/refacturaciones/periodos')
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
      if (globalComuna) params.append('comuna', globalComuna)
      if (globalMes) params.append('mes', globalMes)
      if (globalAnio) params.append('anio', globalAnio)

      const response = await api.get<Stats>(`/api/v1/lectura/refacturaciones/stats${params.toString() ? '?' + params.toString() : ''}`)
      setStats(response)
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }, [globalComuna, globalMes, globalAnio])

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      params.append('page', page.toString())
      params.append('limit', '10')
      if (searchTerm) params.append('search', searchTerm)
      if (globalComuna) params.append('comuna', globalComuna)
      if (globalMes) params.append('mes', globalMes)
      if (globalAnio) params.append('anio', globalAnio)
      if (leidoPor) params.append('leido_por', leidoPor)

      const response = await api.get<PaginatedResponse>(`/api/v1/lectura/refacturaciones?${params.toString()}`)
      setData(response)
    } catch (error) {
      console.error('Error fetching data:', error)
    }
  }, [page, searchTerm, globalComuna, globalMes, globalAnio, leidoPor])

  const fetchComunas = useCallback(async () => {
    try {
      const response = await api.get<string[]>('/api/v1/lectura/refacturaciones/comunas')
      setComunas(response)
    } catch (error) {
      console.error('Error fetching comunas:', error)
    }
  }, [])

  const fetchLectores = useCallback(async () => {
    try {
      const response = await api.get<Array<{ leido_por: string; cantidad: number }>>('/api/v1/lectura/refacturaciones/lectores')
      setLectores(response)
    } catch (error) {
      console.error('Error fetching lectores:', error)
    }
  }, [])

  const renderCount = useRef(0)

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true)
      const [, , periodosRes] = await Promise.all([fetchComunas(), fetchLectores(), fetchPeriodos()])

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
        api.get<Stats>(`/api/v1/lectura/refacturaciones/stats${statsParams.toString() ? '?' + statsParams.toString() : ''}`),
        api.get<PaginatedResponse>(`/api/v1/lectura/refacturaciones?${dataParams.toString()}`),
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
    setLeidoPor('')
    setPage(1)
  }

  const clearGlobalFilters = () => {
    setGlobalComuna('')
    setGlobalMes('')
    setGlobalAnio('')
  }

  const hasActiveFilters = Boolean(globalComuna || globalMes || globalAnio || leidoPor || searchTerm)

  const handleExport = async (format: 'csv' | 'excel') => {
    try {
      setExportFormat(format)
      setExporting(true)
      const params: Record<string, string | undefined> = {
        format,
        comuna: globalComuna || undefined,
        mes: globalMes || undefined,
        anio: globalAnio || undefined,
        leido_por: leidoPor || undefined,
        search: searchTerm || undefined,
      }
      const filename = format === 'excel' ? 'refacturaciones.xlsx' : 'refacturaciones.csv'
      await api.downloadFile('/api/v1/lectura/refacturaciones/export', filename, params)
    } catch (error) {
      console.error('Error exporting:', error)
      alert('Error al exportar los datos')
    } finally {
      setExporting(false)
    }
  }

  // Chart data
  const lectorChartData = stats?.por_lector.slice(0, 10).map(l => ({
    name: l.leido_por,
    Cantidad: l.cantidad,
    'kWh Cobrar': Math.round(l.kwh_cobrar),
    'kWh Rebajar': Math.round(l.kwh_rebajar),
  })) || []

  const comunaChartData = stats?.por_comuna.slice(0, 10).map(c => ({
    name: c.comuna,
    Cantidad: c.cantidad,
    Impacto: Math.round(c.impacto),
  })) || []

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
      <Header title="Refacturaciones" subtitle="Control de refacturaciones por error de lectura" />

      <div className={`p-6 transition-opacity duration-200 ${refreshing ? 'opacity-60 pointer-events-none' : ''}`}>
        {/* Global Filters Bar */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <Flex justifyContent="between" alignItems="center" className="flex-wrap gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-gray-400" />
                <span className="text-sm font-medium text-gray-600">Filtros:</span>
              </div>
              <div className="w-48">
                <Select value={globalComuna} onValueChange={setGlobalComuna} placeholder="Comuna">
                  <SelectItem value="">Todas</SelectItem>
                  {comunas.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
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
              {(globalComuna || globalMes || globalAnio) && (
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
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Refas</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{formatNumber(stats?.total || 0)}</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">kWh a Cobrar</p>
            <p className="text-2xl font-semibold text-emerald-600 mt-1">{formatNumber(Math.round(stats?.total_kwh_cobrar || 0))}</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">kWh a Rebajar</p>
            <p className="text-2xl font-semibold text-rose-600 mt-1">{formatNumber(Math.round(stats?.total_kwh_rebajar || 0))}</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Impacto Neto</p>
            <p className={`text-2xl font-semibold mt-1 flex items-center gap-1 ${(stats?.impacto_neto || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {(stats?.impacto_neto || 0) >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
              {formatNumber(Math.abs(Math.round(stats?.impacto_neto || 0)))}
            </p>
            <p className="text-xs text-gray-400 mt-1">kWh</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Lectores</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{formatNumber(stats?.lectores_unicos || 0)}</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Clientes</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{formatNumber(stats?.clientes_afectados || 0)}</p>
          </div>
        </div>

        {/* Tabs */}
        <TabGroup>
          <TabList className="mb-4">
            <Tab icon={Receipt}>Resumen</Tab>
            <Tab icon={Users}>Por Lector</Tab>
            <Tab icon={Search}>Datos</Tab>
          </TabList>
          <TabPanels>
            {/* Resumen Panel */}
            <TabPanel>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <Card>
                  <Title>Por Lector</Title>
                  <Text className="text-gray-500">Refacturaciones por lector responsable</Text>
                  <BarChart
                    className="mt-4 h-64"
                    data={lectorChartData}
                    index="name"
                    categories={['Cantidad', 'kWh Cobrar', 'kWh Rebajar']}
                    colors={['blue', 'emerald', 'rose']}
                    valueFormatter={(v) => formatNumber(v)}
                    showAnimation
                  />
                </Card>
                <Card>
                  <Title>Por Comuna</Title>
                  <Text className="text-gray-500">Refacturaciones e impacto por comuna</Text>
                  <BarChart
                    className="mt-4 h-64"
                    data={comunaChartData}
                    index="name"
                    categories={['Cantidad', 'Impacto']}
                    colors={['blue', 'violet']}
                    valueFormatter={(v) => formatNumber(v)}
                    layout="vertical"
                    yAxisWidth={100}
                    showAnimation
                  />
                </Card>
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

            {/* Por Lector Panel */}
            <TabPanel>
              <Card>
                <Title>Detalle por Lector</Title>
                <Text className="text-gray-500">Refacturaciones y kWh por lector responsable</Text>
                <Table className="mt-4">
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Lector</TableHeaderCell>
                      <TableHeaderCell className="text-right">Refas</TableHeaderCell>
                      <TableHeaderCell className="text-right">kWh Cobrar</TableHeaderCell>
                      <TableHeaderCell className="text-right">kWh Rebajar</TableHeaderCell>
                      <TableHeaderCell className="text-right">Impacto</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stats?.por_lector.map((l) => (
                      <TableRow key={l.leido_por}>
                        <TableCell className="font-medium">{l.leido_por}</TableCell>
                        <TableCell className="text-right">{formatNumber(l.cantidad)}</TableCell>
                        <TableCell className="text-right text-emerald-600">{formatNumber(Math.round(l.kwh_cobrar))}</TableCell>
                        <TableCell className="text-right text-rose-600">{formatNumber(Math.round(l.kwh_rebajar))}</TableCell>
                        <TableCell className="text-right">
                          <Badge color={l.impacto >= 0 ? 'emerald' : 'rose'}>
                            {l.impacto >= 0 ? '+' : ''}{formatNumber(Math.round(l.impacto))}
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
                      <Select value={leidoPor} onValueChange={setLeidoPor} placeholder="Lector">
                        <SelectItem value="">Todos</SelectItem>
                        {lectores.slice(0, 20).map(l => (
                          <SelectItem key={l.leido_por} value={l.leido_por}>{l.leido_por}</SelectItem>
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
                      <TableHeaderCell>Cliente</TableHeaderCell>
                      <TableHeaderCell>Medidor</TableHeaderCell>
                      <TableHeaderCell>Comuna</TableHeaderCell>
                      <TableHeaderCell>Lector</TableHeaderCell>
                      <TableHeaderCell className="text-right">kWh Cobrar</TableHeaderCell>
                      <TableHeaderCell className="text-right">kWh Rebajar</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data?.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.cliente}</TableCell>
                        <TableCell className="text-gray-500">{item.medidor}</TableCell>
                        <TableCell className="text-gray-500">{item.comuna}</TableCell>
                        <TableCell className="text-gray-500 truncate max-w-[120px]">{item.leido_por}</TableCell>
                        <TableCell className="text-right text-emerald-600">{item.kwh_cobrar ? formatNumber(Math.round(item.kwh_cobrar)) : '-'}</TableCell>
                        <TableCell className="text-right text-rose-600">{item.kwh_rebajar ? formatNumber(Math.round(item.kwh_rebajar)) : '-'}</TableCell>
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
