'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Header } from '@/components/layout/Header'
import { EChart } from '@/components/ui/EChart'
import { HeroKpi, KpiCard, ProgressKpi } from './nuevas-conexiones/components/KpiCard'
import {
  CHART_COLORS,
  TOOLTIP_STYLE,
  GRID_STYLE,
  AXIS_STYLE,
  CATEGORY_AXIS,
  BAR_RADIUS,
  BAR_RADIUS_H,
} from './nuevas-conexiones/chart-theme'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { formatNumber } from '@/lib/utils'
import { api } from '@/lib/api'

/* ── types ─────────────────────────────────────────────── */

interface DashboardSummary {
  nncc: {
    total: number
    efectivas: number
    no_efectivas: number
    tasa_efectividad: number
    bien_ejecutados: number
    mal_ejecutados: number
    con_multa: number
    por_zona: Record<string, number>
    por_mes: Array<{ mes: string; cantidad: number; efectividad: number }>
    comparativas: {
      efectividad: { actual: number; anterior: number; diferencia: number }
    }
    ultima_actualizacion: string | null
    activo: boolean
  }
  medidores_cruzados: {
    total: number
    por_zona: Record<string, number>
    por_resultado: Record<string, number>
    por_estado_medidor: Record<string, number>
    por_inspector: Array<{ inspector: string; cantidad: number; tasa_bien_ejecutado: number }>
    evolucion_mensual: Array<{ mes: string; total: number; bien_ejecutados: number }>
    ultima_actualizacion: string | null
    activo: boolean
  }
  resumen_general: {
    total_registros: number
    modulos_activos: number
    modulos_pendientes: number
  }
  // Módulos desactivados — mantenemos la interfaz por compatibilidad con backend
  lecturas: Record<string, unknown>
  teleco: Record<string, unknown>
  corte_reposicion: Record<string, unknown>
  control_perdidas: Record<string, unknown>
}

/* ── helpers ───────────────────────────────────────────── */

const pct = (v: number) => `${v.toFixed(1)}%`

