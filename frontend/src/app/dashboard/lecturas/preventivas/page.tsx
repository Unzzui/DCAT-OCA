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
import { Search, Filter, CheckCircle, AlertTriangle, Info, ClipboardList, BarChart3, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ExportOverlay } from '@/components/ui/ExportOverlay'
import { ExportDropdown } from '@/components/ui/ExportDropdown'
import { formatNumber } from '@/lib/utils'
import { api } from '@/lib/api'

interface Stats {
  total: number
  con_irregularidad: number
  sin_irregularidad: number
  tasa_irregularidad: number
  consumo_promedio: number
  lecturas_insitu: number
  lecturas_rf: number
  lectores_unicos: number
  por_sector: Array<{ sector: number; cantidad: number; con_irregularidad: number; tasa: number }>
  por_zona: Array<{ zona: number; cantidad: number; consumo_promedio: number }>
  por_lector: Array<{ codigo_lector: number; cantidad: number; irregularidades: number; tasa: number }>
  por_irregularidad: Array<{ irregularidad: string; cantidad: number }>
  por_verificacion: Array<{ verificacion: string; cantidad: number }>
  evolucion_mensual: Array<{ periodo: string; total: number; con_irregularidad: number; tasa: number; consumo_promedio: number }>
  insights: Array<{ tipo: 'success' | 'warning' | 'info'; titulo: string; mensaje: string }>
}

interface PreventivaItem {
  id: number
  numero_cliente: string
  sector: number
  zona: number
  ruta: string
  tarifa: string
  direccion: string
  consumo_prom_diario: number
  lectura_anterior: number
  lectura_actual: number
  irregularidad_1: string
  verificacion_lectura: string
  codigo_lector: number
  insitu: string
  rf: string
}

interface PaginatedResponse {
  items: PreventivaItem[]
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

export default function PreventivasPage() {
  // Global filters
  const [globalSector, setGlobalSector] = useState('')
  const [globalZona, setGlobalZona] = useState('')
  const [globalMes, setGlobalMes] = useState('')
  const [globalAnio, setGlobalAnio] = useState('')
  const [periodos, setPeriodos] = useState<{ meses: number[]; anios: number[]; ultimo_mes: number | null; ultimo_anio: number | null }>({ meses: [], anios: [], ultimo_mes: null, ultimo_anio: null })

  // Table filters
  const [conIrregularidad, setConIrregularidad] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)

  // Data
  const [stats, setStats] = useState<Stats | null>(null)
  const [data, setData] = useState<PaginatedResponse | null>(null)
  const [sectores, setSectores] = useState<number[]>([])
  const [zonas, setZonas] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState<'excel' | 'csv'>('excel')

