'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import {
  Card,
  Title,
  Text,
  Flex,
  BarChart,
  DonutChart,
  AreaChart,
  ProgressBar,
} from '@tremor/react'
import {
  ClipboardCheck,
  FileText,
  Scissors,
  SearchX,
  TrendingUp,
  TrendingDown,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  BarChart3,
  ArrowRight,
  Radio,
} from 'lucide-react'
import { formatNumber } from '@/lib/utils'
import { api } from '@/lib/api'

interface DashboardSummary {
  nncc: {
    total: number
    efectivas: number
    no_efectivas: number
    tasa_efectividad: number
    bien_ejecutados: number
    mal_ejecutados: number
    con_multa: number
    monto_estimado: number
    por_zona: Record<string, number>
    por_mes: Array<{ mes: string; cantidad: number; efectividad: number }>
    comparativas: {
      efectividad: { actual: number; anterior: number; diferencia: number }
    }
    ultima_actualizacion: string | null
    activo: boolean
  }
  lecturas: {
    total: number
    inspeccionadas: number
    pendientes: number
    tasa_inspeccion: number
    en_plazo: number
    fuera_plazo: number
    tasa_cumplimiento_plazo: number
    dias_respuesta_promedio: number
    por_origen: Record<string, number>
    por_hallazgo: Array<{ hallazgo: string; cantidad: number }>
    comparativas: {
      inspeccion: { actual: number; anterior: number; diferencia: number }
      cumplimiento_plazo: { actual: number; anterior: number; diferencia: number }
    }
    ultima_actualizacion: string | null
    activo: boolean
  }
  teleco: {
    total: number
    aprobados: number
    rechazados: number
    tasa_aprobacion: number
    total_postes: number
    por_empresa: Array<{ empresa: string; cantidad: number; aprobados: number; tasa_aprobacion: number; postes: number }>
    comparativas: {
      aprobacion: { actual: number; anterior: number; diferencia: number }
    }
    ultima_actualizacion: string | null
    activo: boolean
  }
  corte_reposicion: {
    total: number
    ultima_actualizacion: string | null
    activo: boolean
  }
  control_perdidas: {
    total: number
    ultima_actualizacion: string | null
    activo: boolean
  }
  resumen_general: {
    total_registros: number
    modulos_activos: number
    modulos_pendientes: number
  }
}

const META_EFECTIVIDAD = 95
const META_CUMPLIMIENTO = 90
const META_APROBACION = 50

