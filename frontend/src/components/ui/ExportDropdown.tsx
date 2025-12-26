'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Download,
  FileSpreadsheet,
  FileText,
  ChevronDown,
  Loader2,
  Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ExportDropdownProps {
  onExport: (format: 'excel' | 'csv') => Promise<void>
  disabled?: boolean
  loading?: boolean
  loadingFormat?: 'excel' | 'csv' | null
  totalRecords?: number
  hasFilters?: boolean
}

export function ExportDropdown({
  onExport,
  disabled = false,
  loading = false,
  loadingFormat = null,
  totalRecords,
  hasFilters = false,
}: ExportDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [success, setSuccess] = useState<'excel' | 'csv' | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleExport = async (format: 'excel' | 'csv') => {
    try {
      await onExport(format)
      setSuccess(format)
      setTimeout(() => {
        setSuccess(null)
        setIsOpen(false)
      }, 1500)
    } catch (error) {
      console.error('Export error:', error)
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || loading}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all',
          'bg-oca-blue text-white hover:bg-oca-blue-dark',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          isOpen && 'ring-2 ring-oca-blue/30'
        )}
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Download size={16} />
        )}
        <span>Exportar</span>
        <ChevronDown size={14} className={cn('transition-transform', isOpen && 'rotate-180')} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-100 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header con info */}
          {(totalRecords !== undefined || hasFilters) && (
            <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/50 rounded-t-lg">
              <p className="text-xs text-gray-500">
                {hasFilters ? (
                  <>Exportar <span className="font-medium text-oca-blue">{totalRecords?.toLocaleString('es-CL')}</span> registros filtrados</>
                ) : (
                  <>Exportar <span className="font-medium">{totalRecords?.toLocaleString('es-CL')}</span> registros</>
                )}
              </p>
            </div>
          )}

          {/* Options */}
          <div className="p-1.5">
            {/* Excel Option */}
            <button
              onClick={() => handleExport('excel')}
              disabled={loading}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-left',
                success === 'excel'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'hover:bg-gray-50 text-gray-700',
                loading && 'opacity-50 cursor-not-allowed'
              )}
            >
              <div className={cn(
                'p-1.5 rounded',
                success === 'excel' ? 'bg-emerald-100' : 'bg-emerald-50'
              )}>
                {loadingFormat === 'excel' ? (
                  <Loader2 size={16} className="text-emerald-600 animate-spin" />
                ) : success === 'excel' ? (
                  <Check size={16} className="text-emerald-600" />
                ) : (
                  <FileSpreadsheet size={16} className="text-emerald-600" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {success === 'excel' ? 'Descargado' : 'Excel (.xlsx)'}
                </p>
                <p className="text-xs text-gray-400">Formato Microsoft Excel</p>
              </div>
            </button>

            {/* CSV Option */}
            <button
              onClick={() => handleExport('csv')}
              disabled={loading}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-left',
                success === 'csv'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'hover:bg-gray-50 text-gray-700',
                loading && 'opacity-50 cursor-not-allowed'
              )}
            >
              <div className={cn(
                'p-1.5 rounded',
                success === 'csv' ? 'bg-emerald-100' : 'bg-blue-50'
              )}>
                {loadingFormat === 'csv' ? (
                  <Loader2 size={16} className="text-oca-blue animate-spin" />
                ) : success === 'csv' ? (
                  <Check size={16} className="text-emerald-600" />
                ) : (
                  <FileText size={16} className="text-oca-blue" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {success === 'csv' ? 'Descargado' : 'CSV (.csv)'}
                </p>
                <p className="text-xs text-gray-400">Valores separados por coma</p>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