function ChartCard({ children, title, sub, className = '' }: { children: React.ReactNode; title?: string; sub?: string; className?: string }) {
  return (
    <div className={`bg-white rounded-lg border border-slate-200/60 shadow-sm px-4 py-3 ${className}`}>
      {title && (
        <div className="mb-2">
          <h3 className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">{title}</h3>
          {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
        </div>
      )}
      {children}
    </div>
  )
}

/* ── page ──────────────────────────────────────────────── */

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

  /* ── chart options ─────────────────── */

  const tendenciaOption = useMemo(() => {
    if (!data) return {}
    const meses = data.nncc.por_mes.slice(-6)
    return {
      tooltip: { ...TOOLTIP_STYLE, trigger: 'axis' as const },
      grid: { ...GRID_STYLE, bottom: 24 },
      xAxis: { type: 'category' as const, data: meses.map(m => m.mes), ...CATEGORY_AXIS },
      yAxis: [
        { type: 'value' as const, ...AXIS_STYLE, name: 'Cantidad', nameTextStyle: { fontSize: 10, color: '#94a3b8' } },
        { type: 'value' as const, ...AXIS_STYLE, name: 'Efect. %', nameTextStyle: { fontSize: 10, color: '#94a3b8' }, min: 0, max: 100, splitLine: { show: false } },
      ],
      series: [
        {
          type: 'bar' as const,
          name: 'Inspecciones',
          data: meses.map(m => m.cantidad),
          barMaxWidth: 24,
          itemStyle: { color: CHART_COLORS.primary, borderRadius: BAR_RADIUS },
          yAxisIndex: 0,
        },
        {
          type: 'line' as const,
          name: 'Efectividad',
          data: meses.map(m => m.efectividad),
          smooth: true,
          lineStyle: { color: CHART_COLORS.success, width: 2 },
          itemStyle: { color: CHART_COLORS.success },
          symbol: 'circle',
          symbolSize: 6,
          yAxisIndex: 1,
        },
      ],
    }
  }, [data])

  const zonaOption = useMemo(() => {
    if (!data) return {}
    const zonas = Object.entries(data.nncc.por_zona)
      .sort((a, b) => b[1] - a[1])
    return {
      tooltip: { ...TOOLTIP_STYLE, trigger: 'axis' as const },
      grid: { left: 8, right: 20, bottom: 8, top: 8, containLabel: true },
      xAxis: { type: 'value' as const, ...AXIS_STYLE },
      yAxis: { type: 'category' as const, data: zonas.map(z => z[0]), ...CATEGORY_AXIS, inverse: true },
      series: [{
        type: 'bar' as const,
        barMaxWidth: 18,
        data: zonas.map(z => ({
          value: z[1],
          itemStyle: { color: CHART_COLORS.primary, borderRadius: BAR_RADIUS_H },
        })),
        label: { show: true, position: 'right' as const, fontSize: 10, color: '#64748b', formatter: (p: { value: number }) => formatNumber(p.value) },
      }],
    }
  }, [data])

  const medCruzadosOption = useMemo(() => {
    if (!data?.medidores_cruzados?.activo) return {}
    const evo = data.medidores_cruzados.evolucion_mensual.slice(-6)
    if (!evo.length) return {}
    return {
      tooltip: { ...TOOLTIP_STYLE, trigger: 'axis' as const },
      grid: { ...GRID_STYLE, bottom: 24 },
      xAxis: { type: 'category' as const, data: evo.map(e => e.mes), ...CATEGORY_AXIS },
      yAxis: { type: 'value' as const, ...AXIS_STYLE },
      series: [
        {
          type: 'bar' as const,
          name: 'Total',
          data: evo.map(e => e.total),
          barMaxWidth: 20,
          itemStyle: { color: CHART_COLORS.muted, borderRadius: BAR_RADIUS },
        },
        {
          type: 'bar' as const,
          name: 'Bien Ejec.',
          data: evo.map(e => e.bien_ejecutados),
          barMaxWidth: 20,
          itemStyle: { color: CHART_COLORS.success, borderRadius: BAR_RADIUS },
        },
      ],
    }
  }, [data])

  /* ── derived values ────────────────── */

  const nncc = data?.nncc
  const mc = data?.medidores_cruzados
  const tasaMal = nncc && nncc.total > 0 ? (nncc.mal_ejecutados / nncc.total) * 100 : 0
  const tasaMulta = nncc && nncc.total > 0 ? (nncc.con_multa / nncc.total) * 100 : 0
  const mcBien = mc?.por_resultado?.['TRABAJO BIEN EJECUTADO'] || 0
  const mcMal = mc?.por_resultado?.['TRABAJO MAL EJECUTADO'] || 0
  const mcTasaBien = mc && mc.total > 0 ? (mcBien / mc.total) * 100 : 0

  /* ── render ────────────────────────── */

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-oca-blue border-t-transparent mx-auto" />
          <p className="mt-3 text-[11px] text-slate-400">Cargando dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Dashboard" subtitle="Panel de Control — Nuevas Conexiones" />

      <div className="p-5 space-y-4">

        {/* ── Branding strip ─────────────────────────── */}
        <div className="bg-white rounded-lg border border-slate-200/60 shadow-sm px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image src="/logo-enel.png" alt="Enel" width={90} height={33} className="h-7 w-auto opacity-90" />
            <div className="h-6 w-px bg-slate-200" />
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Fiscalización de Nuevas Conexiones</h2>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {nncc?.ultima_actualizacion ? `Última actualización: ${nncc.ultima_actualizacion}` : 'OCA Global — Calidad e Inspección'}
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push('/dashboard/nuevas-conexiones')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-oca-blue hover:bg-oca-blue-lighter rounded-md transition-colors"
          >
            Ir al Informe <ArrowUpRight size={13} />
          </button>
        </div>

        {/* ── KPI strip — NNCC ───────────────────────── */}
        <div className="bg-white rounded-lg border border-slate-200/60 shadow-sm grid grid-cols-2 lg:grid-cols-5 divide-x divide-slate-100">
          <HeroKpi
            label="Total Inspecciones"
            value={nncc?.total || 0}
            subtitle={nncc?.comparativas?.efectividad?.diferencia !== 0
              ? `${(nncc?.comparativas?.efectividad?.diferencia || 0) > 0 ? '+' : ''}${nncc?.comparativas?.efectividad?.diferencia || 0}% vs anterior`
              : undefined}
          />
          <ProgressKpi
            label="Efectividad"
            value={nncc?.tasa_efectividad || 0}
            displayValue={pct(nncc?.tasa_efectividad || 0)}
            thresholds={{ good: 95, warning: 85 }}
          />
          <KpiCard
            label="Mal Ejecutados"
            value={nncc?.mal_ejecutados || 0}
            subtitle={`Tasa: ${pct(tasaMal)}`}
            status={tasaMal > 15 ? 'bad' : 'neutral'}
          />
          <KpiCard
            label="Con Multa"
            value={nncc?.con_multa || 0}
            subtitle={`Tasa: ${pct(tasaMulta)}`}
            status={(nncc?.con_multa || 0) > 0 ? 'bad' : 'neutral'}
          />
          <KpiCard
            label="Bien Ejecutados"
            value={nncc?.bien_ejecutados || 0}
            status="good"
          />
        </div>

        {/* ── Charts row ─────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ChartCard title="Tendencia Mensual" sub="Inspecciones y efectividad — últimos 6 meses" className="lg:col-span-2">
            <EChart option={tendenciaOption} height="220px" />
          </ChartCard>

          <ChartCard title="Inspecciones por Zona">
            <EChart option={zonaOption} height="220px" />
          </ChartCard>
        </div>

        {/* ── Medidores Cruzados section ─────────────── */}
        {mc?.activo && (
          <>
            <div className="flex items-center justify-between pt-2">
              <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Medidores Cruzados</h3>
              <button
                onClick={() => router.push('/dashboard/nuevas-conexiones/medidores-cruzados')}
                className="flex items-center gap-1 text-[11px] text-oca-blue hover:text-oca-blue-dark transition-colors"
              >
                Ver detalle <ArrowRight size={12} />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* KPIs */}
              <div className="bg-white rounded-lg border border-slate-200/60 shadow-sm grid grid-cols-1 divide-y divide-slate-100">
                <HeroKpi
                  label="Total Hallazgos"
                  value={mc.total}
                  subtitle={mc.ultima_actualizacion ? `Actualizado: ${mc.ultima_actualizacion}` : undefined}
                />
                <div className="grid grid-cols-2 divide-x divide-slate-100">
                  <KpiCard label="Bien Ejec." value={mcBien} status="good" />
                  <KpiCard label="Mal Ejec." value={mcMal} status={mcMal > 0 ? 'bad' : 'neutral'} />
                </div>
                <ProgressKpi
                  label="Tasa Bien Ejecutado"
                  value={mcTasaBien}
                  displayValue={pct(mcTasaBien)}
                  thresholds={{ good: 80, warning: 60 }}
                />
              </div>

              {/* Evolución mensual */}
              <ChartCard title="Evolución Mensual" sub="Total vs bien ejecutados" className="lg:col-span-2">
                {mc.evolucion_mensual.length > 0 ? (
                  <EChart option={medCruzadosOption} height="200px" />
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-[11px] text-slate-400">Sin datos de evolución</div>
                )}
              </ChartCard>
            </div>
          </>
        )}

        {/* ── Quick nav ──────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          <button
            onClick={() => router.push('/dashboard/nuevas-conexiones')}
            className="bg-white rounded-lg border border-slate-200/60 shadow-sm px-5 py-4 flex items-center justify-between group hover:border-oca-blue/30 transition-colors text-left"
          >
            <div>
              <p className="text-[11px] font-semibold text-slate-700">Informe NNCC</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Dashboard ejecutivo con análisis de contratistas, causas y mapa</p>
            </div>
            <ArrowRight size={16} className="text-slate-300 group-hover:text-oca-blue transition-colors" />
          </button>

          {mc?.activo && (
            <button
              onClick={() => router.push('/dashboard/nuevas-conexiones/medidores-cruzados')}
              className="bg-white rounded-lg border border-slate-200/60 shadow-sm px-5 py-4 flex items-center justify-between group hover:border-oca-blue/30 transition-colors text-left"
            >
              <div>
                <p className="text-[11px] font-semibold text-slate-700">Medidores Cruzados</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Análisis detallado de hallazgos y medidores cruzados</p>
              </div>
              <ArrowRight size={16} className="text-slate-300 group-hover:text-oca-blue transition-colors" />
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
