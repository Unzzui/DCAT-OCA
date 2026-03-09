'use client'

import { useMemo } from 'react'
import { X } from 'lucide-react'
import { EChart } from '@/components/ui/EChart'
import type { KpiModalData } from '../types'
import { CHART_COLORS } from '../chart-theme'

export function KpiModal({
  title,
  modalKey,
  data,
  onClose,
}: {
  title: string
  modalKey: string
  data: KpiModalData
  onClose: () => void
}) {
  const chartOption = useMemo(() => {
    const base = {
      tooltip: { trigger: 'axis' as const, backgroundColor: '#fff', borderColor: '#e2e8f0', textStyle: { color: '#334155', fontSize: 12 } },
      grid: { left: 10, right: 24, top: 12, bottom: 12, containLabel: true },
    }

    switch (modalKey) {
      case 'total': {
        const items = data.zona_breakdown
        return {
          ...base,
          xAxis: { type: 'value' as const, splitLine: { lineStyle: { color: '#f1f5f9' } } },
          yAxis: { type: 'category' as const, data: items.map(i => i.zona), axisLabel: { fontSize: 11, color: '#64748b' }, axisLine: { show: false }, axisTick: { show: false } },
          series: [{ type: 'bar' as const, data: items.map(i => i.total), itemStyle: { color: CHART_COLORS.primary, borderRadius: [0, 3, 3, 0] }, barMaxWidth: 24 }],
        }
      }
      case 'mal_ejecutado': {
        const items = data.top_causas
        return {
          ...base,
          xAxis: { type: 'value' as const, splitLine: { lineStyle: { color: '#f1f5f9' } } },
          yAxis: { type: 'category' as const, data: items.map(i => i.causa), axisLabel: { fontSize: 10, color: '#64748b', width: 150, overflow: 'truncate' as const }, axisLine: { show: false }, axisTick: { show: false } },
          series: [{ type: 'bar' as const, data: items.map(i => i.cantidad), itemStyle: { color: CHART_COLORS.danger, borderRadius: [0, 3, 3, 0] }, barMaxWidth: 24 }],
        }
      }
      case 'multas': {
        const items = data.top_multas_contratistas
        return {
          ...base,
          xAxis: { type: 'value' as const, splitLine: { lineStyle: { color: '#f1f5f9' } } },
          yAxis: { type: 'category' as const, data: items.map(i => i.contratista), axisLabel: { fontSize: 10, color: '#64748b', width: 150, overflow: 'truncate' as const }, axisLine: { show: false }, axisTick: { show: false } },
          series: [{ type: 'bar' as const, data: items.map(i => i.multas), itemStyle: { color: CHART_COLORS.warning, borderRadius: [0, 3, 3, 0] }, barMaxWidth: 24 }],
        }
      }
      case 'no_efectiva': {
        const items = data.no_efectiva_zona
        return {
          ...base,
          tooltip: { ...base.tooltip, formatter: (p: Array<{ name: string; value: number }>) => `${p[0].name}: ${p[0].value.toFixed(1)}%` },
          xAxis: { type: 'value' as const, axisLabel: { formatter: '{value}%', color: '#94a3b8', fontSize: 11 }, splitLine: { lineStyle: { color: '#f1f5f9' } } },
          yAxis: { type: 'category' as const, data: items.map(i => i.zona), axisLabel: { fontSize: 11, color: '#64748b' }, axisLine: { show: false }, axisTick: { show: false } },
          series: [{ type: 'bar' as const, data: items.map(i => i.pct), itemStyle: { color: CHART_COLORS.muted, borderRadius: [0, 3, 3, 0] }, barMaxWidth: 24 }],
        }
      }
      default:
        return {}
    }
  }, [modalKey, data])

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/30" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lg border border-slate-200/60 w-full max-w-lg mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800 tracking-tight">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X size={16} className="text-slate-400" />
          </button>
        </div>
        <div className="p-5">
          <EChart option={chartOption} height="260px" />
        </div>
      </div>
    </div>
  )
}
