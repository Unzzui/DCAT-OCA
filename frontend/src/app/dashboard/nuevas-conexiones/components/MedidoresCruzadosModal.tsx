'use client'

import { X } from 'lucide-react'
import type { MapPoint } from '@/components/ui/LeafletMap'

function isValid(val?: string): boolean {
  return !!val && val !== '' && val !== 'None' && val !== 'nan' && val !== 'NaN' && val !== 'null'
}

export function MedidoresCruzadosModal({
  points,
  onClose,
  onSelectPoint,
}: {
  points: MapPoint[]
  onClose: () => void
  onSelectPoint: (point: MapPoint) => void
}) {
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/30" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-lg border border-slate-200/60 w-full max-w-2xl mx-4 overflow-hidden max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-red-600 px-5 py-3 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-white">Medidores Cruzados Encontrados</h3>
            <p className="text-[10px] text-red-100 mt-0.5">{points.length} hallazgo{points.length !== 1 ? 's' : ''} en inspecciones</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/70 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Table */}
        <div className="overflow-y-auto flex-1">
          {points.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-[12px] text-slate-400">
              Sin hallazgos de medidores cruzados
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-2.5 text-[9px] font-medium text-slate-500 uppercase tracking-wider">VTA</th>
                  <th className="px-4 py-2.5 text-[9px] font-medium text-slate-500 uppercase tracking-wider">Fecha</th>
                  <th className="px-4 py-2.5 text-[9px] font-medium text-slate-500 uppercase tracking-wider">Comuna</th>
                  <th className="px-4 py-2.5 text-[9px] font-medium text-slate-500 uppercase tracking-wider">Contratista</th>
                  <th className="px-4 py-2.5 text-[9px] font-medium text-slate-500 uppercase tracking-wider">Medidor</th>
                  <th className="px-4 py-2.5 text-[9px] font-medium text-slate-500 uppercase tracking-wider">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {points.map((p, i) => (
                  <tr
                    key={`${p.vta}-${i}`}
                    className="border-b border-slate-50 hover:bg-slate-50/80 cursor-pointer transition-colors"
                    onClick={() => { onClose(); onSelectPoint(p) }}
                  >
                    <td className="px-4 py-2.5 text-[11px] font-medium text-slate-800">{isValid(p.vta) ? p.vta : '–'}</td>
                    <td className="px-4 py-2.5 text-[11px] text-slate-600">{isValid(p.fecha) ? p.fecha : '–'}</td>
                    <td className="px-4 py-2.5 text-[11px] text-slate-600">{isValid(p.comuna) ? p.comuna : '–'}</td>
                    <td className="px-4 py-2.5 text-[11px] text-slate-600">{isValid(p.contratista) ? p.contratista : '–'}</td>
                    <td className="px-4 py-2.5 text-[11px] text-slate-600">{isValid(p.n_medidor) ? p.n_medidor : '–'}</td>
                    <td className="px-4 py-2.5 text-[11px]">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                        p.resultado?.includes('MAL') ? 'bg-red-50 text-red-700' :
                        p.resultado?.includes('BIEN') ? 'bg-green-50 text-green-700' :
                        'bg-slate-50 text-slate-600'
                      }`}>
                        {isValid(p.resultado) ? p.resultado : '–'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer hint */}
        {points.length > 0 && (
          <div className="shrink-0 px-5 py-2.5 border-t border-slate-100 bg-slate-50">
            <p className="text-[10px] text-slate-400 text-center">Clic en un registro para ver detalle completo</p>
          </div>
        )}
      </div>
    </div>
  )
}
