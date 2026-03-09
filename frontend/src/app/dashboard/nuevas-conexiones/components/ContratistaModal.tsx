'use client'

import { useState, useMemo, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import { EChart } from '@/components/ui/EChart'
import { api } from '@/lib/api'
import { formatNumber } from '@/lib/utils'
import type { MapPoint } from '@/components/ui/LeafletMap'
import type { MalEjecutadosData } from '../types'
import { pct } from '../helpers'
import { CHART_COLORS, TOOLTIP_STYLE, AXIS_STYLE, CATEGORY_AXIS, BAR_RADIUS_H } from '../chart-theme'
import { MapDetailModal } from './MapDetailModal'

interface ContratistaRanking {
  contratista: string
  inspecciones: number
  mal_ejecutado: number
  tasa_mal: number
  multas: number
  tasa_multas: number
  pend_norm: number
  tasa_cierre: number
}

interface Props {
  contratistaName: string
  ranking: ContratistaRanking
  malEjecutadosData: MalEjecutadosData | null
  selectedBase: string
  mapaPoints: MapPoint[]
  onClose: () => void
  onViewRecords: () => void
}

function KpiCell({ label, value, sub, color = 'text-slate-800' }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-slate-50 rounded-lg px-3 py-2.5">
      <p className="text-[9px] font-medium text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`text-lg font-bold ${color} mt-0.5 leading-tight`}>{value}</p>
      {sub && <p className="text-[9px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function resultadoBadge(resultado: string): { bg: string; text: string; label: string } {
  const r = resultado.toUpperCase()
  if (r.includes('MAL')) return { bg: 'bg-red-50', text: 'text-red-700', label: 'Mal Ejecutado' }
  if (r.includes('BIEN')) return { bg: 'bg-green-50', text: 'text-green-700', label: 'Bien Ejecutado' }
  return { bg: 'bg-slate-50', text: 'text-slate-500', label: resultado || 'Otros' }
}

function cleanVta(val?: string | number): string {
  if (val == null) return ''
  return String(val).replace(/\.0$/, '')
}

export function ContratistaModal({ contratistaName, ranking, malEjecutadosData, selectedBase, mapaPoints, onClose, onViewRecords }: Props) {
  const [causasData, setCausasData] = useState<MalEjecutadosData | null>(malEjecutadosData)
  const [causasLoading, setCausasLoading] = useState(false)
  const [selectedPoint, setSelectedPoint] = useState<MapPoint | null>(null)

  useEffect(() => {
    if (malEjecutadosData) {
      setCausasData(malEjecutadosData)
      return
    }
    let cancelled = false
    setCausasLoading(true)
    const params: Record<string, string> = {}
    if (selectedBase) params.base = selectedBase
    api.get<MalEjecutadosData>('/api/v1/nuevas-conexiones/dashboard/mal-ejecutados', params)
      .then((d) => { if (!cancelled) setCausasData(d) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setCausasLoading(false) })
    return () => { cancelled = true }
  }, [malEjecutadosData, selectedBase])

  // Filter mapa points for this contratista, sorted by date desc
  const contratistaPoints = useMemo(() => {
    return mapaPoints
      .filter(p => p.contratista === contratistaName)
      .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))
      .slice(0, 20)
  }, [mapaPoints, contratistaName])

  const contratistaCausas = useMemo(() => {
    if (!causasData?.causas_por_contratista) return null
    return causasData.causas_por_contratista.find(
      (c) => c.contratista === contratistaName
    )
  }, [causasData, contratistaName])

  const causasChartOption = useMemo(() => {
    if (!contratistaCausas?.causas?.length) return null
    const causas = [...contratistaCausas.causas].sort((a, b) => a.cantidad - b.cantidad)
    return {
      tooltip: { ...TOOLTIP_STYLE, trigger: 'axis' as const },
      grid: { left: 8, right: 24, bottom: 8, top: 8, containLabel: true },
      xAxis: { type: 'value' as const, ...AXIS_STYLE },
      yAxis: {
        type: 'category' as const,
        data: causas.map((c) => c.causa.replace(/_/g, ' ')),
        ...CATEGORY_AXIS,
        axisLabel: { fontSize: 10, color: '#64748b', width: 140, overflow: 'truncate' as const },
      },
      series: [{
        type: 'bar' as const,
        barMaxWidth: 18,
        data: causas.map((c) => ({
          value: c.cantidad,
          itemStyle: { color: CHART_COLORS.danger, borderRadius: BAR_RADIUS_H },
        })),
        label: { show: true, position: 'right' as const, fontSize: 10, color: '#64748b' },
      }],
    }
  }, [contratistaCausas])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  if (selectedPoint) {
    return <MapDetailModal point={selectedPoint} onClose={() => setSelectedPoint(null)} />
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/30" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-lg border border-slate-200/60 w-full max-w-3xl mx-4 overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-800 px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="text-white">
            <h3 className="text-sm font-semibold leading-tight">{contratistaName}</h3>
            <p className="text-[10px] text-slate-300 mt-0.5">Analisis de contratista</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/70 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {/* KPI Strip */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            <KpiCell label="Inspecciones" value={formatNumber(ranking.inspecciones)} />
            <KpiCell
              label="Mal Ejecutados"
              value={formatNumber(ranking.mal_ejecutado)}
              sub={pct(ranking.tasa_mal)}
              color="text-red-600"
            />
            <KpiCell
              label="Multas"
              value={formatNumber(ranking.multas)}
              sub={`Tasa: ${pct(ranking.tasa_multas)}`}
              color="text-amber-600"
            />
            <KpiCell
              label="Pend. Normaliz."
              value={formatNumber(ranking.pend_norm)}
            />
            <KpiCell
              label="Tasa Cierre"
              value={pct(ranking.tasa_cierre)}
              color={ranking.tasa_cierre >= 80 ? 'text-green-600' : ranking.tasa_cierre >= 50 ? 'text-amber-600' : 'text-red-600'}
            />
            <KpiCell
              label="Tasa Mal"
              value={pct(ranking.tasa_mal)}
              color={ranking.tasa_mal >= 30 ? 'text-red-600' : ranking.tasa_mal >= 15 ? 'text-amber-600' : 'text-green-600'}
            />
          </div>

          {/* Causas de Mal Ejecucion */}
          <div>
            <h4 className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Causas de Mal Ejecucion
            </h4>
            {causasLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 size={16} className="animate-spin text-slate-400" />
              </div>
            ) : causasChartOption ? (
              <EChart option={causasChartOption} height={`${Math.max(120, (contratistaCausas?.causas?.length ?? 0) * 28 + 40)}px`} />
            ) : (
              <div className="flex items-center justify-center h-20 text-[11px] text-slate-400 bg-slate-50 rounded-lg">
                Sin causas de mal ejecucion registradas
              </div>
            )}
          </div>

          {/* Ultimas Inspecciones — table format */}
          <div>
            <h4 className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Ultimas Inspecciones
              <span className="text-slate-400 font-normal ml-1">({contratistaPoints.length})</span>
            </h4>
            {contratistaPoints.length > 0 ? (
              <div className="overflow-x-auto -mx-1 px-1 max-h-[280px] overflow-y-auto">
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-white border-b border-slate-200 z-10">
                    <tr>
                      <th className="px-3 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                      <th className="px-3 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">VTA</th>
                      <th className="px-3 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Fecha</th>
                      <th className="px-3 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Resultado</th>
                      <th className="px-3 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Comuna</th>
                      <th className="px-3 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Multa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contratistaPoints.map((p, i) => {
                      const { bg, text, label } = resultadoBadge(p.resultado || '')
                      return (
                        <tr
                          key={`${p.vta}-${i}`}
                          onClick={() => setSelectedPoint(p)}
                          className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
                        >
                          <td className="px-3 py-2 text-[11px] text-slate-800 font-medium">{p.cliente || '–'}</td>
                          <td className="px-3 py-2 text-[11px] text-slate-500 font-mono">{cleanVta(p.vta)}</td>
                          <td className="px-3 py-2 text-[11px] text-slate-500">{p.fecha || '–'}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-semibold ${bg} ${text}`}>
                              {label}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-[11px] text-slate-500">{p.comuna}</td>
                          <td className="px-3 py-2">
                            {p.multa?.toUpperCase() === 'SI' && (
                              <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-semibold bg-red-50 text-red-700">SI</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex items-center justify-center h-16 text-[11px] text-slate-400 bg-slate-50 rounded-lg">
                Sin registros recientes
              </div>
            )}
            {contratistaPoints.length > 0 && (
              <p className="text-[10px] text-slate-400 text-center mt-1.5">Clic en una fila para ver el detalle completo</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-3 border-t border-slate-100 bg-slate-50">
          <button
            onClick={onViewRecords}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-900 transition-colors"
          >
            Ver todos los registros
          </button>
        </div>
      </div>
    </div>
  )
}
