'use client'

import { useMemo } from 'react'
import { EChart } from '@/components/ui/EChart'
import { HeroKpi, KpiCard } from '../../components/KpiCard'
import {
  CHART_COLORS,
  TOOLTIP_STYLE,
  GRID_STYLE,
  AXIS_STYLE,
  CATEGORY_AXIS,
  CONTRATISTA_COLORS,
  BAR_RADIUS_H,
} from '../../chart-theme'
import { pct, ESTADO_MEDIDOR_COLORS } from '../helpers'
import type { MCInspectores, MCOverview } from '../types'

interface InspectoresTabProps {
  data: MCInspectores
  overview: MCOverview
  addDrillFilter: (key: string, label: string, value: string) => void
}

export default function InspectoresTab({ data, overview, addDrillFilter }: InspectoresTabProps) {
  const worstInspector = useMemo(
    () => data.ranking.length > 0
      ? data.ranking.reduce((w, r) => (r.tasa_mal > w.tasa_mal ? r : w), data.ranking[0])
      : null,
    [data.ranking],
  )

  if (!data.ranking.length) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        Sin datos de inspectores
      </div>
    )
  }

  const avgCases = data.ranking.length ? Math.round(overview.kpis.total / data.ranking.length) : 0

  const diasProm = useMemo(() => {
    if (!data.ranking.length) return '\u2013'
    return (data.ranking.reduce((s, r) => s + r.dias_prom, 0) / data.ranking.length).toFixed(1)
  }, [data.ranking])

  // ── Scatter chart option ──
  const scatterOption = useMemo(() => {
    const maxVol = Math.max(...data.scatter.map((s) => s.volumen), 1)
    const avgVol = data.scatter.reduce((s, v) => s + v.volumen, 0) / (data.scatter.length || 1)

    return {
      tooltip: {
        ...TOOLTIP_STYLE,
        formatter: (p: any) => {
          const d = p.data
          return `<div style="font-weight:600;margin-bottom:4px">${d.name}</div>
            <div style="font-size:11px">Inspecciones: ${d.value[0]}</div>
            <div style="font-size:11px">Tasa Mal: ${d.value[1].toFixed(1)}%</div>`
        },
      },
      grid: GRID_STYLE,
      xAxis: { type: 'value', name: 'Inspecciones', ...AXIS_STYLE },
      yAxis: { type: 'value', name: '% Tasa Mal', min: 0, max: 100, ...AXIS_STYLE },
      series: [
        {
          type: 'scatter',
          data: data.scatter.map((s, i) => ({
            value: [s.volumen, s.tasa_mal],
            name: s.inspector,
            itemStyle: { color: CONTRATISTA_COLORS[i % CONTRATISTA_COLORS.length] },
          })),
          symbolSize: (val: number[]) => Math.max(10, (val[0] / maxVol) * 40),
          markLine: {
            silent: true,
            lineStyle: { type: 'dashed' },
            data: [
              { yAxis: 30, lineStyle: { color: CHART_COLORS.danger }, label: { formatter: '30%', fontSize: 10, color: CHART_COLORS.danger } },
              { xAxis: avgVol, lineStyle: { color: CHART_COLORS.muted }, label: { formatter: `Prom: ${Math.round(avgVol)}`, fontSize: 10, color: '#64748b' } },
            ],
          },
        },
      ],
    }
  }, [data.scatter])

  // ── Top 10 bar chart option ──
  const top10 = useMemo(
    () =>
      data.ranking
        .slice()
        .sort((a, b) => b.tasa_mal - a.tasa_mal)
        .slice(0, 10),
    [data.ranking],
  )

  const top10Option = useMemo(
    () => ({
      tooltip: { ...TOOLTIP_STYLE, formatter: (p: any) => `${p.name}: ${p.value.toFixed(1)}%` },
      grid: { ...GRID_STYLE, left: 16 },
      xAxis: { type: 'value', max: 100, ...AXIS_STYLE },
      yAxis: {
        type: 'category',
        data: top10.map((r) => r.inspector).reverse(),
        ...CATEGORY_AXIS,
        axisLabel: { ...CATEGORY_AXIS.axisLabel, width: 100, overflow: 'truncate' },
      },
      series: [
        {
          type: 'bar',
          data: top10
            .map((r) => ({
              value: r.tasa_mal,
              itemStyle: {
                color:
                  r.tasa_mal >= 30
                    ? CHART_COLORS.danger
                    : r.tasa_mal >= 15
                      ? CHART_COLORS.warning
                      : CHART_COLORS.primary,
                borderRadius: BAR_RADIUS_H,
              },
            }))
            .reverse(),
          label: { show: true, position: 'right', fontSize: 10, color: '#64748b', formatter: (p: any) => `${p.value.toFixed(1)}%` },
          barMaxWidth: 18,
        },
      ],
    }),
    [top10],
  )

  // ── Inspectors by estado medidor ──
  const top8ByTotal = useMemo(
    () =>
      data.ranking
        .slice()
        .sort((a, b) => b.total - a.total)
        .slice(0, 8),
    [data.ranking],
  )

  const estadoBarOption = useMemo(
    () => ({
      tooltip: {
        ...TOOLTIP_STYLE,
        formatter: (p: any) => `${p.name}: ${p.value} inspecciones<br/><span style="font-size:10px">${p.data.estado}</span>`,
      },
      grid: { ...GRID_STYLE, left: 16 },
      xAxis: { type: 'value', ...AXIS_STYLE },
      yAxis: {
        type: 'category',
        data: top8ByTotal.map((r) => r.inspector).reverse(),
        ...CATEGORY_AXIS,
        axisLabel: { ...CATEGORY_AXIS.axisLabel, width: 100, overflow: 'truncate' },
      },
      series: [
        {
          type: 'bar',
          data: top8ByTotal
            .map((r) => ({
              value: r.total,
              estado: r.estado_principal,
              itemStyle: {
                color: ESTADO_MEDIDOR_COLORS[r.estado_principal] || CHART_COLORS.muted,
                borderRadius: BAR_RADIUS_H,
              },
            }))
            .reverse(),
          label: { show: true, position: 'right', fontSize: 10, color: '#64748b' },
          barMaxWidth: 18,
        },
      ],
    }),
    [top8ByTotal],
  )

  // ── Ranking table helpers ──
  const maxTasaMal = useMemo(
    () => Math.max(...data.ranking.map((r) => r.tasa_mal), 1),
    [data.ranking],
  )

  const barColor = (tasa: number) =>
    tasa >= 30 ? 'bg-red-700' : tasa >= 15 ? 'bg-amber-600' : 'bg-green-700'

  const badgeClass = (tasa: number) =>
    tasa >= 30
      ? 'text-red-700 bg-red-50'
      : tasa >= 15
        ? 'text-amber-700 bg-amber-50'
        : 'text-green-700 bg-green-50'

  return (
    <div className="space-y-3">
      {/* ── Section 1: Hero KPIs ── */}
      <div className="bg-white border border-slate-200/60 shadow-sm rounded-lg overflow-hidden grid grid-cols-3 divide-x divide-slate-100">
        <HeroKpi
          label="Inspectores Activos"
          value={data.ranking.length}
          subtitle={`en ${overview.kpis.zonas_count} zonas`}
          status="neutral"
        />
        <HeroKpi
          label="Peor Tasa Mal"
          value={pct(worstInspector?.tasa_mal)}
          subtitle={worstInspector?.inspector}
          status={(worstInspector?.tasa_mal ?? 0) >= 30 ? 'bad' : 'neutral'}
        />
        <HeroKpi
          label="Prom. Casos/Inspector"
          value={avgCases}
          status="neutral"
        />
      </div>

      {/* ── Section 2: Operational KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200/60 shadow-sm rounded-lg overflow-hidden">
          <KpiCard
            label="Total Inspeccionadas"
            value={overview.kpis.total - overview.kpis.pendientes_inspeccion}
          />
        </div>
        <div className="bg-white border border-slate-200/60 shadow-sm rounded-lg overflow-hidden">
          <KpiCard
            label="Mal Ejecutados"
            value={overview.kpis.mal}
            subtitle={`${pct(overview.kpis.pct_mal)} del total`}
          />
        </div>
        <div className="bg-white border border-slate-200/60 shadow-sm rounded-lg overflow-hidden">
          <KpiCard label="Dias Prom. Proceso" value={diasProm} unit="dias" />
        </div>
        <div className="bg-white border border-slate-200/60 shadow-sm rounded-lg overflow-hidden">
          <KpiCard
            label="Sin Inspeccion"
            value={overview.kpis.pendientes_inspeccion}
            status={overview.kpis.pendientes_inspeccion > 0 ? 'bad' : 'good'}
          />
        </div>
      </div>

      {/* ── Section 3: Scatter + Top 10 Bar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <div className="lg:col-span-3 bg-white border border-slate-200/60 shadow-sm rounded-lg p-4">
          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2">
            Volumen vs Tasa Mal Ejecutado
          </p>
          <EChart option={scatterOption} height="280px" />
        </div>
        <div className="lg:col-span-2 bg-white border border-slate-200/60 shadow-sm rounded-lg p-4">
          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2">
            Top 10 — Tasa Mal Ejecutado
          </p>
          <EChart option={top10Option} height="280px" />
        </div>
      </div>

      {/* ── Section 4: Estado Medidor + Causa Principal Table ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <div className="lg:col-span-3 bg-white border border-slate-200/60 shadow-sm rounded-lg p-4">
          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2">
            Inspectores por Estado Medidor
          </p>
          <EChart option={estadoBarOption} height="280px" />
        </div>
        <div className="lg:col-span-2 bg-white border border-slate-200/60 shadow-sm rounded-lg p-4">
          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-3">
            Causa Principal por Inspector
          </p>
          <div className="overflow-auto max-h-[280px]">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-100">
                  <th className="text-left py-2 pr-2 font-medium">Inspector</th>
                  <th className="text-left py-2 pr-2 font-medium">Estado Principal</th>
                  <th className="text-right py-2 font-medium">Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {data.ranking.map((row) => (
                  <tr
                    key={row.inspector}
                    className="border-b border-slate-50 hover:bg-slate-50/80 cursor-pointer text-[11px] text-slate-600"
                    onClick={() => addDrillFilter('inspector', 'Inspector', row.inspector)}
                  >
                    <td className="py-1.5 pr-2">{row.inspector}</td>
                    <td className="py-1.5 pr-2">{row.estado_principal}</td>
                    <td className="py-1.5 text-right tabular-nums">{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Section 5: Ranking Table ── */}
      <div className="bg-white border border-slate-200/60 shadow-sm rounded-lg p-4">
        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-3">
          Ranking de Inspectores
        </p>
        <div className="overflow-auto">
          <table className="w-full">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-100">
                <th className="text-left py-2 pr-2 font-medium w-8">#</th>
                <th className="text-left py-2 pr-2 font-medium">Inspector</th>
                <th className="text-right py-2 pr-3 font-medium">Insp.</th>
                <th className="text-right py-2 pr-3 font-medium">Mal Ej.</th>
                <th className="text-left py-2 pr-3 font-medium w-32">Tasa Mal</th>
                <th className="text-right py-2 pr-3 font-medium">Zonas</th>
                <th className="text-right py-2 pr-3 font-medium">Comunas</th>
                <th className="text-right py-2 font-medium">Dias Prom.</th>
              </tr>
            </thead>
            <tbody>
              {data.ranking.map((row, i) => (
                <tr
                  key={row.inspector}
                  className="border-b border-slate-50 hover:bg-slate-50/80 cursor-pointer text-[11px] text-slate-600"
                  onClick={() => addDrillFilter('inspector', 'Inspector', row.inspector)}
                >
                  <td className="py-1.5 pr-2 tabular-nums text-slate-400">{i + 1}</td>
                  <td className="py-1.5 pr-2 font-medium text-slate-700">{row.inspector}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{row.total}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{row.mal}</td>
                  <td className="py-1.5 pr-3">
                    <div className="w-full bg-slate-100 rounded-full h-[3px]">
                      <div
                        className={`h-full rounded-full ${barColor(row.tasa_mal)}`}
                        style={{ width: `${Math.min(100, (row.tasa_mal / maxTasaMal) * 100)}%` }}
                      />
                    </div>
                    <span
                      className={`inline-block mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded ${badgeClass(row.tasa_mal)}`}
                    >
                      {pct(row.tasa_mal)}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{row.zonas}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{row.comunas}</td>
                  <td className="py-1.5 text-right tabular-nums">{row.dias_prom.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
