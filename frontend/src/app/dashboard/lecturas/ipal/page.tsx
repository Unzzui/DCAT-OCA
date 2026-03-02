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
} from '@tremor/react'
import { Search, Filter, CheckCircle, AlertTriangle, Info, Shield, Users, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ExportOverlay } from '@/components/ui/ExportOverlay'
import { ExportDropdown } from '@/components/ui/ExportDropdown'
import { formatNumber } from '@/lib/utils'
import { api } from '@/lib/api'

interface Stats {
  total: number
  conformes: number
  con_hallazgo: number
  lectores_unicos: number
  inspectores_unicos: number
  tasa_conformidad: number
  por_estado: Record<string, number>
  por_empresa: Array<{ empresa: string; cantidad: number; lectores: number }>
  por_inspector: Array<{ inspector: string; cantidad: number; conformes: number; tasa_conformidad: number }>
  por_comuna: Array<{ comuna: string; cantidad: number }>
  por_hallazgo: Array<{ hallazgo: string; cantidad: number }>
  evolucion_mensual: Array<{ periodo: string; total: number; conformes: number; tasa: number }>
  insights: Array<{ tipo: 'success' | 'warning' | 'info'; titulo: string; mensaje: string }>
}

interface IpalItem {
  id: number
  fecha: string
  comuna: string
  nombre_lector: string
  empresa: string
  inspector: string
  estado: string
  nro_ipal: string
  observacion: string
  codigo_hallazgo: string
  direccion: string
}

interface PaginatedResponse {
  items: IpalItem[]
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

export default function IpalPage() {
  // Global filters
  const [globalEmpresa, setGlobalEmpresa] = useState('')
  const [globalMes, setGlobalMes] = useState('')
  const [globalAnio, setGlobalAnio] = useState('')
  const [periodos, setPeriodos] = useState<{ meses: number[]; anios: number[]; ultimo_mes: number | null; ultimo_anio: number | null }>({ meses: [], anios: [], ultimo_mes: null, ultimo_anio: null })

  // Table filters
  const [inspector, setInspector] = useState('')
  const [comuna, setCcomuna] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)

  // Data
  const [stats, setStats] = useState<Stats | null>(null)
  const [data, setData] = useState<PaginatedResponse | null>(null)
  const [empresas, setEmpresas] = useState<string[]>([])
  const [comunas, setComunas] = useState<string[]>([])
  const [inspectores, setInspectores] = useState<Array<{ inspector: string; cantidad: number }>>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState<'excel' | 'csv'>('excel')

