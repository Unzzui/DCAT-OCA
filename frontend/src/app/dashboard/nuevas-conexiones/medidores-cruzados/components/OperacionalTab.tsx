'use client'

import { useMemo } from 'react'
import { EChart } from '@/components/ui/EChart'
import { HeroKpi, KpiCard } from '../../components/KpiCard'
import {
  CHART_COLORS,
  TOOLTIP_STYLE,
  GRID_STYLE,
  AXIS_STYLE,
  LEGEND_STYLE,
  BAR_RADIUS,
} from '../../chart-theme'
import { formatNumber } from '@/lib/utils'
import { pct } from '../helpers'
import type { MCOperacional } from '../types'

interface OperacionalTabProps {
  data: MCOperacional
}

const CARD = 'bg-white rounded-lg border border-slate-200/60 shadow-sm overflow-hidden'
const SECTION_LABEL = 'text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-4 pt-4 pb-2'

function alertBorderColor(tipo: string): string {
  if (tipo === 'danger') return 'border-red-600'
  if (tipo === 'warning') return 'border-amber-500'
  return 'border-blue-500'
}

function estancadoColor(pctVal: number): string {
  if (pctVal >= 50) return 'text-red-700'
  if (pctVal >= 25) return 'text-amber-700'
  return 'text-slate-600'
}

function resultColor(key: string): string {
  switch (key) {
    case 'bien_ejecutados':
    case 'normal':
      return 'text-green-700'
    case 'mal_ejecutados':
    case 'mal_ingresado':
      return 'text-red-700'
    case 'ut_cruzada':
      return 'text-amber-700'
    case 'sin_acceso':
      return 'text-slate-500'
    default:
      return 'text-slate-900'
  }
}

const RESULT_ITEMS: Array<{ key: keyof MCOperacional['detalle_resultados']; label: string }> = [
  { key: 'total', label: 'Total' },
  { key: 'bien_ejecutados', label: 'Bien Ejecutados' },
  { key: 'mal_ejecutados', label: 'Mal Ejecutados' },
  { key: 'ut_cruzada', label: 'UT Cruzada' },
  { key: 'mal_ingresado', label: 'Mal Ingresado' },
  { key: 'sin_acceso', label: 'Sin Acceso' },
  { key: 'normal', label: 'Normal' },
]

