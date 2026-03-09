'use client'

import { Loader2, FileSpreadsheet, FileText } from 'lucide-react'

interface ExportOverlayProps {
  isVisible: boolean
  format: 'excel' | 'csv'
  recordCount?: number
  hasFilters?: boolean
}

export function ExportOverlay({ isVisible, format, recordCount, hasFilters }: ExportOverlayProps) {
  if (!isVisible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30">
      <div className="bg-white rounded-xl shadow-lg border border-slate-200/60 p-8 max-w-md mx-4 text-center">
        <div className="relative mx-auto w-16 h-16 mb-4">
          {format === 'excel' ? (
            <FileSpreadsheet className="w-16 h-16 text-slate-500" />
          ) : (
            <FileText className="w-16 h-16 text-slate-500" />
          )}
          <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1">
            <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
          </div>
        </div>

        <h3 className="text-lg font-semibold text-slate-900 mb-2">
          Generando archivo {format === 'excel' ? 'Excel' : 'CSV'}
        </h3>

        <p className="text-sm text-slate-500 mb-4">
          {hasFilters ? (
            <>Exportando datos filtrados</>
          ) : (
            <>Exportando todos los datos</>
          )}
          {recordCount !== undefined && recordCount > 0 && (
            <span className="block mt-1 font-medium text-slate-700">
              {recordCount.toLocaleString('es-CL')} registros
            </span>
          )}
        </p>

        <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Esto puede tomar unos segundos...</span>
        </div>
      </div>
    </div>
  )
}