  const fetchPeriodos = useCallback(async () => {
    try {
      const response = await api.get<{ meses: number[]; anios: number[]; ultimo_mes: number | null; ultimo_anio: number | null }>('/api/v1/lectura/preventivas/periodos')
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
      if (globalSector) params.append('sector', globalSector)
      if (globalZona) params.append('zona', globalZona)
      if (globalMes) params.append('mes', globalMes)
      if (globalAnio) params.append('anio', globalAnio)

      const response = await api.get<Stats>(`/api/v1/lectura/preventivas/stats${params.toString() ? '?' + params.toString() : ''}`)
      setStats(response)
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }, [globalSector, globalZona, globalMes, globalAnio])

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      params.append('page', page.toString())
      params.append('limit', '10')
      if (searchTerm) params.append('search', searchTerm)
      if (globalSector) params.append('sector', globalSector)
      if (globalZona) params.append('zona', globalZona)
      if (globalMes) params.append('mes', globalMes)
      if (globalAnio) params.append('anio', globalAnio)
      if (conIrregularidad === 'si') params.append('con_irregularidad', 'true')
      if (conIrregularidad === 'no') params.append('con_irregularidad', 'false')

      const response = await api.get<PaginatedResponse>(`/api/v1/lectura/preventivas?${params.toString()}`)
      setData(response)
    } catch (error) {
      console.error('Error fetching data:', error)
    }
  }, [page, searchTerm, globalSector, globalZona, globalMes, globalAnio, conIrregularidad])

  const fetchSectores = useCallback(async () => {
    try {
      const response = await api.get<number[]>('/api/v1/lectura/preventivas/sectores')
      setSectores(response)
    } catch (error) {
      console.error('Error fetching sectores:', error)
    }
  }, [])

  const fetchZonas = useCallback(async () => {
    try {
      const response = await api.get<number[]>('/api/v1/lectura/preventivas/zonas')
      setZonas(response)
    } catch (error) {
      console.error('Error fetching zonas:', error)
    }
  }, [])

  const renderCount = useRef(0)

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true)
      const [, , periodosRes] = await Promise.all([fetchSectores(), fetchZonas(), fetchPeriodos()])

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
        api.get<Stats>(`/api/v1/lectura/preventivas/stats${statsParams.toString() ? '?' + statsParams.toString() : ''}`),
        api.get<PaginatedResponse>(`/api/v1/lectura/preventivas?${dataParams.toString()}`),
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
    setConIrregularidad('')
    setPage(1)
  }

  const clearGlobalFilters = () => {
    setGlobalSector('')
    setGlobalZona('')
    setGlobalMes('')
    setGlobalAnio('')
  }

  const hasActiveFilters = Boolean(globalSector || globalZona || globalMes || globalAnio || conIrregularidad || searchTerm)

  const handleExport = async (format: 'csv' | 'excel') => {
    try {
      setExportFormat(format)
      setExporting(true)
      const params: Record<string, string | undefined> = {
        format,
        sector: globalSector || undefined,
        zona: globalZona || undefined,
        mes: globalMes || undefined,
        anio: globalAnio || undefined,
        con_irregularidad: conIrregularidad === 'si' ? 'true' : conIrregularidad === 'no' ? 'false' : undefined,
        search: searchTerm || undefined,
      }
      const filename = format === 'excel' ? 'lecturas_preventivas.xlsx' : 'lecturas_preventivas.csv'
      await api.downloadFile('/api/v1/lectura/preventivas/export', filename, params)
    } catch (error) {
      console.error('Error exporting:', error)
      alert('Error al exportar los datos')
    } finally {
      setExporting(false)
    }
  }

  // Chart data
  const sectorChartData = stats?.por_sector.slice(0, 10).map(s => ({
    name: `Sector ${s.sector}`,
    Lecturas: s.cantidad,
    Irregularidades: s.con_irregularidad,
  })) || []

  const zonaChartData = stats?.por_zona.slice(0, 10).map(z => ({
    name: `Zona ${z.zona}`,
    value: z.cantidad,
  })) || []

  const irregularidadChartData = stats?.por_irregularidad.slice(0, 8).map(i => ({
    name: i.irregularidad,
    value: i.cantidad,
  })) || []

  const tipoLecturaData = stats ? [
    { name: 'In-Situ', value: stats.lecturas_insitu },
    { name: 'RF', value: stats.lecturas_rf },
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
      <Header title="Lecturas Preventivas" subtitle="Control de lecturas preventivas y deteccion de irregularidades" />

      <div className={`p-6 transition-opacity duration-200 ${refreshing ? 'opacity-60 pointer-events-none' : ''}`}>
        {/* Global Filters Bar */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <Flex justifyContent="between" alignItems="center" className="flex-wrap gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-gray-400" />
                <span className="text-sm font-medium text-gray-600">Filtros:</span>
              </div>
              <div className="w-32">
                <Select value={globalSector} onValueChange={setGlobalSector} placeholder="Sector">
                  <SelectItem value="">Todos</SelectItem>
                  {sectores.map(s => (
                    <SelectItem key={s} value={String(s)}>Sector {s}</SelectItem>
                  ))}
                </Select>
              </div>
              <div className="w-32">
                <Select value={globalZona} onValueChange={setGlobalZona} placeholder="Zona">
                  <SelectItem value="">Todas</SelectItem>
                  {zonas.map(z => (
                    <SelectItem key={z} value={String(z)}>Zona {z}</SelectItem>
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
              {(globalSector || globalZona || globalMes || globalAnio) && (
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
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Lecturas</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{formatNumber(stats?.total || 0)}</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Con Irregularidad</p>
            <p className="text-2xl font-semibold text-amber-600 mt-1">{formatNumber(stats?.con_irregularidad || 0)}</p>
            <p className="text-xs text-gray-400 mt-1">{stats?.tasa_irregularidad || 0}%</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Sin Irregularidad</p>
            <p className="text-2xl font-semibold text-emerald-600 mt-1">{formatNumber(stats?.sin_irregularidad || 0)}</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Consumo Prom.</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{Number(stats?.consumo_promedio || 0).toFixed(2)}</p>
            <p className="text-xs text-gray-400 mt-1">kWh/dia</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Lecturas In-Situ</p>
            <p className="text-2xl font-semibold text-blue-600 mt-1">{formatNumber(stats?.lecturas_insitu || 0)}</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Lecturas RF</p>
            <p className="text-2xl font-semibold text-violet-600 mt-1">{formatNumber(stats?.lecturas_rf || 0)}</p>
          </div>
        </div>

        {/* Tabs */}
        <TabGroup>
          <TabList className="mb-4">
            <Tab icon={ClipboardList}>Resumen</Tab>
            <Tab icon={BarChart3}>Por Sector/Zona</Tab>
            <Tab icon={Users}>Lectores</Tab>
            <Tab icon={Search}>Datos</Tab>
          </TabList>
          <TabPanels>
            {/* Resumen Panel */}
            <TabPanel>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <Card>
                  <Title>Tipos de Irregularidad</Title>
                  <Text className="text-gray-500">Distribucion de irregularidades detectadas</Text>
                  <DonutChart
                    className="mt-4 h-48"
                    data={irregularidadChartData}
                    category="value"
                    index="name"
                    colors={['rose', 'amber', 'orange', 'yellow', 'lime', 'emerald', 'cyan', 'blue']}
                    valueFormatter={(v) => formatNumber(v)}
                    showAnimation
                  />
                </Card>
                <Card>
                  <Title>Tipo de Lectura</Title>
                  <Text className="text-gray-500">In-Situ vs Radio Frecuencia</Text>
                  <DonutChart
                    className="mt-4 h-48"
                    data={tipoLecturaData}
                    category="value"
                    index="name"
                    colors={['blue', 'violet']}
                    valueFormatter={(v) => formatNumber(v)}
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

            {/* Por Sector/Zona Panel */}
            <TabPanel>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <Title>Por Sector</Title>
                  <Text className="text-gray-500">Lecturas e irregularidades por sector</Text>
                  <BarChart
                    className="mt-4 h-64"
                    data={sectorChartData}
                    index="name"
                    categories={['Lecturas', 'Irregularidades']}
                    colors={['blue', 'rose']}
                    valueFormatter={(v) => formatNumber(v)}
                    showAnimation
                  />
                </Card>
                <Card>
                  <Title>Por Zona</Title>
                  <Text className="text-gray-500">Distribucion de lecturas por zona</Text>
                  <BarChart
                    className="mt-4 h-64"
                    data={zonaChartData}
                    index="name"
                    categories={['value']}
                    colors={['cyan']}
                    valueFormatter={(v) => formatNumber(v)}
                    layout="vertical"
                    yAxisWidth={80}
                    showAnimation
                  />
                </Card>
              </div>
            </TabPanel>

            {/* Lectores Panel */}
            <TabPanel>
              <Card>
                <Title>Rendimiento de Lectores</Title>
                <Text className="text-gray-500">Cantidad de lecturas y tasa de irregularidades por lector</Text>
                <Table className="mt-4">
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Codigo Lector</TableHeaderCell>
                      <TableHeaderCell className="text-right">Lecturas</TableHeaderCell>
                      <TableHeaderCell className="text-right">Irregularidades</TableHeaderCell>
                      <TableHeaderCell className="text-right">Tasa</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stats?.por_lector.map((l) => (
                      <TableRow key={l.codigo_lector}>
                        <TableCell className="font-medium">{l.codigo_lector}</TableCell>
                        <TableCell className="text-right">{formatNumber(l.cantidad)}</TableCell>
                        <TableCell className="text-right">{formatNumber(l.irregularidades)}</TableCell>
                        <TableCell className="text-right">
                          <Badge color={l.tasa < 5 ? 'emerald' : l.tasa < 10 ? 'amber' : 'rose'}>
                            {l.tasa}%
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
                      <Select value={conIrregularidad} onValueChange={setConIrregularidad} placeholder="Irregularidad">
                        <SelectItem value="">Todas</SelectItem>
                        <SelectItem value="si">Con Irregularidad</SelectItem>
                        <SelectItem value="no">Sin Irregularidad</SelectItem>
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
                      <TableHeaderCell>Sector</TableHeaderCell>
                      <TableHeaderCell>Zona</TableHeaderCell>
                      <TableHeaderCell>Ruta</TableHeaderCell>
                      <TableHeaderCell>Consumo Prom.</TableHeaderCell>
                      <TableHeaderCell>Irregularidad</TableHeaderCell>
                      <TableHeaderCell>Tipo</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data?.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.numero_cliente}</TableCell>
                        <TableCell className="text-gray-500">{item.sector}</TableCell>
                        <TableCell className="text-gray-500">{item.zona}</TableCell>
                        <TableCell className="text-gray-500">{item.ruta}</TableCell>
                        <TableCell className="text-gray-500">{item.consumo_prom_diario ? Number(item.consumo_prom_diario).toFixed(2) : '-'}</TableCell>
                        <TableCell>{item.irregularidad_1 ? <Badge color="amber">{item.irregularidad_1}</Badge> : <span className="text-gray-400">-</span>}</TableCell>
                        <TableCell>
                          {item.insitu === 'S' ? <Badge color="blue">In-Situ</Badge> : item.rf === 'S' ? <Badge color="violet">RF</Badge> : <span className="text-gray-400">-</span>}
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
