'use client'

import { useMemo } from 'react'
import { EChart } from '@/components/ui/EChart'
import { HeroKpi, KpiCard } from '../../components/KpiCard'
import { formatNumber } from '@/lib/utils'
import { pct, ESTADO_MEDIDOR_COLORS } from '../helpers'
import {
  CHART_COLORS,
  TOOLTIP_STYLE,
  GRID_STYLE,
  AXIS_STYLE,
  CATEGORY_AXIS,
  LEGEND_STYLE,
  BAR_RADIUS,
  BAR_RADIUS_H,
} from '../../chart-theme'
import type { MCOverview } from '../types'

interface ResumenTabProps {
  data: MCOverview
  selectedZona: string | null
  setSelectedZona: (zona: string | null) => void
}

export default function ResumenTab({ data, selectedZona, setSelectedZona }: ResumenTabProps) {
  const { kpis, resultado_por_zona, estado_medidor, top_comunas, evolucion_mensual } = data

  // --- Tendencia Temporal chart ---
  const tendenciaOption = useMemo(() => {
    if (!evolucion_mensual.length) return null
    return {
      tooltip: { ...TOOLTIP_STYLE, trigger: 'axis' },
      legend: LEGEND_STYLE,
      grid: GRID_STYLE,
      xAxis: { type: 'category', data: evolucion_mensual.map(e => e.periodo), ...CATEGORY_AXIS },
      yAxis: [
        { type: 'value', ...AXIS_STYLE },
        {
          type: 'value',
          ...AXIS_STYLE,
          min: 0,
          max: 100,
          axisLabel: { ...AXIS_STYLE.axisLabel, formatter: '{value}%' },
        },
      ],
      series: [
        {
          name: 'Total',
          type: 'bar',
          data: evolucion_mensual.map(e => e.total),
          itemStyle: { color: CHART_COLORS.primary, borderRadius: BAR_RADIUS },
        },
        {
          name: 'Mal Ejecutado',
          type: 'bar',
          data: evolucion_mensual.map(e => e.mal),
          itemStyle: { color: CHART_COLORS.danger, borderRadius: BAR_RADIUS },
        },
        {
          name: '% Tasa Mal',
          type: 'line',
          yAxisIndex: 1,
          smooth: true,
          data: evolucion_mensual.map(e => e.tasa_mal),
          itemStyle: { color: CHART_COLORS.warning },
          lineStyle: { color: CHART_COLORS.warning },
          symbol: 'circle',
          symbolSize: 5,
        },
      ],
      dataZoom: evolucion_mensual.length > 12 ? [{ type: 'slider', height: 20, bottom: 5 }] : [],
    }
  }, [evolucion_mensual])

  // --- Resultado por Zona chart ---
  const zonaOption = useMemo(() => {
    if (!resultado_por_zona.length) return null
    const zonas = resultado_por_zona.map(z => z.zona)
    return {
      tooltip: { ...TOOLTIP_STYLE, trigger: 'axis' },
      legend: LEGEND_STYLE,
      grid: GRID_STYLE,
      yAxis: { type: 'category', data: zonas, ...CATEGORY_AXIS },
      xAxis: { type: 'value', ...AXIS_STYLE },
      series: [
        {
          name: 'Bien',
          type: 'bar',
          stack: 'resultado',
          data: resultado_por_zona.map((z, i) => ({
            value: z.bien,
            itemStyle: {
              color: CHART_COLORS.success,
              borderRadius: BAR_RADIUS_H,
              opacity: selectedZona && zonas[i] !== selectedZona ? 0.25 : 1,
            },
          })),
        },
        {
          name: 'Mal',
          type: 'bar',
          stack: 'resultado',
          data: resultado_por_zona.map((z, i) => ({
            value: z.mal,
            itemStyle: {
              color: CHART_COLORS.danger,
              borderRadius: BAR_RADIUS_H,
              opacity: selectedZona && zonas[i] !== selectedZona ? 0.25 : 1,
            },
          })),
        },
        {
          name: 'Otros',
          type: 'bar',
          stack: 'resultado',
          data: resultado_por_zona.map((z, i) => ({
            value: z.otros,
            itemStyle: {
              color: CHART_COLORS.muted,
              borderRadius: BAR_RADIUS_H,
              opacity: selectedZona && zonas[i] !== selectedZona ? 0.25 : 1,
            },
          })),
        },
      ],
    }
  }, [resultado_por_zona, selectedZona])

  const zonaEvents = useMemo(
    () => ({
      click: (p: any) => setSelectedZona(p.name === selectedZona ? null : p.name),
    }),
    [selectedZona, setSelectedZona]
  )

  // --- Estado Medidor chart ---
  const estadoOption = useMemo(() => {
    if (!estado_medidor.length) return null
    return {
      tooltip: { ...TOOLTIP_STYLE, trigger: 'axis' },
      grid: GRID_STYLE,
      yAxis: { type: 'category', data: estado_medidor.map(e => e.estado), ...CATEGORY_AXIS },
      xAxis: { type: 'value', ...AXIS_STYLE },
      series: [
        {
          type: 'bar',
          data: estado_medidor.map(e => ({
            value: e.cantidad,
            itemStyle: {
              color: ESTADO_MEDIDOR_COLORS[e.estado] || CHART_COLORS.muted,
              borderRadius: BAR_RADIUS_H,
            },
          })),
          label: { show: true, position: 'right', fontSize: 11, color: '#64748b' },
        },
      ],
    }
  }, [estado_medidor])

  // --- Top Comunas chart ---
  const comunasOption = useMemo(() => {
    if (!top_comunas.length) return null
    return {
      tooltip: { ...TOOLTIP_STYLE, trigger: 'axis' },
      grid: GRID_STYLE,
      yAxis: { type: 'category', data: top_comunas.map(c => c.comuna), ...CATEGORY_AXIS },
      xAxis: { type: 'value', ...AXIS_STYLE },
      series: [
        {
          type: 'bar',
          data: top_comunas.map(c => ({
            value: c.tasa_mal,
            itemStyle: {
              color:
                c.tasa_mal > 50
                  ? CHART_COLORS.danger
                  : c.tasa_mal > 30
                    ? CHART_COLORS.warning
                    : CHART_COLORS.primary,
              borderRadius: BAR_RADIUS_H,
            },
          })),
          label: {
            show: true,
            position: 'right',
            fontSize: 11,
            color: '#64748b',
            formatter: (p: any) => `${p.value}%`,
          },
        },
      ],
    }
  }, [top_comunas])

  const emptyState = (
    <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Sin datos</div>
  )

  return (
    <div className="flex flex-col gap-3">
      {/* Section 1 — Hero KPIs */}
      <div className="bg-white rounded-lg border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="grid grid-cols-3 divide-x divide-slate-100">
          <HeroKpi
            label="Tasa Mal Ejecutado"
            value={pct(kpis.pct_mal)}
            status={kpis.pct_mal <= 15 ? 'good' : 'bad'}
            meta="meta <15%"
            sparkData={evolucion_mensual.map(e => e.tasa_mal)}
            subtitle={`${formatNumber(kpis.mal)} de ${formatNumber(kpis.total)} inspeccionadas`}
          />
          <HeroKpi
            label="Total Inspecciones"
            value={kpis.total}
            status="neutral"
            sparkData={evolucion_mensual.map(e => e.total)}
          />
          <HeroKpi
            label="Tasa Bien Ejecutado"
            value={pct(kpis.pct_bien)}
            status={kpis.pct_bien >= 85 ? 'good' : 'bad'}
            meta="meta >85%"
            sparkData={evolucion_mensual.map(e => 100 - e.tasa_mal)}
          />
        </div>
      </div>

      {/* Section 2 — Operational KPIs */}
      <div className="bg-white rounded-lg border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-100">
          <KpiCard label="Zonas Activas" value={kpis.zonas_count} />
          <KpiCard label="Comunas" value={kpis.comunas_count} />
          <KpiCard label="Inspectores" value={kpis.inspectores_count} />
          <KpiCard
            label="Pend. Inspeccion"
            value={kpis.pendientes_inspeccion}
            status={kpis.pendientes_inspeccion > 0 ? 'bad' : 'good'}
          />
        </div>
      </div>

      {/* Section 3 — Tendencia Temporal + Resultado por Zona */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <div className="lg:col-span-3 bg-white rounded-lg border border-slate-200/60 shadow-sm px-4 py-3">
          <p className="text-xs font-semibold text-slate-700 tracking-tight mb-3">
            Tendencia Temporal
          </p>
          {tendenciaOption ? <EChart option={tendenciaOption} height="280px" /> : emptyState}
        </div>
        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200/60 shadow-sm px-4 py-3">
          <p className="text-xs font-semibold text-slate-700 tracking-tight mb-3">
            Resultado por Zona
          </p>
          {zonaOption ? (
            <EChart option={zonaOption} height="280px" onEvents={zonaEvents} />
          ) : (
            emptyState
          )}
        </div>
      </div>

      {/* Section 4 — Estado Medidor + Top Comunas */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <div className="lg:col-span-3 bg-white rounded-lg border border-slate-200/60 shadow-sm px-4 py-3">
          <p className="text-xs font-semibold text-slate-700 tracking-tight mb-3">
            Distribucion Estado Medidor
          </p>
          {estadoOption ? <EChart option={estadoOption} height="280px" /> : emptyState}
        </div>
        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200/60 shadow-sm px-4 py-3">
          <p className="text-xs font-semibold text-slate-700 tracking-tight mb-3">
            Top Comunas — Tasa Mal Ejecutado
          </p>
          {comunasOption ? <EChart option={comunasOption} height="280px" /> : emptyState}
        </div>
      </div>
    </div>
  )
}
