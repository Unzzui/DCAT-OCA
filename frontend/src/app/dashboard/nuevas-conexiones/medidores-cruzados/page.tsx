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
  AreaChart,
  Tab,
  TabGroup,
  TabList,
  TabPanel,
  TabPanels,
  ProgressBar,
} from '@tremor/react'
import {
  Search,
  Filter,
  TrendingUp,
  Users,
  MapPin,
  GitCompare,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ExportOverlay } from '@/components/ui/ExportOverlay'
import { ExportDropdown } from '@/components/ui/ExportDropdown'
import { formatNumber } from '@/lib/utils'
import { api } from '@/lib/api'
import { MedidoresCruzadosStats, PaginatedResponse, MedidorCruzado } from '@/types'

interface Periodos {
  meses: number[]
  anios: number[]
  ultimo_mes: number | null
  ultimo_anio: number | null
}

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

const MES_MAP: Record<number, string> = {
  1: 'ENERO', 2: 'FEBRERO', 3: 'MARZO', 4: 'ABRIL', 5: 'MAYO', 6: 'JUNIO',
  7: 'JULIO', 8: 'AGOSTO', 9: 'SEPTIEMBRE', 10: 'OCTUBRE', 11: 'NOVIEMBRE', 12: 'DICIEMBRE',
}