export default function DashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const response = await api.get<DashboardSummary>('/api/v1/dashboard/summary')
      setData(response)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const formatCLP = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(value)
  }

  // Chart data
  const nnccZonaData = data ? Object.entries(data.nncc.por_zona).map(([name, value]) => ({
    name,
    value: value as number
  })) : []

  const nnccMensualData = data?.nncc.por_mes.slice(-6).map(m => ({
    mes: m.mes,
    Cantidad: m.cantidad,
    Efectividad: m.efectividad
  })) || []

  const lecturasOrigenData = data ? Object.entries(data.lecturas.por_origen).map(([name, value]) => ({
    name,
    value: value as number
  })) : []

  const lecturasHallazgoData = data?.lecturas.por_hallazgo.slice(0, 5).map(h => ({
    name: h.hallazgo,
    value: h.cantidad
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
      <Header
        title="Dashboard"
        subtitle="Vista general de todos los servicios"
      />

      <div className="p-6">
        {/* Resumen General */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Registros</p>
            <p className="text-3xl font-semibold text-gray-900 mt-1">{formatNumber(data?.resumen_general.total_registros || 0)}</p>
            <p className="text-xs text-gray-400 mt-1">En todos los modulos</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Modulos Activos</p>
            <p className="text-3xl font-semibold text-emerald-600 mt-1">{data?.resumen_general.modulos_activos || 0}</p>
            <p className="text-xs text-gray-400 mt-1">de 4 modulos</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">NNCC Efectividad</p>
            <p className={`text-3xl font-semibold mt-1 ${data && data.nncc.tasa_efectividad >= META_EFECTIVIDAD ? 'text-emerald-600' : 'text-amber-600'}`}>
              {data?.nncc.tasa_efectividad || 0}%
            </p>
            <p className="text-xs text-gray-400 mt-1">Meta: {META_EFECTIVIDAD}%</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Lecturas En Plazo</p>
            <p className={`text-3xl font-semibold mt-1 ${data && data.lecturas.tasa_cumplimiento_plazo >= META_CUMPLIMIENTO ? 'text-emerald-600' : 'text-amber-600'}`}>
              {data?.lecturas.tasa_cumplimiento_plazo || 0}%
            </p>
            <p className="text-xs text-gray-400 mt-1">Meta: {META_CUMPLIMIENTO}%</p>
          </div>
        </div>

        {/* Tarjetas de Modulos */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {/* NNCC Card */}
          <Card
            className="cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]"
            decoration="top"
            decorationColor="blue"
            onClick={() => router.push('/dashboard/nuevas-conexiones')}
          >
            <Flex alignItems="start" justifyContent="between">
              <div>
                <Text className="text-gray-500">Informe NNCC</Text>
                <p className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(data?.nncc.total || 0)}</p>
              </div>
              <div className="rounded-lg p-2 bg-blue-100 text-blue-600">
                <ClipboardCheck size={24} />
              </div>
            </Flex>
            <div className="mt-4 space-y-2">
              <Flex justifyContent="between">
                <span className="text-xs text-gray-500">Efectivas</span>
                <span className="text-xs font-medium text-emerald-600">{formatNumber(data?.nncc.efectivas || 0)}</span>
              </Flex>
              <Flex justifyContent="between">
                <span className="text-xs text-gray-500">No Efectivas</span>
                <span className="text-xs font-medium text-red-600">{formatNumber(data?.nncc.no_efectivas || 0)}</span>
              </Flex>
            </div>
            {data?.nncc.comparativas?.efectividad && data.nncc.comparativas.efectividad.diferencia !== 0 && (
              <Flex className="mt-3 pt-3 border-t" justifyContent="between" alignItems="center">
                <div className={`flex items-center gap-1 ${
                  data.nncc.comparativas.efectividad.diferencia > 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {data.nncc.comparativas.efectividad.diferencia > 0 ? (
                    <TrendingUp size={14} />
                  ) : (
                    <TrendingDown size={14} />
                  )}
                  <span className="text-xs font-medium">
                    {data.nncc.comparativas.efectividad.diferencia > 0 ? '+' : ''}
                    {data.nncc.comparativas.efectividad.diferencia}%
                  </span>
                </div>
                <span className="text-xs text-gray-400">vs anterior</span>
              </Flex>
            )}
            {data?.nncc.ultima_actualizacion && (
              <Flex className="mt-2" alignItems="center" justifyContent="end">
                <Calendar size={12} className="text-gray-400 mr-1" />
                <span className="text-[10px] text-gray-400">{data.nncc.ultima_actualizacion}</span>
              </Flex>
            )}
          </Card>

          {/* Lecturas Card */}
          <Card
            className="cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]"
            decoration="top"
            decorationColor="violet"
            onClick={() => router.push('/dashboard/lecturas')}
          >
            <Flex alignItems="start" justifyContent="between">
              <div>
                <Text className="text-gray-500">Lecturas</Text>
                <p className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(data?.lecturas.total || 0)}</p>
              </div>
              <div className="rounded-lg p-2 bg-violet-100 text-violet-600">
                <FileText size={24} />
              </div>
            </Flex>
            <div className="mt-4 space-y-2">
              <Flex justifyContent="between">
                <span className="text-xs text-gray-500">Inspeccionadas</span>
                <span className="text-xs font-medium text-emerald-600">{formatNumber(data?.lecturas.inspeccionadas || 0)}</span>
              </Flex>
              <Flex justifyContent="between">
                <span className="text-xs text-gray-500">Pendientes</span>
                <span className="text-xs font-medium text-amber-600">{formatNumber(data?.lecturas.pendientes || 0)}</span>
              </Flex>
            </div>
            {data?.lecturas.comparativas?.cumplimiento_plazo && data.lecturas.comparativas.cumplimiento_plazo.diferencia !== 0 && (
              <Flex className="mt-3 pt-3 border-t" justifyContent="between" alignItems="center">
                <div className={`flex items-center gap-1 ${
                  data.lecturas.comparativas.cumplimiento_plazo.diferencia > 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {data.lecturas.comparativas.cumplimiento_plazo.diferencia > 0 ? (
                    <TrendingUp size={14} />
                  ) : (
                    <TrendingDown size={14} />
                  )}
                  <span className="text-xs font-medium">
                    {data.lecturas.comparativas.cumplimiento_plazo.diferencia > 0 ? '+' : ''}
                    {data.lecturas.comparativas.cumplimiento_plazo.diferencia}%
                  </span>
                </div>
                <span className="text-xs text-gray-400">vs anterior</span>
              </Flex>
            )}
            {data?.lecturas.ultima_actualizacion && (
              <Flex className="mt-2" alignItems="center" justifyContent="end">
                <Calendar size={12} className="text-gray-400 mr-1" />
                <span className="text-[10px] text-gray-400">{data.lecturas.ultima_actualizacion}</span>
              </Flex>
            )}
          </Card>

          {/* Teleco Card */}
          <Card
            className="cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]"
            decoration="top"
            decorationColor="amber"
            onClick={() => router.push('/dashboard/telecomunicaciones')}
          >
            <Flex alignItems="start" justifyContent="between">
              <div>
                <Text className="text-gray-500">Telecom</Text>
                <p className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(data?.teleco.total || 0)}</p>
              </div>
              <div className="rounded-lg p-2 bg-amber-100 text-amber-600">
                <Radio size={24} />
              </div>
            </Flex>
            <div className="mt-4 space-y-2">
              <Flex justifyContent="between">
                <span className="text-xs text-gray-500">Aprobados</span>
                <span className="text-xs font-medium text-emerald-600">{formatNumber(data?.teleco.aprobados || 0)}</span>
              </Flex>
              <Flex justifyContent="between">
                <span className="text-xs text-gray-500">Rechazados</span>
                <span className="text-xs font-medium text-red-600">{formatNumber(data?.teleco.rechazados || 0)}</span>
              </Flex>
            </div>
            {data?.teleco.comparativas?.aprobacion && data.teleco.comparativas.aprobacion.diferencia !== 0 && (
              <Flex className="mt-3 pt-3 border-t" justifyContent="between" alignItems="center">
                <div className={`flex items-center gap-1 ${
                  data.teleco.comparativas.aprobacion.diferencia > 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {data.teleco.comparativas.aprobacion.diferencia > 0 ? (
                    <TrendingUp size={14} />
                  ) : (
                    <TrendingDown size={14} />
                  )}
                  <span className="text-xs font-medium">
                    {data.teleco.comparativas.aprobacion.diferencia > 0 ? '+' : ''}
                    {data.teleco.comparativas.aprobacion.diferencia}%
                  </span>
                </div>
                <span className="text-xs text-gray-400">vs anterior</span>
              </Flex>
            )}
            {data?.teleco.ultima_actualizacion && (
              <Flex className="mt-2" alignItems="center" justifyContent="end">
                <Calendar size={12} className="text-gray-400 mr-1" />
                <span className="text-[10px] text-gray-400">{data.teleco.ultima_actualizacion}</span>
              </Flex>
            )}
          </Card>

          {/* Corte y Reposicion Card */}
          <Card
            className="opacity-60"
            decoration="top"
            decorationColor="gray"
          >
            <Flex alignItems="start" justifyContent="between">
              <div>
                <Text className="text-gray-500">Corte y Reposicion</Text>
                <p className="text-2xl font-bold text-gray-400 mt-1">-</p>
              </div>
              <div className="rounded-lg p-2 bg-gray-100 text-gray-400">
                <Scissors size={24} />
              </div>
            </Flex>
            <div className="mt-4">
              <Text className="text-gray-400 text-sm">Proximamente</Text>
            </div>
          </Card>

          {/* Control Perdidas Card */}
          <Card
            className="opacity-60"
            decoration="top"
            decorationColor="gray"
          >
            <Flex alignItems="start" justifyContent="between">
              <div>
                <Text className="text-gray-500">Control Perdidas</Text>
                <p className="text-2xl font-bold text-gray-400 mt-1">-</p>
              </div>
              <div className="rounded-lg p-2 bg-gray-100 text-gray-400">
                <SearchX size={24} />
              </div>
            </Flex>
            <div className="mt-4">
              <Text className="text-gray-400 text-sm">Proximamente</Text>
            </div>
          </Card>
        </div>

        {/* NNCC Section */}
        <div className="mb-6">
          <Flex className="mb-4" alignItems="center" justifyContent="between">
            <div className="flex items-center gap-2">
              <ClipboardCheck size={20} className="text-blue-600" />
              <Title>Informe NNCC</Title>
            </div>
            <button
              onClick={() => router.push('/dashboard/nuevas-conexiones')}
              className="text-sm text-oca-blue hover:text-oca-blue-dark flex items-center gap-1"
            >
              Ver detalle <ArrowRight size={14} />
            </button>
          </Flex>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* NNCC KPIs */}
            <Card>
              <Title>Resumen NNCC</Title>
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-emerald-50 rounded-lg">
                    <CheckCircle size={20} className="text-emerald-500 mx-auto mb-1" />
                    <p className="text-xl font-bold text-emerald-600">{formatNumber(data?.nncc.efectivas || 0)}</p>
                    <p className="text-xs text-gray-600">Efectivas</p>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded-lg">
                    <XCircle size={20} className="text-red-500 mx-auto mb-1" />
                    <p className="text-xl font-bold text-red-600">{formatNumber(data?.nncc.no_efectivas || 0)}</p>
                    <p className="text-xs text-gray-600">No Efectivas</p>
                  </div>
                </div>
                <div>
                  <Flex justifyContent="between" className="mb-1">
                    <Text className="text-sm">Efectividad</Text>
                    <Text className="text-sm font-medium">{data?.nncc.tasa_efectividad || 0}%</Text>
                  </Flex>
                  <ProgressBar
                    value={data?.nncc.tasa_efectividad || 0}
                    color={data && data.nncc.tasa_efectividad >= META_EFECTIVIDAD ? 'emerald' : 'amber'}
                  />
                </div>
                <div className="pt-3 border-t">
                  <Flex justifyContent="between">
                    <Text className="text-sm text-gray-500">Con Multa</Text>
                    <Text className="text-sm font-medium text-red-600">{formatNumber(data?.nncc.con_multa || 0)}</Text>
                  </Flex>
                  <Flex justifyContent="between" className="mt-1">
                    <Text className="text-sm text-gray-500">Monto Estimado</Text>
                    <Text className="text-sm font-medium">{formatCLP(data?.nncc.monto_estimado || 0)}</Text>
                  </Flex>
                </div>
              </div>
            </Card>

            {/* NNCC Tendencia */}
            <Card>
              <Title>Tendencia Mensual</Title>
              <Text className="text-gray-500">Ultimos 6 meses</Text>
              <AreaChart
                className="mt-4 h-44"
                data={nnccMensualData}
                index="mes"
                categories={['Cantidad']}
                colors={['blue']}
                valueFormatter={(v) => formatNumber(v)}
                showAnimation
              />
            </Card>

            {/* NNCC Por Zona */}
            <Card>
              <Title>Por Zona</Title>
              <DonutChart
                className="mt-4 h-32"
                data={nnccZonaData}
                category="value"
                index="name"
                colors={['blue', 'cyan', 'indigo', 'slate']}
                valueFormatter={(v) => formatNumber(v)}
                showAnimation
              />
              <div className="mt-3 space-y-1">
                {nnccZonaData.slice(0, 4).map(z => (
                  <Flex key={z.name} justifyContent="between">
                    <Text className="text-xs">{z.name}</Text>
                    <Text className="text-xs font-medium">{formatNumber(z.value)}</Text>
                  </Flex>
                ))}
              </div>
            </Card>
          </div>
        </div>

        {/* Lecturas Section */}
        <div className="mb-6">
          <Flex className="mb-4" alignItems="center" justifyContent="between">
            <div className="flex items-center gap-2">
              <FileText size={20} className="text-violet-600" />
              <Title>Lecturas</Title>
            </div>
            <button
              onClick={() => router.push('/dashboard/lecturas')}
              className="text-sm text-oca-blue hover:text-oca-blue-dark flex items-center gap-1"
            >
              Ver detalle <ArrowRight size={14} />
            </button>
          </Flex>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Lecturas KPIs */}
            <Card>
              <Title>Resumen Lecturas</Title>
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-emerald-50 rounded-lg">
                    <CheckCircle size={20} className="text-emerald-500 mx-auto mb-1" />
                    <p className="text-xl font-bold text-emerald-600">{formatNumber(data?.lecturas.inspeccionadas || 0)}</p>
                    <p className="text-xs text-gray-600">Inspeccionadas</p>
                  </div>
                  <div className="text-center p-3 bg-amber-50 rounded-lg">
                    <Clock size={20} className="text-amber-500 mx-auto mb-1" />
                    <p className="text-xl font-bold text-amber-600">{formatNumber(data?.lecturas.pendientes || 0)}</p>
                    <p className="text-xs text-gray-600">Pendientes</p>
                  </div>
                </div>
                <div>
                  <Flex justifyContent="between" className="mb-1">
                    <Text className="text-sm">Cumplimiento Plazo</Text>
                    <Text className="text-sm font-medium">{data?.lecturas.tasa_cumplimiento_plazo || 0}%</Text>
                  </Flex>
                  <ProgressBar
                    value={data?.lecturas.tasa_cumplimiento_plazo || 0}
                    color={data && data.lecturas.tasa_cumplimiento_plazo >= META_CUMPLIMIENTO ? 'emerald' : 'amber'}
                  />
                </div>
                <div className="pt-3 border-t">
                  <Flex justifyContent="between">
                    <Text className="text-sm text-gray-500">En Plazo</Text>
                    <Text className="text-sm font-medium text-emerald-600">{formatNumber(data?.lecturas.en_plazo || 0)}</Text>
                  </Flex>
                  <Flex justifyContent="between" className="mt-1">
                    <Text className="text-sm text-gray-500">Fuera de Plazo</Text>
                    <Text className="text-sm font-medium text-red-600">{formatNumber(data?.lecturas.fuera_plazo || 0)}</Text>
                  </Flex>
                  <Flex justifyContent="between" className="mt-1">
                    <Text className="text-sm text-gray-500">Dias Resp. Prom.</Text>
                    <Text className="text-sm font-medium">{data?.lecturas.dias_respuesta_promedio || 0} dias</Text>
                  </Flex>
                </div>
              </div>
            </Card>

            {/* Lecturas Por Origen */}
            <Card>
              <Title>Por Origen</Title>
              <DonutChart
                className="mt-4 h-32"
                data={lecturasOrigenData}
                category="value"
                index="name"
                colors={['blue', 'amber', 'violet']}
                valueFormatter={(v) => formatNumber(v)}
                showAnimation
              />
              <div className="mt-3 space-y-1">
                {lecturasOrigenData.map(o => (
                  <Flex key={o.name} justifyContent="between">
                    <Text className="text-xs">{o.name}</Text>
                    <Text className="text-xs font-medium">{formatNumber(o.value)}</Text>
                  </Flex>
                ))}
              </div>
            </Card>

            {/* Lecturas Top Hallazgos */}
            <Card>
              <Title>Top Hallazgos</Title>
              <Text className="text-gray-500">5 mas frecuentes</Text>
              <BarChart
                className="mt-4 h-40"
                data={lecturasHallazgoData}
                index="name"
                categories={['value']}
                colors={['violet']}
                valueFormatter={(v) => formatNumber(v)}
                layout="vertical"
                yAxisWidth={140}
                showAnimation
              />
            </Card>
          </div>
        </div>

        {/* Teleco Section */}
        <div className="mb-6">
          <Flex className="mb-4" alignItems="center" justifyContent="between">
            <div className="flex items-center gap-2">
              <Radio size={20} className="text-amber-600" />
              <Title>Telecomunicaciones</Title>
            </div>
            <button
              onClick={() => router.push('/dashboard/telecomunicaciones')}
              className="text-sm text-oca-blue hover:text-oca-blue-dark flex items-center gap-1"
            >
              Ver detalle <ArrowRight size={14} />
            </button>
          </Flex>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Teleco KPIs */}
            <Card>
              <Title>Resumen Teleco</Title>
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-emerald-50 rounded-lg">
                    <CheckCircle size={20} className="text-emerald-500 mx-auto mb-1" />
                    <p className="text-xl font-bold text-emerald-600">{formatNumber(data?.teleco.aprobados || 0)}</p>
                    <p className="text-xs text-gray-600">Aprobados</p>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded-lg">
                    <XCircle size={20} className="text-red-500 mx-auto mb-1" />
                    <p className="text-xl font-bold text-red-600">{formatNumber(data?.teleco.rechazados || 0)}</p>
                    <p className="text-xs text-gray-600">Rechazados</p>
                  </div>
                </div>
                <div>
                  <Flex justifyContent="between" className="mb-1">
                    <Text className="text-sm">Tasa Aprobacion</Text>
                    <Text className="text-sm font-medium">{data?.teleco.tasa_aprobacion || 0}%</Text>
                  </Flex>
                  <ProgressBar
                    value={data?.teleco.tasa_aprobacion || 0}
                    color={data && data.teleco.tasa_aprobacion >= META_APROBACION ? 'emerald' : 'amber'}
                  />
                </div>
                <div className="pt-3 border-t">
                  <Flex justifyContent="between">
                    <Text className="text-sm text-gray-500">Total Postes</Text>
                    <Text className="text-sm font-medium text-blue-600">{formatNumber(data?.teleco.total_postes || 0)}</Text>
                  </Flex>
                </div>
              </div>
            </Card>

            {/* Teleco Por Empresa */}
            <Card className="lg:col-span-2">
              <Title>Por Empresa</Title>
              <Text className="text-gray-500">Principales solicitantes</Text>
              <BarChart
                className="mt-4 h-40"
                data={data?.teleco.por_empresa.slice(0, 5).map(e => ({
                  name: e.empresa,
                  Casos: e.cantidad,
                  Aprobados: e.aprobados
                })) || []}
                index="name"
                categories={['Casos', 'Aprobados']}
                colors={['amber', 'emerald']}
                valueFormatter={(v) => formatNumber(v)}
                showAnimation
              />
            </Card>
          </div>
        </div>

        {/* Estado de Modulos */}
        <Card>
          <Title>Estado de Modulos</Title>
          <Text className="text-gray-500">Progreso de integracion de datos</Text>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
              <Flex justifyContent="between" alignItems="center">
                <div className="flex items-center gap-2">
                  <ClipboardCheck size={18} className="text-emerald-600" />
                  <Text className="font-medium">Informe NNCC</Text>
                </div>
                <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded">Activo</span>
              </Flex>
              <Text className="text-sm text-gray-500 mt-2">{formatNumber(data?.nncc.total || 0)} registros</Text>
              {data?.nncc.ultima_actualizacion && (
                <Text className="text-xs text-gray-400 mt-1">Actualizado: {data.nncc.ultima_actualizacion}</Text>
              )}
            </div>

            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
              <Flex justifyContent="between" alignItems="center">
                <div className="flex items-center gap-2">
                  <FileText size={18} className="text-emerald-600" />
                  <Text className="font-medium">Lecturas</Text>
                </div>
                <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded">Activo</span>
              </Flex>
              <Text className="text-sm text-gray-500 mt-2">{formatNumber(data?.lecturas.total || 0)} registros</Text>
              {data?.lecturas.ultima_actualizacion && (
                <Text className="text-xs text-gray-400 mt-1">Actualizado: {data.lecturas.ultima_actualizacion}</Text>
              )}
            </div>

            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
              <Flex justifyContent="between" alignItems="center">
                <div className="flex items-center gap-2">
                  <Radio size={18} className="text-emerald-600" />
                  <Text className="font-medium">Telecomunicaciones</Text>
                </div>
                <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded">Activo</span>
              </Flex>
              <Text className="text-sm text-gray-500 mt-2">{formatNumber(data?.teleco.total || 0)} casos / {formatNumber(data?.teleco.total_postes || 0)} postes</Text>
              {data?.teleco.ultima_actualizacion && (
                <Text className="text-xs text-gray-400 mt-1">Actualizado: {data.teleco.ultima_actualizacion}</Text>
              )}
            </div>

            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <Flex justifyContent="between" alignItems="center">
                <div className="flex items-center gap-2">
                  <Scissors size={18} className="text-gray-400" />
                  <Text className="font-medium text-gray-500">Corte y Reposicion</Text>
                </div>
                <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs font-medium rounded">Pendiente</span>
              </Flex>
              <Text className="text-sm text-gray-400 mt-2">Sin datos</Text>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <Flex justifyContent="between" alignItems="center">
                <div className="flex items-center gap-2">
                  <SearchX size={18} className="text-gray-400" />
                  <Text className="font-medium text-gray-500">Control Perdidas</Text>
                </div>
                <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs font-medium rounded">Pendiente</span>
              </Flex>
              <Text className="text-sm text-gray-400 mt-2">Sin datos</Text>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
