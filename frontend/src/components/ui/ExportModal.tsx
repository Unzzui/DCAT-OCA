'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  X,
  FileSpreadsheet,
  FileText,
  Loader2,
  Check,
  Download,
  Calendar,
  Filter,
  ChevronDown,
  Database,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'

type ReportType = 'nncc' | 'lecturas' | 'teleco' | 'calidad' | 'corte'

interface ExportModalProps {
  isOpen: boolean
  onClose: () => void
  reportType: ReportType
  reportName: string
}

interface FilterOption {
  value: string
  label: string
}

const MESES = [
  { value: '1', label: 'Enero' },
  { value: '2', label: 'Febrero' },
  { value: '3', label: 'Marzo' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Mayo' },
  { value: '6', label: 'Junio' },
  { value: '7', label: 'Julio' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
]

// Componente Select nativo estilizado - Estilo corporativo OCA
interface NativeSelectProps {
  label?: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  options: FilterOption[]
  disabled?: boolean
}

function NativeSelect({ label, placeholder, value, onChange, options, disabled }: NativeSelectProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="text-xs font-medium text-gray-600">{label}</label>
      )}
      <div className="relative group">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={cn(
            'w-full appearance-none bg-white border rounded-lg px-3.5 py-2.5 pr-10 text-sm font-medium',
            'transition-all duration-200 cursor-pointer',
            'border-gray-200 hover:border-oca-blue/50',
            'focus:outline-none focus:ring-2 focus:ring-oca-blue/20 focus:border-oca-blue',
            'disabled:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60',
            value ? 'text-gray-900' : 'text-gray-400'
          )}
        >
          <option value="" className="text-gray-400">{placeholder}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="text-gray-900 font-medium">
              {opt.label}
            </option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <ChevronDown
            size={18}
            className={cn(
              'text-gray-400 transition-colors',
              'group-hover:text-oca-blue group-focus-within:text-oca-blue'
            )}
          />
        </div>
      </div>
    </div>
  )
}