export default function MedidoresCruzadosPage() {
  // Global filters
  const [globalZona, setGlobalZona] = useState('')
  const [globalComuna, setGlobalComuna] = useState('')
  const [globalEstadoMedidor, setGlobalEstadoMedidor] = useState('')
  const [globalMes, setGlobalMes] = useState('')
  const [globalAnio, setGlobalAnio] = useState('')

  // Table filters
  const [searchTerm, setSearchTerm] = useState('')
  const [tableResultado, setTableResultado] = useState('')
  const [page, setPage] = useState(1)

  // Data
  const [stats, setStats] = useState<MedidoresCruzadosStats | null>(null)
  const [data, setData] = useState<PaginatedResponse<MedidorCruzado> | null>(null)
  const [zonas, setZonas] = useState<string[]>([])
  const [comunas, setComunas] = useState<string[]>([])
  const [estadosMedidor, setEstadosMedidor] = useState<string[]>([])
  const [periodos, setPeriodos] = useState<Periodos>({ meses: [], anios: [], ultimo_mes: null, ultimo_anio: null })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState<'excel' | 'csv'>('excel')

  const fetchFilters = useCallback(async () => {
    try {
      const [z, c, e, p] = await Promise.all([
        api.get<string[]>('/api/v1/medidores-cruzados/zonas'),
        api.get<string[]>('/api/v1/medidores-cruzados/comunas'),
        api.get<string[]>('/api/v1/medidores-cruzados/estados-medidor'),
        api.get<Periodos>('/api/v1/medidores-cruzados/periodos'),
      ])
      setZonas(z)
      setComunas(c)
      setEstadosMedidor(e)
      setPeriodos(p)
    } catch (error) {
      console.error('Error fetching filters:', error)
    }
  }, [])

  const fetchStats = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (globalZona) params.append('zona', globalZona)
      if (globalComuna) params.append('comuna', globalComuna)
      if (globalEstadoMedidor) params.append('estado_medidor', globalEstadoMedidor)
      if (globalMes) params.append('mes', MES_MAP[Number(globalMes)] || '')
      if (globalAnio) params.append('anio', globalAnio)

      const url = `/api/v1/medidores-cruzados/stats${params.toString() ? '?' + params.toString() : ''}`
      const response = await api.get<MedidoresCruzadosStats>(url)
      setStats(response)
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }, [globalZona, globalComuna, globalEstadoMedidor, globalMes, globalAnio])

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      params.append('page', page.toString())
      params.append('limit', '10')
      if (searchTerm) params.append('search', searchTerm)
      if (globalZona) params.append('zona', globalZona)
      if (globalComuna) params.append('comuna', globalComuna)
      if (globalEstadoMedidor) params.append('estado_medidor', globalEstadoMedidor)
      if (globalMes) params.append('mes', MES_MAP[Number(globalMes)] || '')
      if (globalAnio) params.append('anio', globalAnio)
      if (tableResultado) params.append('search', tableResultado)

      const response = await api.get<PaginatedResponse<MedidorCruzado>>(`/api/v1/medidores-cruzados?${params.toString()}`)
      setData(response)
    } catch (error) {
      console.error('Error fetching data:', error)
    }
  }, [page, searchTerm, globalZona, globalComuna, globalEstadoMedidor, globalMes, globalAnio, tableResultado])

  const renderCount = useRef(0)

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true)
      const [z, c, e, periodosRes] = await Promise.all([
        api.get<string[]>('/api/v1/medidores-cruzados/zonas'),
        api.get<string[]>('/api/v1/medidores-cruzados/comunas'),
        api.get<string[]>('/api/v1/medidores-cruzados/estados-medidor'),
        api.get<Periodos>('/api/v1/medidores-cruzados/periodos'),
      ])
      setZonas(z)
      setComunas(c)
      setEstadosMedidor(e)
      setPeriodos(periodosRes)

      const initMes = periodosRes.ultimo_mes ? String(periodosRes.ultimo_mes) : ''
      const initAnio = periodosRes.ultimo_anio ? String(periodosRes.ultimo_anio) : ''

      const statsParams = new URLSearchParams()
      if (initMes) statsParams.append('mes', MES_MAP[Number(initMes)] || '')
      if (initAnio) statsParams.append('anio', initAnio)

      const dataParams = new URLSearchParams()
      dataParams.append('page', '1')
      dataParams.append('limit', '10')
      if (initMes) dataParams.append('mes', MES_MAP[Number(initMes)] || '')
      if (initAnio) dataParams.append('anio', initAnio)

      const [statsRes, dataRes] = await Promise.all([
        api.get<MedidoresCruzadosStats>(`/api/v1/medidores-cruzados/stats${statsParams.toString() ? '?' + statsParams.toString() : ''}`),
        api.get<PaginatedResponse<MedidorCruzado>>(`/api/v1/medidores-cruzados?${dataParams.toString()}`),
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

  const clearGlobalFilters = () => {
    setGlobalZona('')
    setGlobalComuna('')
    setGlobalEstadoMedidor('')
    setGlobalMes('')
    setGlobalAnio('')
  }

  const clearTableFilters = () => {
    setSearchTerm('')
    setTableResultado('')
    setPage(1)
  }

  const hasActiveFilters = Boolean(globalZona || globalComuna || globalEstadoMedidor || globalMes || globalAnio || searchTerm || tableResultado)

  const handleExport = async (format: 'csv' | 'excel') => {
    try {
      setExportFormat(format)
      setExporting(true)
      const params: Record<string, string | undefined> = {
        format,
        zona: globalZona || undefined,
        comuna: globalComuna || undefined,
        estado_medidor: globalEstadoMedidor || undefined,
        mes: globalMes ? MES_MAP[Number(globalMes)] : undefined,
        anio: globalAnio || undefined,
        search: searchTerm || undefined,
      }
      const filename = format === 'excel' ? 'medidores_cruzados.xlsx' : 'medidores_cruzados.csv'
      await api.downloadFile('/api/v1/medidores-cruzados/export', filename, params)
    } catch (error) {
      console.error('Error exporting:', error)
      alert('Error al exportar los datos')
    } finally {
      setExporting(false)
    }
  }

  // Chart data
  const zonaData = stats ? Object.entries(stats.por_zona).map(([name, value]) => ({
    name,
    value: value as number
  })) : []

  const estadoMedidorData = stats ? Object.entries(stats.por_estado_medidor).slice(0, 8).map(([name, value]) => ({
    name: name.length > 25 ? name.substring(0, 25) + '...' : name,
    value: value as number
  })) : []

  const resultadoData = stats ? Object.entries(stats.por_resultado).map(([name, value]) => ({
    name,
    value: value as number
  })).filter(d => d.value > 0) : []

  const inspectorData = stats?.por_inspector.slice(0, 8).map(i => ({
    name: i.inspector,
    Cantidad: i.cantidad,
    'Tasa Bien Ejec.': i.tasa_bien_ejecutado,
  })) || []

  const evolucionData = stats?.evolucion_mensual.map(m => ({
    mes: m.mes,
    Total: m.total,
    'Bien Ejecutados': m.bien_ejecutados,
  })) || []

  const comunaData = stats?.por_comuna?.slice(0, 10).map(c => ({
    name: c.comuna,
    value: c.cantidad,
  })) || []

  const totalBien = stats?.por_resultado?.['TRABAJO BIEN EJECUTADO'] || 0
  const totalMal = stats?.por_resultado?.['TRABAJO MAL EJECUTADO'] || 0
  const tasaBien = stats?.total ? Math.round((totalBien / stats.total) * 1000) / 10 : 0

  const getResultadoBadge = (resultado: string | null) => {
    if (!resultado) return <span className="text-gray-400">-</span>
    if (resultado.includes('BIEN')) return <Badge color="emerald">Bien Ejecutado</Badge>
    if (resultado.includes('MAL')) return <Badge color="rose">Mal Ejecutado</Badge>
    return <Badge color="gray">{resultado}</Badge>
  }

  const getEstadoBadge = (estado: string | null) => {
    if (!estado) return <span className="text-gray-400">-</span>
    if (estado.includes('NORMAL')) return <Badge color="emerald">{estado}</Badge>
    if (estado.includes('MAL') || estado.includes('CRUZADO')) return <Badge color="rose">{estado}</Badge>
    return <Badge color="gray">{estado}</Badge>
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
      {refreshing && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-white rounded-full shadow-lg px-4 py-2 flex items-center gap-2 border">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-oca-blue border-t-transparent"></div>
          <span className="text-sm text-gray-600">Actualizando datos...</span>
        </div>
      )}
      <Header
        title="Medidores Cruzados"
        subtitle="Inspecciones de medidores cruzados - Nuevas Conexiones"
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
              <div className="flex items-center gap-3 mr-4 pr-4 border-r-2 border-gray-300 bg-white rounded-l-lg py-2 pl-4">
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
              <div className="w-40">
                <Select value={globalZona} onValueChange={setGlobalZona} placeholder="Zona">
                  <SelectItem value="">Todas las zonas</SelectItem>
                  {zonas.map(z => (
                    <SelectItem key={z} value={z}>{z}</SelectItem>
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
              <div className="w-48">
                <Select value={globalEstadoMedidor} onValueChange={setGlobalEstadoMedidor} placeholder="Estado Medidor">
                  <SelectItem value="">Todos los estados</SelectItem>
                  {estadosMedidor.map(e => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </Select>
              </div>
              {(globalZona || globalComuna || globalEstadoMedidor || globalMes || globalAnio) && (
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
                  <strong>{formatNumber(stats.total)}</strong> registros
                </span>
              )}
            </div>
          </Flex>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{formatNumber(stats?.total || 0)}</p>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Bien Ejecutados</p>
            <p className="text-2xl font-semibold text-emerald-600 mt-1">{formatNumber(totalBien)}</p>
            <p className="text-xs text-gray-400 mt-1">{tasaBien}%</p>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Mal Ejecutados</p>
            <p className="text-2xl font-semibold text-red-600 mt-1">{formatNumber(totalMal)}</p>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Zonas</p>
            <p className="text-2xl font-semibold text-blue-600 mt-1">{Object.keys(stats?.por_zona || {}).length}</p>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Comunas</p>
            <p className="text-2xl font-semibold text-violet-600 mt-1">{stats?.por_comuna?.length || 0}</p>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Inspectores</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{stats?.por_inspector?.length || 0}</p>
          </div>
        </div>

        {/* Tabs */}
        <TabGroup>
          <TabList className="mb-4">
            <Tab icon={GitCompare}>Resumen Ejecutivo</Tab>
            <Tab icon={MapPin}>Distribucion</Tab>
            <Tab icon={TrendingUp}>Tendencias</Tab>
            <Tab icon={Search}>Datos</Tab>
          </TabList>
          <TabPanels>
            {/* Resumen Ejecutivo Panel */}
            <TabPanel>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                {/* Resultado Inspeccion */}
                <Card>
                  <Title>Resultado de Inspecciones</Title>
                  <Text className="text-gray-500">Bien vs Mal ejecutados</Text>
                  <div className="mt-4">
                    <DonutChart
                      className="h-32"
                      data={resultadoData}
                      category="value"
                      index="name"
                      colors={['emerald', 'rose', 'amber', 'gray']}
                      valueFormatter={(v) => formatNumber(v)}
                      showAnimation
                    />
                  </div>
                  <div className="mt-3 space-y-1.5">
                    {resultadoData.map(r => (
                      <Flex key={r.name} justifyContent="between">
                        <span className="text-sm flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${r.name.includes('BIEN') ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                          {r.name}
                        </span>
                        <span className="text-sm font-semibold">{formatNumber(r.value)}</span>
                      </Flex>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t">
                    <Flex justifyContent="between" alignItems="center">
                      <div>
                        <p className="text-2xl font-bold text-oca-blue">{tasaBien}%</p>
                        <p className="text-xs text-gray-500">Tasa Bien Ejecutado</p>
                      </div>
                    </Flex>
                  </div>
                </Card>

                {/* Por Zona */}
                <Card>
                  <Title>Por Zona</Title>
                  <DonutChart
                    className="mt-4 h-32"
                    data={zonaData}
                    category="value"
                    index="name"
                    colors={['blue', 'cyan', 'indigo', 'slate']}
                    valueFormatter={(v) => formatNumber(v)}
                    showAnimation
                  />
                  <div className="mt-3 space-y-1">
                    {zonaData.map(z => (
                      <Flex key={z.name} justifyContent="between">
                        <Text className="text-xs">{z.name}</Text>
                        <Text className="text-xs font-medium">{formatNumber(z.value)}</Text>
                      </Flex>
                    ))}
                  </div>
                </Card>

                {/* Estado Medidor */}
                <Card>
                  <Title>Estado Medidor</Title>
                  <Text className="text-gray-500">Top 8 estados</Text>
                  <BarChart
                    className="mt-4 h-48"
                    data={estadoMedidorData}
                    index="name"
                    categories={['value']}
                    colors={['amber']}
                    valueFormatter={(v) => formatNumber(v)}
                    layout="vertical"
                    yAxisWidth={160}
                    showAnimation
                  />
                </Card>
              </div>

              {/* Tabla detalle por inspector */}
              <Card>
                <Title>Detalle por Inspector</Title>
                <Table className="mt-4">
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Inspector</TableHeaderCell>
                      <TableHeaderCell className="text-right">Cantidad</TableHeaderCell>
                      <TableHeaderCell className="text-right">Tasa Bien Ejec.</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stats?.por_inspector.map((i) => (
                      <TableRow key={i.inspector}>
                        <TableCell className="font-medium">{i.inspector}</TableCell>
                        <TableCell className="text-right">{formatNumber(i.cantidad)}</TableCell>
                        <TableCell className="text-right">
                          <span className={i.tasa_bien_ejecutado >= 80 ? 'text-emerald-600' : i.tasa_bien_ejecutado >= 60 ? 'text-amber-600' : 'text-rose-600'}>
                            {i.tasa_bien_ejecutado}%
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabPanel>

            {/* Distribucion Panel */}
            <TabPanel>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Top Comunas */}
                <Card>
                  <Title>Top Comunas</Title>
                  <Text className="text-gray-500">Comunas con mas inspecciones</Text>
                  <BarChart
                    className="mt-4 h-72"
                    data={comunaData}
                    index="name"
                    categories={['value']}
                    colors={['violet']}
                    valueFormatter={(v) => formatNumber(v)}
                    layout="vertical"
                    yAxisWidth={100}
                    showAnimation
                  />
                </Card>

                {/* Por Inspector */}
                <Card>
                  <Title>Por Inspector</Title>
                  <Text className="text-gray-500">Top 8 inspectores</Text>
                  <BarChart
                    className="mt-4 h-72"
                    data={inspectorData}
                    index="name"
                    categories={['Cantidad']}
                    colors={['blue']}
                    valueFormatter={(v) => formatNumber(v)}
                    showAnimation
                  />
                </Card>
              </div>

              {/* Por Zona detallado */}
              <Card>
                <Title>Distribucion por Zona</Title>
                <Text className="text-gray-500">Cantidad de inspecciones por zona</Text>
                <BarChart
                  className="mt-4 h-64"
                  data={zonaData.map(z => ({ name: z.name, Inspecciones: z.value }))}
                  index="name"
                  categories={['Inspecciones']}
                  colors={['cyan']}
                  valueFormatter={(v) => formatNumber(v)}
                  showAnimation
                />
              </Card>
            </TabPanel>

            {/* Tendencias Panel */}
            <TabPanel>
              {/* Evolucion Mensual */}
              <Card className="mb-6">
                <Title className="flex items-center gap-2">
                  <TrendingUp size={20} className="text-blue-500" />
                  Evolucion Mensual
                </Title>
                <Text className="text-gray-500">Inspecciones por mes</Text>
                <AreaChart
                  className="mt-4 h-64"
                  data={evolucionData}
                  index="mes"
                  categories={['Total', 'Bien Ejecutados']}
                  colors={['blue', 'emerald']}
                  valueFormatter={(v) => formatNumber(v)}
                  showAnimation
                />
              </Card>

              {/* Rendimiento por Inspector */}
              <Card>
                <Title className="flex items-center gap-2">
                  <Users size={20} className="text-blue-500" />
                  Rendimiento por Inspector
                </Title>
                <Text className="text-gray-500">Tasa de bien ejecutado por inspector</Text>
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {stats?.por_inspector.slice(0, 9).map(i => (
                    <div key={i.inspector} className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm font-semibold text-gray-800 mb-2 truncate">{i.inspector}</p>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-500">{formatNumber(i.cantidad)} insp.</span>
                        <span className={`text-lg font-bold ${i.tasa_bien_ejecutado >= 80 ? 'text-emerald-600' : i.tasa_bien_ejecutado >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>
                          {i.tasa_bien_ejecutado}%
                        </span>
                      </div>
                      <ProgressBar
                        value={i.tasa_bien_ejecutado}
                        color={i.tasa_bien_ejecutado >= 80 ? 'emerald' : i.tasa_bien_ejecutado >= 60 ? 'amber' : 'rose'}
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
                        placeholder="Buscar cliente, direccion..."
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setPage(1) }}
                      />
                    </div>
                    <div className="w-48">
                      <Select value={tableResultado} onValueChange={(v) => { setTableResultado(v); setPage(1) }} placeholder="Resultado">
                        <SelectItem value="">Todos</SelectItem>
                        <SelectItem value="TRABAJO BIEN EJECUTADO">Bien Ejecutado</SelectItem>
                        <SelectItem value="TRABAJO MAL EJECUTADO">Mal Ejecutado</SelectItem>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={clearTableFilters}>
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

              {/* Data Table */}
              <Card>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Mes</TableHeaderCell>
                      <TableHeaderCell>Fecha Insp.</TableHeaderCell>
                      <TableHeaderCell>Num Cliente</TableHeaderCell>
                      <TableHeaderCell>Direccion</TableHeaderCell>
                      <TableHeaderCell>Comuna</TableHeaderCell>
                      <TableHeaderCell>Zona</TableHeaderCell>
                      <TableHeaderCell>Inspector</TableHeaderCell>
                      <TableHeaderCell>Estado Medidor</TableHeaderCell>
                      <TableHeaderCell>Resultado</TableHeaderCell>
                      <TableHeaderCell>EEPP OCA</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data?.items.map((item, idx) => (
                      <TableRow key={item.id || idx}>
                        <TableCell>{item.mes || '-'}</TableCell>
                        <TableCell>{item.fecha_inspeccion || '-'}</TableCell>
                        <TableCell className="font-medium">{item.num_cliente || '-'}</TableCell>
                        <TableCell className="text-gray-500 truncate max-w-[200px]">{item.direccion || '-'}</TableCell>
                        <TableCell>{item.comuna || '-'}</TableCell>
                        <TableCell>
                          {item.zona ? <Badge color="blue">{item.zona}</Badge> : '-'}
                        </TableCell>
                        <TableCell className="text-gray-500 truncate max-w-[120px]">{item.inspector || '-'}</TableCell>
                        <TableCell>{getEstadoBadge(item.estado_medidor)}</TableCell>
                        <TableCell>{getResultadoBadge(item.resultado_inspeccion)}</TableCell>
                        <TableCell className="text-gray-500">{item.eepp_oca || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
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