  const fetchPeriodos = useCallback(async () => {
    try {
      const response = await api.get<{ meses: number[]; anios: number[]; ultimo_mes: number | null; ultimo_anio: number | null }>('/api/v1/lectura/ipal/periodos')
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
      if (globalEmpresa) params.append('empresa', globalEmpresa)
      if (globalMes) params.append('mes', globalMes)
      if (globalAnio) params.append('anio', globalAnio)

      const response = await api.get<Stats>(`/api/v1/lectura/ipal/stats${params.toString() ? '?' + params.toString() : ''}`)
      setStats(response)
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }, [globalEmpresa, globalMes, globalAnio])

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      params.append('page', page.toString())
      params.append('limit', '10')
      if (searchTerm) params.append('search', searchTerm)
      if (globalEmpresa) params.append('empresa', globalEmpresa)
      if (globalMes) params.append('mes', globalMes)
      if (globalAnio) params.append('anio', globalAnio)
      if (inspector) params.append('inspector', inspector)
      if (comuna) params.append('comuna', comuna)

      const response = await api.get<PaginatedResponse>(`/api/v1/lectura/ipal?${params.toString()}`)
      setData(response)
    } catch (error) {
      console.error('Error fetching data:', error)
    }
  }, [page, searchTerm, globalEmpresa, globalMes, globalAnio, inspector, comuna])

  const fetchEmpresas = useCallback(async () => {
    try {
      const response = await api.get<string[]>('/api/v1/lectura/ipal/empresas')
      setEmpresas(response)
    } catch (error) {
      console.error('Error fetching empresas:', error)
    }
  }, [])

  const fetchComunas = useCallback(async () => {
    try {
      const response = await api.get<string[]>('/api/v1/lectura/ipal/comunas')
      setComunas(response)
    } catch (error) {
      console.error('Error fetching comunas:', error)
    }
  }, [])

  const fetchInspectores = useCallback(async () => {
    try {
      const response = await api.get<Array<{ inspector: string; cantidad: number }>>('/api/v1/lectura/ipal/inspectores')
      setInspectores(response)
    } catch (error) {
      console.error('Error fetching inspectores:', error)
    }
  }, [])

  const renderCount = useRef(0)

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true)
      const [, , , periodosRes] = await Promise.all([fetchEmpresas(), fetchComunas(), fetchInspectores(), fetchPeriodos()])

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
        api.get<Stats>(`/api/v1/lectura/ipal/stats${statsParams.toString() ? '?' + statsParams.toString() : ''}`),
        api.get<PaginatedResponse>(`/api/v1/lectura/ipal?${dataParams.toString()}`),
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

  const getEstadoBadge = (estado: string) => {
    if (!estado) return <span className="text-gray-400">-</span>
    const isOk = estado.toLowerCase().includes('ok') || estado.toLowerCase().includes('conforme')
    return (
      <Badge color={isOk ? 'emerald' : 'amber'}>{estado}</Badge>
    )
  }

  const clearFilters = () => {
    setSearchTerm('')
    setInspector('')
    setCcomuna('')
    setPage(1)
  }

  const clearGlobalFilters = () => {
    setGlobalEmpresa('')
    setGlobalMes('')
    setGlobalAnio('')
  }

  const hasActiveFilters = Boolean(globalEmpresa || globalMes || globalAnio || inspector || comuna || searchTerm)

  const handleExport = async (format: 'csv' | 'excel') => {
    try {
      setExportFormat(format)
      setExporting(true)
      const params: Record<string, string | undefined> = {
        format,
        empresa: globalEmpresa || undefined,
        mes: globalMes || undefined,
        anio: globalAnio || undefined,
        inspector: inspector || undefined,
        comuna: comuna || undefined,
        search: searchTerm || undefined,
      }
      const filename = format === 'excel' ? 'ipal_inspecciones.xlsx' : 'ipal_inspecciones.csv'
      await api.downloadFile('/api/v1/lectura/ipal/export', filename, params)
    } catch (error) {
      console.error('Error exporting:', error)
      alert('Error al exportar los datos')
    } finally {
      setExporting(false)
    }
  }

  // Chart data
  const empresaChartData = stats?.por_empresa.slice(0, 8).map(e => ({
    name: e.empresa,
    Inspecciones: e.cantidad,
    Lectores: e.lectores,
  })) || []

  const inspectorChartData = stats?.por_inspector.slice(0, 10).map(i => ({
    name: i.inspector,
    Cantidad: i.cantidad,
    Conformidad: i.tasa_conformidad,
  })) || []

  const hallazgoChartData = stats?.por_hallazgo.slice(0, 8).map(h => ({
    name: h.hallazgo,
    value: h.cantidad,
  })) || []

  const comunaChartData = stats?.por_comuna.slice(0, 10).map(c => ({
    name: c.comuna,
    value: c.cantidad,
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
      <ExportOverlay
        isVisible={exporting}
        format={exportFormat}
        recordCount={hasActiveFilters ? data?.total : stats?.total}
        hasFilters={hasActiveFilters}
      />
      {refreshing && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-white rounded-full shadow-lg px-4 py-2 flex items-center gap-2 border">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-oca-blue border-t-transparent"></div>
          <span className="text-sm text-gray-600">Actualizando datos...</span>
        </div>
      )}
      <Header
        title="Inspecciones de Seguridad (IPAL)"
        subtitle="Control de inspecciones a lectores en terreno"
      />

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
                <Select value={globalEmpresa} onValueChange={setGlobalEmpresa} placeholder="Empresa">
                  <SelectItem value="">Todas las empresas</SelectItem>
                  {empresas.map(e => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
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
              {(globalEmpresa || globalMes || globalAnio) && (
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
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Inspecciones</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{formatNumber(stats?.total || 0)}</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Conformes</p>
            <p className="text-2xl font-semibold text-emerald-600 mt-1">{formatNumber(stats?.conformes || 0)}</p>
            <p className="text-xs text-gray-400 mt-1">{stats?.tasa_conformidad || 0}%</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Con Hallazgo</p>
            <p className="text-2xl font-semibold text-amber-600 mt-1">{formatNumber(stats?.con_hallazgo || 0)}</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Lectores</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{formatNumber(stats?.lectores_unicos || 0)}</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Inspectores</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{formatNumber(stats?.inspectores_unicos || 0)}</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tasa Conformidad</p>
            <p className={`text-2xl font-semibold mt-1 ${(stats?.tasa_conformidad || 0) >= 90 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {stats?.tasa_conformidad || 0}%
            </p>
          </div>
        </div>

        {/* Tabs */}
        <TabGroup>
          <TabList className="mb-4">
            <Tab icon={Shield}>Resumen</Tab>
            <Tab icon={Building2}>Por Empresa</Tab>
            <Tab icon={Users}>Inspectores</Tab>
            <Tab icon={Search}>Datos</Tab>
          </TabList>
          <TabPanels>
            {/* Resumen Panel */}
            <TabPanel>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Hallazgos */}
                <Card>
                  <Title>Tipos de Hallazgo</Title>
                  <Text className="text-gray-500">Distribucion de hallazgos encontrados</Text>
                  <DonutChart
                    className="mt-4 h-48"
                    data={hallazgoChartData}
                    category="value"
                    index="name"
                    colors={['blue', 'cyan', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose']}
                    valueFormatter={(v) => formatNumber(v)}
                    showAnimation
                  />
                </Card>

                {/* Por Comuna */}
                <Card>
                  <Title>Distribucion por Comuna</Title>
                  <Text className="text-gray-500">Top 10 comunas con mas inspecciones</Text>
                  <BarChart
                    className="mt-4 h-48"
                    data={comunaChartData}
                    index="name"
                    categories={['value']}
                    colors={['blue']}
                    valueFormatter={(v) => formatNumber(v)}
                    layout="vertical"
                    yAxisWidth={100}
                    showAnimation
                  />
                </Card>
              </div>

              {/* Insights */}
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
                    ))}
                  </div>
                </Card>
              )}
            </TabPanel>

            {/* Por Empresa Panel */}
            <TabPanel>
              <Card>
                <Title>Inspecciones por Empresa</Title>
                <Text className="text-gray-500">Cantidad de inspecciones y lectores por empresa</Text>
                <BarChart
                  className="mt-4 h-80"
                  data={empresaChartData}
                  index="name"
                  categories={['Inspecciones', 'Lectores']}
                  colors={['blue', 'cyan']}
                  valueFormatter={(v) => formatNumber(v)}
                  showAnimation
                />
              </Card>
            </TabPanel>

            {/* Inspectores Panel */}
            <TabPanel>
              <Card>
                <Title>Rendimiento de Inspectores</Title>
                <Text className="text-gray-500">Cantidad de inspecciones y tasa de conformidad</Text>
                <Table className="mt-4">
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Inspector</TableHeaderCell>
                      <TableHeaderCell className="text-right">Inspecciones</TableHeaderCell>
                      <TableHeaderCell className="text-right">Conformes</TableHeaderCell>
                      <TableHeaderCell className="text-right">Tasa Conformidad</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stats?.por_inspector.map((i) => (
                      <TableRow key={i.inspector}>
                        <TableCell className="font-medium">{i.inspector}</TableCell>
                        <TableCell className="text-right">{formatNumber(i.cantidad)}</TableCell>
                        <TableCell className="text-right">{formatNumber(i.conformes)}</TableCell>
                        <TableCell className="text-right">
                          <Badge color={i.tasa_conformidad >= 90 ? 'emerald' : 'amber'}>
                            {i.tasa_conformidad}%
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
                        {inspectores.slice(0, 20).map(i => (
                          <SelectItem key={i.inspector} value={i.inspector}>{i.inspector}</SelectItem>
                        ))}
                      </Select>
                    </div>
                    <div className="w-48">
                      <Select value={comuna} onValueChange={setCcomuna} placeholder="Comuna">
                        <SelectItem value="">Todas</SelectItem>
                        {comunas.map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
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

              <Card>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Fecha</TableHeaderCell>
                      <TableHeaderCell>Lector</TableHeaderCell>
                      <TableHeaderCell>Empresa</TableHeaderCell>
                      <TableHeaderCell>Inspector</TableHeaderCell>
                      <TableHeaderCell>Comuna</TableHeaderCell>
                      <TableHeaderCell>Estado</TableHeaderCell>
                      <TableHeaderCell>Hallazgo</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data?.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-gray-500">{item.fecha}</TableCell>
                        <TableCell className="font-medium truncate max-w-[150px]">{item.nombre_lector}</TableCell>
                        <TableCell className="text-gray-500">{item.empresa}</TableCell>
                        <TableCell className="text-gray-500 truncate max-w-[120px]">{item.inspector}</TableCell>
                        <TableCell className="text-gray-500">{item.comuna}</TableCell>
                        <TableCell>{getEstadoBadge(item.estado)}</TableCell>
                        <TableCell className="text-gray-500 truncate max-w-[150px]">{item.codigo_hallazgo || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <Flex justifyContent="between" className="mt-4 pt-4 border-t">
                  <Text className="text-sm text-gray-500">
                    {((data?.page || 1) - 1) * 10 + 1}-{Math.min((data?.page || 1) * 10, data?.total || 0)} de {formatNumber(data?.total || 0)}
                  </Text>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                      Anterior
                    </Button>
                    <Button variant="secondary" size="sm" disabled={page >= (data?.pages || 1)} onClick={() => setPage(p => p + 1)}>
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