export default function OperacionalTab({ data }: OperacionalTabProps) {
  const tasaResolucion = data.pendientes.total > 0
    ? ((data.pendientes.total - data.pendientes.sin_inspeccion) / data.pendientes.total) * 100
    : 0

  const evolucionOption = useMemo(() => {
    const periodos = data.evolucion_tiempos.map((e) => e.periodo)
    const diasProm = data.evolucion_tiempos.map((e) => e.dias_promedio)
    const tasaBien = data.evolucion_tiempos.map((e) => e.tasa_bien)
    const needZoom = periodos.length > 12

    return {
      tooltip: {
        ...TOOLTIP_STYLE,
        trigger: 'axis' as const,
      },
      grid: GRID_STYLE,
      legend: LEGEND_STYLE,
      xAxis: {
        type: 'category' as const,
        data: periodos,
        ...AXIS_STYLE,
        splitLine: { show: false },
      },
      yAxis: [
        {
          type: 'value' as const,
          name: 'dias',
          ...AXIS_STYLE,
        },
        {
          type: 'value' as const,
          min: 0,
          max: 100,
          ...AXIS_STYLE,
          axisLabel: {
            ...AXIS_STYLE.axisLabel,
            formatter: '{value}%',
          },
        },
      ],
      series: [
        {
          name: 'Dias Promedio',
          type: 'bar' as const,
          data: diasProm,
          yAxisIndex: 0,
          itemStyle: { color: CHART_COLORS.primary, borderRadius: BAR_RADIUS },
        },
        {
          name: '% Tasa Bien',
          type: 'line' as const,
          data: tasaBien,
          yAxisIndex: 1,
          smooth: true,
          itemStyle: { color: CHART_COLORS.success },
          lineStyle: { color: CHART_COLORS.success },
        },
      ],
      ...(needZoom
        ? {
            dataZoom: [
              { type: 'inside' as const, start: 0, end: 100 },
              { type: 'slider' as const, start: 0, end: 100, height: 18, bottom: 24 },
            ],
          }
        : {}),
    }
  }, [data.evolucion_tiempos])

  return (
    <div className="space-y-3">
      {/* Section 1 — Hero KPIs */}
      <div className={CARD}>
        <div className="grid grid-cols-3 divide-x divide-slate-100">
          <HeroKpi
            label="Dias Prom. Total"
            value={data.tiempos.total_dias.toFixed(1)}
            subtitle="correo a análisis"
            status={data.tiempos.total_dias <= 20 ? 'good' : data.tiempos.total_dias > 30 ? 'bad' : 'neutral'}
          />
          <HeroKpi
            label="Casos Estancados"
            value={data.pendientes.estancados}
            status={data.pendientes.estancados > 0 ? 'bad' : 'good'}
          />
          <HeroKpi
            label="Tasa Resolucion"
            value={pct(tasaResolucion)}
            status={tasaResolucion >= 80 ? 'good' : 'bad'}
          />
        </div>
      </div>

      {/* Section 2 — Operational KPIs */}
      <div className={CARD}>
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-100">
          <KpiCard
            label="Correo → Asignación"
            value={data.tiempos.correo_asignacion.toFixed(1)}
            unit="dias"
          />
          <KpiCard
            label="Asignación → Inspección"
            value={data.tiempos.asignacion_inspeccion.toFixed(1)}
            unit="dias"
          />
          <KpiCard
            label="Inspección → Análisis"
            value={data.tiempos.inspeccion_analisis.toFixed(1)}
            unit="dias"
          />
          <KpiCard
            label="Casos >60 dias"
            value={data.tiempos.mayor_60}
            status={data.tiempos.mayor_60 > 0 ? 'bad' : 'good'}
          />
        </div>
      </div>

      {/* Section 3 — Evolucion Tiempos + Alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <div className={`${CARD} lg:col-span-3`}>
          <p className={SECTION_LABEL}>Evolucion de Tiempos</p>
          <div className="px-4 pb-4">
            <EChart option={evolucionOption} height="280px" />
          </div>
        </div>

        <div className={`${CARD} lg:col-span-2`}>
          <p className={SECTION_LABEL}>Alertas Operacionales</p>
          <div className="px-4 pb-4">
            {data.alertas.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
                Sin alertas activas
              </div>
            ) : (
              <div className="space-y-2">
                {data.alertas.map((a, i) => (
                  <div
                    key={i}
                    className={`border-l-4 ${alertBorderColor(a.tipo)} bg-white rounded-r-lg px-3 py-2`}
                  >
                    <p className="text-[11px] font-semibold text-slate-700">{a.titulo}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{a.mensaje}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section 4 — Cuellos de Botella + Casos Pendientes */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <div className={`${CARD} lg:col-span-3`}>
          <p className={SECTION_LABEL}>Cuellos de Botella por Etapa</p>
          <div className="px-4 pb-4">
            {data.cuellos_botella.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
                Sin datos
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-100 px-3 py-2">
                      Etapa
                    </th>
                    <th className="text-right text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-100 px-3 py-2">
                      Cantidad
                    </th>
                    <th className="text-right text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-100 px-3 py-2">
                      Sin Avance
                    </th>
                    <th className="text-right text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-100 px-3 py-2">
                      % Estancado
                    </th>
                    <th className="text-right text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-100 px-3 py-2">
                      Dias Prom.
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.cuellos_botella.map((row, i) => (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/80">
                      <td className="text-[11px] text-slate-600 px-3 py-2.5">{row.etapa}</td>
                      <td className="text-right text-[11px] text-slate-600 px-3 py-2.5">
                        {formatNumber(row.cantidad)}
                      </td>
                      <td className="text-right text-[11px] text-slate-600 px-3 py-2.5">
                        {formatNumber(row.sin_inspeccion)}
                      </td>
                      <td className={`text-right text-[11px] font-medium px-3 py-2.5 ${estancadoColor(row.pct_estancado)}`}>
                        {pct(row.pct_estancado)}
                      </td>
                      <td className="text-right text-[11px] text-slate-600 px-3 py-2.5">
                        {row.dias_promedio.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className={`${CARD} lg:col-span-2`}>
          <p className={SECTION_LABEL}>Casos Pendientes</p>
          <div className="px-4 pb-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-lg px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Sin Inspeccion</p>
                <p className={`text-lg font-semibold leading-none mt-1 ${data.pendientes.sin_inspeccion > 0 ? 'text-red-700' : 'text-slate-900'}`}>
                  {formatNumber(data.pendientes.sin_inspeccion)}
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Sin Asignar</p>
                <p className="text-lg font-semibold text-slate-900 leading-none mt-1">
                  {formatNumber(data.pendientes.sin_asignar)}
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Asig. sin Insp.</p>
                <p className="text-lg font-semibold text-slate-900 leading-none mt-1">
                  {formatNumber(data.pendientes.asignados_sin_inspeccionar)}
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Estancados &gt;30d</p>
                <p className={`text-lg font-semibold leading-none mt-1 ${data.pendientes.estancados > 0 ? 'text-red-700' : 'text-slate-900'}`}>
                  {formatNumber(data.pendientes.estancados)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 5 — Detalle Resultados */}
      <div className={CARD}>
        <p className={SECTION_LABEL}>Detalle de Resultados</p>
        <div className="px-4 pb-4">
          <div className="grid grid-cols-3 md:grid-cols-7 gap-3">
            {RESULT_ITEMS.map(({ key, label }) => (
              <div key={key} className="bg-slate-50 rounded-lg px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p>
                <p className={`text-lg font-semibold leading-none mt-1 ${resultColor(key)}`}>
                  {formatNumber(data.detalle_resultados[key])}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
