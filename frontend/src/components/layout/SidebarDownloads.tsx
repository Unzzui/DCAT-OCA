'use client'

import { useState } from 'react'
import {
  Download,
  X,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Radio,
  SearchX,
  Scissors,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ExportModal } from '@/components/ui/ExportModal'

type ReportType = 'nncc' | 'lecturas' | 'teleco' | 'calidad' | 'corte'

interface Report {
  id: ReportType
  name: string
  shortName: string
  icon: React.ElementType
  enabled: boolean
}

const reports: Report[] = [
  { id: 'nncc', name: 'Nuevas Conexiones', shortName: 'NNCC', icon: ClipboardCheck, enabled: true },
  { id: 'lecturas', name: 'Lecturas', shortName: 'Lecturas', icon: FileText, enabled: true },
  { id: 'teleco', name: 'Telecomunicaciones', shortName: 'Telecom', icon: Radio, enabled: true },
  { id: 'corte', name: 'Corte y Reposición', shortName: 'Corte y Repo.', icon: Scissors, enabled: true },
  { id: 'calidad', name: 'Control de Pérdidas', shortName: 'Ctrl. Pérdidas', icon: SearchX, enabled: true },
]

interface SidebarDownloadsProps {
  isExpanded: boolean
}

export function SidebarDownloads({ isExpanded }: SidebarDownloadsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)

  const handleReportClick = (report: Report) => {
    if (!report.enabled) return
    setSelectedReport(report)
    setIsOpen(false)
  }

  const closeModal = () => {
    setSelectedReport(null)
  }

  return (
    <>
      <div className="relative">
        {/* Trigger */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
            isOpen
              ? 'bg-white/20 text-white'
              : 'text-white/70 hover:bg-white/10 hover:text-white',
            !isExpanded && 'justify-center px-0'
          )}
          title="Exportar Informes"
        >
          <Download size={18} className="shrink-0" />
          {isExpanded && (
            <>
              <span className="flex-1 text-left">Exportar</span>
              <ChevronRight size={14} className={cn('transition-transform', isOpen && 'rotate-90')} />
            </>
          )}
        </button>

        {/* Panel */}
        {isOpen && (
          <>
            {/* Overlay */}
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

            {/* Dropdown */}
            <div
              className={cn(
                'absolute z-50 bottom-0 left-full ml-2 w-56',
                'bg-white rounded-lg shadow-xl border border-gray-100',
                'animate-in fade-in slide-in-from-left-2 duration-150'
              )}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <span className="text-sm font-semibold text-gray-900">Exportar</span>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Reports */}
              <div className="p-1.5">
                {reports.map((report) => (
                  <button
                    key={report.id}
                    onClick={() => handleReportClick(report)}
                    disabled={!report.enabled}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-left transition-colors',
                      report.enabled
                        ? 'hover:bg-gray-50 text-gray-700'
                        : 'opacity-50 cursor-not-allowed text-gray-400'
                    )}
                  >
                    <report.icon size={16} className={report.enabled ? 'text-oca-blue' : 'text-gray-300'} />
                    <span className="text-sm flex-1">{report.shortName}</span>
                    {report.enabled && (
                      <ChevronRight size={14} className="text-gray-300" />
                    )}
                  </button>
                ))}
              </div>

              {/* Footer */}
              <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/50 rounded-b-lg">
                <p className="text-[10px] text-gray-400 text-center">
                  Selecciona un informe para configurar filtros
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Export Modal */}
      {selectedReport && (
        <ExportModal
          isOpen={!!selectedReport}
          onClose={closeModal}
          reportType={selectedReport.id}
          reportName={selectedReport.name}
        />
      )}
    </>
  )
}