export function ExportModal({ isOpen, onClose, reportType, reportName }: ExportModalProps) {
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [dateRange, setDateRange] = useState<{ from?: string; to?: string }>({})
  const [options, setOptions] = useState<Record<string, FilterOption[]>>({})
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState<'excel' | 'csv' | null>(null)
  const [success, setSuccess] = useState<'excel' | 'csv' | null>(null)
  const [recordCount, setRecordCount] = useState<number | null>(null)
  const [countLoading, setCountLoading] = useState(false)

  // Endpoints para cada tipo de reporte
  const dataEndpoints: Record<ReportType, string> = {
    nncc: '/api/v1/nuevas-conexiones',
    lecturas: '/api/v1/lecturas',
    teleco: '/api/v1/teleco',
    calidad: '/api/v1/calidad',
    corte: '/api/v1/corte',
  }

  // Obtener conteo de registros
  const fetchRecordCount = useCallback(async () => {
    setCountLoading(true)
    try {
      const params: Record<string, string | number> = { limit: 1, page: 1 }

      // Agregar filtros
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params[key] = value
      })

      if (dateRange.from) params.fecha_desde = dateRange.from
      if (dateRange.to) params.fecha_hasta = dateRange.to

      const queryString = new URLSearchParams(
        Object.entries(params).map(([k, v]) => [k, String(v)])
      ).toString()

      interface PaginatedResponse {
        total: number
        items: unknown[]
      }

      const response = await api.get<PaginatedResponse>(
        `${dataEndpoints[reportType]}?${queryString}`
      )

      setRecordCount(response.total)
    } catch (error) {
      console.error('Error fetching count:', error)
      setRecordCount(null)
    } finally {
      setCountLoading(false)
    }
  }, [filters, dateRange, reportType])

  // Cargar opciones de filtros
  useEffect(() => {
    if (!isOpen) return

    const loadOptions = async () => {
      setLoading(true)
      const newOptions: Record<string, FilterOption[]> = {}

      try {
        interface PeriodosResponse { meses: number[]; anios: number[] }

        if (reportType === 'nncc') {
          const [zonas, bases, periodos] = await Promise.all([
            api.get<string[]>('/api/v1/nuevas-conexiones/zonas').catch(() => []),
            api.get<string[]>('/api/v1/nuevas-conexiones/bases').catch(() => []),
            api.get<PeriodosResponse>('/api/v1/nuevas-conexiones/periodos').catch(() => ({ meses: [], anios: [] })),
          ])
          newOptions.zona = (zonas as string[]).map(z => ({ value: z, label: z }))
          newOptions.base = (bases as string[]).map(b => ({ value: b, label: b }))
          newOptions.anio = (periodos.anios || []).map(a => ({ value: String(a), label: String(a) }))
        }

        if (reportType === 'lecturas') {
          const [sectores, periodos] = await Promise.all([
            api.get<string[]>('/api/v1/lecturas/sectores').catch(() => []),
            api.get<PeriodosResponse>('/api/v1/lecturas/periodos').catch(() => ({ meses: [], anios: [] })),
          ])
          newOptions.sector = (sectores as string[]).map(s => ({ value: s, label: s }))
          newOptions.origen = [
            { value: 'ORDENES', label: 'Órdenes' },
            { value: 'SEC', label: 'SEC' },
            { value: 'VISITA VIRTUAL', label: 'Visita Virtual' },
          ]
          newOptions.anio = (periodos.anios || []).map(a => ({ value: String(a), label: String(a) }))
        }

        if (reportType === 'teleco') {
          const [empresas, comunas, periodos] = await Promise.all([
            api.get<Array<{ empresa: string }>>('/api/v1/teleco/empresas').catch(() => []),
            api.get<string[]>('/api/v1/teleco/comunas').catch(() => []),
            api.get<PeriodosResponse>('/api/v1/teleco/periodos').catch(() => ({ meses: [], anios: [] })),
          ])
          newOptions.empresa = (empresas as Array<{ empresa: string }>).map(e => ({ value: e.empresa, label: e.empresa }))
          newOptions.comuna = (comunas as string[]).slice(0, 50).map(c => ({ value: c, label: c }))
          newOptions.resultado = [
            { value: 'APROBADO', label: 'Aprobado' },
            { value: 'RECHAZADO', label: 'Rechazado' },
          ]
          newOptions.anio = (periodos.anios || []).map(a => ({ value: String(a), label: String(a) }))
        }

        if (reportType === 'calidad') {
          const [contratistas, comunas, periodos] = await Promise.all([
            api.get<string[]>('/api/v1/calidad/contratistas').catch(() => []),
            api.get<string[]>('/api/v1/calidad/comunas').catch(() => []),
            api.get<PeriodosResponse>('/api/v1/calidad/periodos').catch(() => ({ meses: [], anios: [] })),
          ])
          newOptions.contratista = (contratistas as string[]).map(c => ({ value: c, label: c }))
          newOptions.comuna = (comunas as string[]).map(c => ({ value: c, label: c }))
          newOptions.tipo_sistema = [
            { value: 'MONOFASICO', label: 'Monofásico' },
            { value: 'TRIFASICO', label: 'Trifásico' },
          ]
          newOptions.anio = (periodos.anios || []).map(a => ({ value: String(a), label: String(a) }))
        }

        if (reportType === 'corte') {
          const [zonas, centros, comunas, situaciones, periodos] = await Promise.all([
            api.get<string[]>('/api/v1/corte/zonas').catch(() => []),
            api.get<string[]>('/api/v1/corte/centros-operativos').catch(() => []),
            api.get<string[]>('/api/v1/corte/comunas').catch(() => []),
            api.get<string[]>('/api/v1/corte/situaciones').catch(() => []),
            api.get<PeriodosResponse>('/api/v1/corte/periodos').catch(() => ({ meses: [], anios: [] })),
          ])
          newOptions.zona = (zonas as string[]).map(z => ({ value: z, label: z }))
          newOptions.centro_operativo = (centros as string[]).map(c => ({ value: c, label: c }))
          newOptions.comuna = (comunas as string[]).slice(0, 50).map(c => ({ value: c, label: c }))
          newOptions.situacion_encontrada = (situaciones as string[]).slice(0, 20).map(s => ({ value: s, label: s }))
          newOptions.anio = (periodos.anios || []).map(a => ({ value: String(a), label: String(a) }))
        }
      } catch (error) {
        console.error('Error loading options:', error)
      }

      setOptions(newOptions)
      setLoading(false)
    }

    loadOptions()
  }, [isOpen, reportType])

  // Cargar conteo inicial y cuando cambien filtros
  useEffect(() => {
    if (!isOpen || loading) return

    const timer = setTimeout(() => {
      fetchRecordCount()
    }, 300) // Debounce

    return () => clearTimeout(timer)
  }, [isOpen, loading, filters, dateRange, fetchRecordCount])

  // Reset al cerrar
  useEffect(() => {
    if (!isOpen) {
      setFilters({})
      setDateRange({})
      setSuccess(null)
      setRecordCount(null)
    }
  }, [isOpen])

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const handleDownload = async (format: 'excel' | 'csv') => {
    setDownloading(format)

    try {
      const endpoints: Record<ReportType, string> = {
        nncc: '/api/v1/nuevas-conexiones/export',
        lecturas: '/api/v1/lecturas/export',
        teleco: '/api/v1/teleco/export',
        calidad: '/api/v1/calidad/export',
        corte: '/api/v1/corte/export',
      }

      const params: Record<string, string | number | boolean | undefined> = {
        format,
        ...filters,
      }

      if (dateRange.from) params.fecha_desde = dateRange.from
      if (dateRange.to) params.fecha_hasta = dateRange.to

      // Limpiar valores vacíos
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === undefined) {
          delete params[key]
        }
      })

      const date = new Date().toISOString().split('T')[0]
      const ext = format === 'excel' ? 'xlsx' : 'csv'
      const filename = `${reportType}_${date}.${ext}`

      await api.downloadFile(endpoints[reportType], filename, params)

      setSuccess(format)
      setTimeout(() => {
        setSuccess(null)
        onClose()
      }, 1500)
    } catch (error) {
      console.error('Error downloading:', error)
    } finally {
      setDownloading(null)
    }
  }

  const clearFilters = () => {
    setFilters({})
    setDateRange({})
  }

  const hasFilters = Object.values(filters).some(v => v) || dateRange.from || dateRange.to
  const activeFiltersCount = Object.values(filters).filter(v => v).length +
    (dateRange.from ? 1 : 0) + (dateRange.to ? 1 : 0)

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-in fade-in zoom-in-95 duration-200 pointer-events-auto overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-oca-blue to-oca-blue-dark px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-white/20 backdrop-blur rounded-xl">
                  <Download size={22} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">Exportar {reportName}</h3>
                  <p className="text-white/70 text-sm">Configura los filtros de exportación</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Record Count Badge */}
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database size={16} className="text-oca-blue" />
                <span className="text-sm text-gray-600">Registros a exportar:</span>
              </div>
              <div className="flex items-center gap-2">
                {countLoading ? (
                  <Loader2 size={16} className="animate-spin text-oca-blue" />
                ) : recordCount !== null ? (
                  <span className="px-3 py-1 bg-oca-blue text-white text-sm font-bold rounded-full">
                    {recordCount.toLocaleString('es-CL')}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-sm text-amber-600">
                    <AlertCircle size={14} />
                    Error
                  </span>
                )}
                {hasFilters && (
                  <span className="px-2 py-0.5 bg-oca-blue-lighter text-oca-blue text-xs font-medium rounded-full">
                    {activeFiltersCount} filtro{activeFiltersCount !== 1 ? 's' : ''} activo{activeFiltersCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-5 max-h-[50vh] overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-oca-blue" />
                <p className="text-sm text-gray-500">Cargando filtros...</p>
              </div>
            ) : (
              <>
                {/* Sección de Periodo */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-4 bg-oca-blue rounded-full" />
                      <span className="text-sm font-semibold text-gray-700">Periodo</span>
                    </div>
                    {hasFilters && (
                      <button
                        onClick={clearFilters}
                        className="text-xs font-medium text-oca-red hover:text-oca-red-dark transition-colors"
                      >
                        Limpiar filtros
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {options.anio && options.anio.length > 0 && (
                      <NativeSelect
                        placeholder="Seleccionar año"
                        value={filters.anio || ''}
                        onChange={v => handleFilterChange('anio', v)}
                        options={options.anio}
                      />
                    )}
                    <NativeSelect
                      placeholder="Seleccionar mes"
                      value={filters.mes || ''}
                      onChange={v => handleFilterChange('mes', v)}
                      options={MESES}
                    />
                  </div>
                </div>

                {/* Filtros específicos por tipo */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 bg-oca-blue rounded-full" />
                    <span className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                      <Filter size={14} />
                      Filtros adicionales
                    </span>
                  </div>

                  {/* NNCC */}
                  {reportType === 'nncc' && (
                    <div className="grid grid-cols-2 gap-3">
                      {options.zona && options.zona.length > 0 && (
                        <NativeSelect
                          placeholder="Todas las zonas"
                          value={filters.zona || ''}
                          onChange={v => handleFilterChange('zona', v)}
                          options={options.zona}
                        />
                      )}
                      {options.base && options.base.length > 0 && (
                        <NativeSelect
                          placeholder="Todas las bases"
                          value={filters.base || ''}
                          onChange={v => handleFilterChange('base', v)}
                          options={options.base}
                        />
                      )}
                    </div>
                  )}

                  {/* Lecturas */}
                  {reportType === 'lecturas' && (
                    <div className="grid grid-cols-2 gap-3">
                      {options.sector && options.sector.length > 0 && (
                        <NativeSelect
                          placeholder="Todos los sectores"
                          value={filters.sector || ''}
                          onChange={v => handleFilterChange('sector', v)}
                          options={options.sector}
                        />
                      )}
                      {options.origen && (
                        <NativeSelect
                          placeholder="Todos los orígenes"
                          value={filters.origen || ''}
                          onChange={v => handleFilterChange('origen', v)}
                          options={options.origen}
                        />
                      )}
                    </div>
                  )}

                  {/* Teleco */}
                  {reportType === 'teleco' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        {options.empresa && options.empresa.length > 0 && (
                          <NativeSelect
                            placeholder="Todas las empresas"
                            value={filters.empresa || ''}
                            onChange={v => handleFilterChange('empresa', v)}
                            options={options.empresa}
                          />
                        )}
                        {options.resultado && (
                          <NativeSelect
                            placeholder="Todos los resultados"
                            value={filters.resultado || ''}
                            onChange={v => handleFilterChange('resultado', v)}
                            options={options.resultado}
                          />
                        )}
                      </div>
                      {options.comuna && options.comuna.length > 0 && (
                        <NativeSelect
                          placeholder="Todas las comunas"
                          value={filters.comuna || ''}
                          onChange={v => handleFilterChange('comuna', v)}
                          options={options.comuna}
                        />
                      )}
                    </div>
                  )}

                  {/* Calidad */}
                  {reportType === 'calidad' && (
                    <div className="space-y-3">
                      {options.tipo_sistema && (
                        <NativeSelect
                          placeholder="Todos los sistemas"
                          value={filters.tipo_sistema || ''}
                          onChange={v => handleFilterChange('tipo_sistema', v)}
                          options={options.tipo_sistema}
                        />
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        {options.contratista && options.contratista.length > 0 && (
                          <NativeSelect
                            placeholder="Todos los contratistas"
                            value={filters.contratista || ''}
                            onChange={v => handleFilterChange('contratista', v)}
                            options={options.contratista}
                          />
                        )}
                        {options.comuna && options.comuna.length > 0 && (
                          <NativeSelect
                            placeholder="Todas las comunas"
                            value={filters.comuna || ''}
                            onChange={v => handleFilterChange('comuna', v)}
                            options={options.comuna}
                          />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Corte y Reposicion */}
                  {reportType === 'corte' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        {options.zona && options.zona.length > 0 && (
                          <NativeSelect
                            placeholder="Todas las zonas"
                            value={filters.zona || ''}
                            onChange={v => handleFilterChange('zona', v)}
                            options={options.zona}
                          />
                        )}
                        {options.centro_operativo && options.centro_operativo.length > 0 && (
                          <NativeSelect
                            placeholder="Todos los centros"
                            value={filters.centro_operativo || ''}
                            onChange={v => handleFilterChange('centro_operativo', v)}
                            options={options.centro_operativo}
                          />
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {options.comuna && options.comuna.length > 0 && (
                          <NativeSelect
                            placeholder="Todas las comunas"
                            value={filters.comuna || ''}
                            onChange={v => handleFilterChange('comuna', v)}
                            options={options.comuna}
                          />
                        )}
                        {options.situacion_encontrada && options.situacion_encontrada.length > 0 && (
                          <NativeSelect
                            placeholder="Todas las situaciones"
                            value={filters.situacion_encontrada || ''}
                            onChange={v => handleFilterChange('situacion_encontrada', v)}
                            options={options.situacion_encontrada}
                          />
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Rango de fechas */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 bg-oca-blue rounded-full" />
                    <span className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                      <Calendar size={14} />
                      Rango de fechas
                    </span>
                    <span className="text-xs text-gray-400">(opcional)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-500">Desde</label>
                      <input
                        type="date"
                        value={dateRange.from || ''}
                        onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                        className="w-full bg-white border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-oca-blue/20 focus:border-oca-blue hover:border-oca-blue/50 transition-all cursor-pointer"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-500">Hasta</label>
                      <input
                        type="date"
                        value={dateRange.to || ''}
                        onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                        className="w-full bg-white border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-oca-blue/20 focus:border-oca-blue hover:border-oca-blue/50 transition-all cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
            <div className="flex gap-3">
              <button
                onClick={() => handleDownload('excel')}
                disabled={!!downloading || loading || recordCount === 0}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2.5 py-3 rounded-xl font-semibold text-sm transition-all',
                  success === 'excel'
                    ? 'bg-emerald-500 text-white scale-[0.98]'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/40',
                  (downloading || loading || recordCount === 0) && 'opacity-50 cursor-not-allowed shadow-none'
                )}
              >
                {downloading === 'excel' ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : success === 'excel' ? (
                  <Check size={18} />
                ) : (
                  <FileSpreadsheet size={18} />
                )}
                <span>{success === 'excel' ? 'Descargado!' : 'Excel (.xlsx)'}</span>
              </button>

              <button
                onClick={() => handleDownload('csv')}
                disabled={!!downloading || loading || recordCount === 0}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2.5 py-3 rounded-xl font-semibold text-sm transition-all',
                  success === 'csv'
                    ? 'bg-emerald-500 text-white scale-[0.98]'
                    : 'bg-oca-blue hover:bg-oca-blue-dark text-white shadow-lg shadow-oca-blue/25 hover:shadow-oca-blue/40',
                  (downloading || loading || recordCount === 0) && 'opacity-50 cursor-not-allowed shadow-none'
                )}
              >
                {downloading === 'csv' ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : success === 'csv' ? (
                  <Check size={18} />
                ) : (
                  <FileText size={18} />
                )}
                <span>{success === 'csv' ? 'Descargado!' : 'CSV (.csv)'}</span>
              </button>
            </div>

            {recordCount === 0 && (
              <p className="text-center text-xs text-amber-600 mt-3 flex items-center justify-center gap-1">
                <AlertCircle size={12} />
                No hay registros que coincidan con los filtros seleccionados
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
