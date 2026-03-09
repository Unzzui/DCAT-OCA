'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { MapPoint } from '@/components/ui/LeafletMap'
import { MapDetailModal } from './MapDetailModal'

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

interface DayDetailModalProps {
  date: string       // YYYY-MM-DD
  points: MapPoint[]
  onClose: () => void
}

export function DayDetailModal({ date, points, onClose }: DayDetailModalProps) {
  const [selectedPoint, setSelectedPoint] = useState<MapPoint | null>(null)

  const total = points.length
  const mal = points.filter(p => p.resultado?.toUpperCase().includes('MAL')).length
  const bien = points.filter(p => p.resultado?.toUpperCase().includes('BIEN')).length
  const multas = points.filter(p => p.multa?.toUpperCase() === 'SI').length
  const tasaMal = total > 0 ? Math.round((mal / total) * 1000) / 10 : 0

  const [y, m, d] = date.split('-')
  const displayDate = `${d}/${m}/${y}`

  // Sort: mal first, then others, then bien
  const sorted = [...points].sort((a, b) => {
    const order = (r: string) => {
      const u = r.toUpperCase()
      if (u.includes('MAL')) return 0
      if (u.includes('BIEN')) return 2
      return 1
    }
    return order(a.resultado || '') - order(b.resultado || '')
  })

  if (selectedPoint) {
    return <MapDetailModal point={selectedPoint} onClose={() => setSelectedPoint(null)} />
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/30" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-lg border border-slate-200/60 w-full max-w-3xl mx-4 overflow-hidden max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-800 px-5 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-white">Detalle del Dia</span>
            <span className="text-xs text-slate-400">{displayDate}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/20 transition-colors text-white/80 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Summary KPIs */}
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div className="grid grid-cols-5 gap-3">
            <div className="text-center">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Total</p>
              <p className="text-lg font-bold text-slate-800">{total}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-green-600 uppercase tracking-wider">Bien</p>
              <p className="text-lg font-bold text-green-700">{bien}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-red-600 uppercase tracking-wider">Mal</p>
              <p className="text-lg font-bold text-red-700">{mal}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Tasa Mal</p>
              <p className="text-lg font-bold text-slate-700">{tasaMal}%</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Multas</p>
              <p className="text-lg font-bold text-amber-700">{multas}</p>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-white border-b border-slate-200 z-10">
              <tr>
                <th className="px-4 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                <th className="px-4 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">VTA</th>
                <th className="px-4 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Resultado</th>
                <th className="px-4 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Zona</th>
                <th className="px-4 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Comuna</th>
                <th className="px-4 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Contratista</th>
                <th className="px-4 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Multa</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, i) => {
                const { bg, text, label } = resultadoBadge(p.resultado || '')
                return (
                  <tr
                    key={`${p.vta}-${i}`}
                    onClick={() => setSelectedPoint(p)}
                    className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-2 text-[11px] text-slate-800 font-medium max-w-[160px] truncate">
                      {p.cliente || 'Sin cliente'}
                    </td>
                    <td className="px-4 py-2 text-[11px] text-slate-500 font-mono">
                      {cleanVta(p.vta)}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-semibold ${bg} ${text}`}>
                        {label}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-[11px] text-slate-500">{p.zona}</td>
                    <td className="px-4 py-2 text-[11px] text-slate-500">{p.comuna}</td>
                    <td className="px-4 py-2 text-[11px] text-slate-500 max-w-[120px] truncate">{p.contratista}</td>
                    <td className="px-4 py-2">
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

        {/* Footer hint */}
        <div className="shrink-0 px-5 py-2 border-t border-slate-100 bg-slate-50">
          <p className="text-[10px] text-slate-400 text-center">Clic en una fila para ver el detalle completo de la inspeccion</p>
        </div>
      </div>
    </div>
  )
}
