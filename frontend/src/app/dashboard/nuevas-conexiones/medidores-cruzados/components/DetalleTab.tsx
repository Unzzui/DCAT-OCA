'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react'
import { TextInput } from '@tremor/react'
import { api } from '@/lib/api'
import { formatNumber } from '@/lib/utils'
import { PaginatedResponse, MedidorCruzado } from '@/types'
import { ExportDropdown } from '@/components/ui/ExportDropdown'
import MultiSelect from '@/components/ui/MultiSelect'
import { FilterChip } from '../../components/FilterChip'
import { estadoMedidorColor } from '../helpers'
import type { MCDrillFilter } from '../types'

interface DetalleTabProps {
  drillFilters: MCDrillFilter[]
  setDrillFilters: React.Dispatch<React.SetStateAction<MCDrillFilter[]>>
  zonas: string[]
  comunas: string[]
  inspectors: string[]
  estadosMedidor: string[]
  globalFilters: { zona: string | null; mes: string | null; anio: string | null }
}

const RESULTADO_OPTIONS = [
  'TRABAJO BIEN EJECUTADO',
  'TRABAJO MAL EJECUTADO',
]

function resultadoBadge(resultado: string) {
  const upper = (resultado || '').toUpperCase()
  if (upper.includes('BIEN'))
    return 'bg-green-50 text-green-700'
  if (upper.includes('MAL'))
    return 'bg-red-50 text-red-700'
  return 'bg-slate-100 text-slate-600'
}

function estadoColorClass(color: string): string {
  const map: Record<string, string> = {
    green: 'text-green-700',
    red: 'text-red-700',
    amber: 'text-amber-700',
    slate: 'text-slate-500',
    orange: 'text-orange-700',
    gray: 'text-gray-500',
  }
  return map[color] || 'text-slate-600'
}

export default function DetalleTab({
  drillFilters,
  setDrillFilters,
  zonas,
  comunas,
  inspectors,
  estadosMedidor,
  globalFilters,
}: DetalleTabProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedResultados, setSelectedResultados] = useState<string[]>([])
  const [selectedZonas, setSelectedZonas] = useState<string[]>([])
  const [selectedComunas, setSelectedComunas] = useState<string[]>([])
  const [selectedInspectors, setSelectedInspectors] = useState<string[]>([])
  const [selectedEstados, setSelectedEstados] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [data, setData] = useState<PaginatedResponse<MedidorCruzado> | null>(null)
  const [loading, setLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [exportLoadingFormat, setExportLoadingFormat] = useState<'excel' | 'csv' | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('page', page.toString())
      params.append('limit', '20')

      // Zona: local filter takes precedence over global
      const zonaValues = selectedZonas.length > 0 ? selectedZonas : (globalFilters.zona ? [globalFilters.zona] : [])
      zonaValues.forEach(z => params.append('zona', z))
      if (globalFilters.mes) params.append('mes', globalFilters.mes)
      if (globalFilters.anio) params.append('anio', globalFilters.anio)

      // Local dropdown filters
      selectedComunas.forEach(c => params.append('comuna', c))
      selectedInspectors.forEach(i => params.append('inspector', i))
      selectedEstados.forEach(e => params.append('estado_medidor', e))
      selectedResultados.forEach(r => params.append('resultado', r))

      // Search
      if (searchTerm) params.append('search', searchTerm)

      // Drill filters
      drillFilters.forEach(f => { params.append(f.key, f.value) })

      const res = await api.get<PaginatedResponse<MedidorCruzado>>(
        '/api/v1/medidores-cruzados',
        Object.fromEntries(params),
        { noCache: true }
      )
      setData(res)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [page, searchTerm, selectedResultados, selectedZonas, selectedComunas, selectedInspectors, selectedEstados, drillFilters, globalFilters])

  // Debounced fetch
  useEffect(() => {
    const timer = setTimeout(() => fetchData(), 300)
    return () => clearTimeout(timer)
  }, [fetchData])

  // Reset page on filter change
  useEffect(() => {
    setPage(1)
  }, [searchTerm, selectedResultados, selectedZonas, selectedComunas, selectedInspectors, selectedEstados, drillFilters, globalFilters])

  // Export handler
  const handleExport = useCallback(async (format: 'excel' | 'csv') => {
    setExportLoading(true)
    setExportLoadingFormat(format)
    try {
      const params: Record<string, string | number> = { format }
      const zonaValues = selectedZonas.length > 0 ? selectedZonas : (globalFilters.zona ? [globalFilters.zona] : [])
      if (zonaValues.length > 0) params.zona = zonaValues.join(',')
      if (globalFilters.mes) params.mes = globalFilters.mes
      if (globalFilters.anio) params.anio = globalFilters.anio
      if (selectedComunas.length > 0) params.comuna = selectedComunas.join(',')
      if (selectedInspectors.length > 0) params.inspector = selectedInspectors.join(',')
      if (selectedEstados.length > 0) params.estado_medidor = selectedEstados.join(',')
      if (selectedResultados.length > 0) params.resultado = selectedResultados.join(',')
      if (searchTerm) params.search = searchTerm
      drillFilters.forEach(f => { params[f.key] = f.value })

      await api.downloadFile(
        '/api/v1/medidores-cruzados/export',
        `medidores-cruzados.${format === 'excel' ? 'xlsx' : 'csv'}`,
        params
      )
    } finally {
      setExportLoading(false)
      setExportLoadingFormat(null)
    }
  }, [selectedZonas, selectedComunas, selectedInspectors, selectedEstados, selectedResultados, searchTerm, drillFilters, globalFilters])

  const removeDrillFilter = (key: string) => {
    setDrillFilters(prev => prev.filter(f => f.key !== key))
  }

  const hasActiveFilters = selectedZonas.length > 0 || selectedComunas.length > 0 || selectedInspectors.length > 0 || selectedEstados.length > 0 || selectedResultados.length > 0 || !!searchTerm || drillFilters.length > 0

  const HEADERS = ['Mes', 'Fecha Insp.', 'Num Cliente', 'Dirección', 'Comuna', 'Zona', 'Inspector', 'Estado Medidor', 'Resultado', 'EEPP OCA']

  return (
    <div className="space-y-3 mt-3">
      {/* Filter Bar */}
      <div className="bg-white rounded-lg border border-slate-200/60 shadow-sm px-4 py-2.5 space-y-2">
        {/* Row 1: Filters + Search + Export */}
        <div className="flex flex-wrap items-center gap-2">
          <MultiSelect
            options={zonas}
            selected={selectedZonas}
            onChange={setSelectedZonas}
            placeholder="Todas las zonas"
            className="min-w-[160px]"
          />
          <MultiSelect
            options={comunas}
            selected={selectedComunas}
            onChange={setSelectedComunas}
            placeholder="Todas las comunas"
            className="min-w-[160px]"
          />
          <MultiSelect
            options={inspectors}
            selected={selectedInspectors}
            onChange={setSelectedInspectors}
            placeholder="Todos los inspectores"
            className="min-w-[160px]"
          />
          <MultiSelect
            options={estadosMedidor}
            selected={selectedEstados}
            onChange={setSelectedEstados}
            placeholder="Todos los estados"
            className="min-w-[160px]"
          />
          <MultiSelect
            options={RESULTADO_OPTIONS}
            selected={selectedResultados}
            onChange={setSelectedResultados}
            placeholder="Todos los resultados"
            className="min-w-[160px]"
          />

          <div className="flex-1" />

          <TextInput
            icon={Search}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar cliente, dirección..."
            className="max-w-[220px] text-[11px]"
          />

          <ExportDropdown
            onExport={handleExport}
            loading={exportLoading}
            loadingFormat={exportLoadingFormat}
            totalRecords={data?.total}
            hasFilters={hasActiveFilters}
          />
        </div>

        {/* Row 2: Active drill filter chips */}
        {drillFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
            <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Activos:</span>
            {drillFilters.map(f => (
              <FilterChip key={f.key} filter={f} onRemove={removeDrillFilter} />
            ))}
            <button
              onClick={() => setDrillFilters([])}
              className="text-[10px] text-slate-400 hover:text-slate-600 transition-colors ml-1"
            >
              Limpiar todo
            </button>
          </div>
        )}
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-lg border border-slate-200/60 shadow-sm">
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <h3 className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Registros</h3>
          {data && (
            <span className="text-[10px] text-slate-400">
              {formatNumber(data.total)} reg. — pag. {data.page}/{data.pages}
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 size={20} className="animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr>
                  {HEADERS.map(h => (
                    <th key={h} className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-100 px-3 py-2 text-left font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data?.items?.map((item) => {
                  const resultado = item.resultado_inspeccion || ''
                  const estado = item.estado_medidor || ''
                  const colorKey = estadoMedidorColor(estado)
                  return (
                    <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                      <td className="px-3 py-2.5 text-[11px] text-slate-600 whitespace-nowrap">{item.mes || '\u2013'}</td>
                      <td className="px-3 py-2.5 text-[11px] text-slate-600 whitespace-nowrap">{item.fecha_inspeccion || '\u2013'}</td>
                      <td className="px-3 py-2.5 text-[11px] text-slate-700 font-medium whitespace-nowrap">{item.num_cliente || '\u2013'}</td>
                      <td className="px-3 py-2.5 text-[11px] text-slate-600 max-w-[200px] truncate" title={item.direccion || ''}>{item.direccion || '\u2013'}</td>
                      <td className="px-3 py-2.5 text-[11px] text-slate-600">{item.comuna || '\u2013'}</td>
                      <td className="px-3 py-2.5 text-[11px] text-slate-600">{item.zona || '\u2013'}</td>
                      <td className="px-3 py-2.5 text-[11px] text-slate-600">{item.inspector || '\u2013'}</td>
                      <td className={`px-3 py-2.5 text-[11px] font-medium ${estadoColorClass(colorKey)}`}>{estado || '\u2013'}</td>
                      <td className="px-3 py-2.5 text-[11px]">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${resultadoBadge(resultado)}`}>
                          {resultado || '\u2013'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-slate-600">{item.eepp_oca || '\u2013'}</td>
                    </tr>
                  )
                })}
                {(!data?.items || data.items.length === 0) && (
                  <tr>
                    <td colSpan={HEADERS.length} className="text-center py-8 text-slate-400 text-[11px]">
                      No se encontraron registros
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data && data.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <span className="text-[10px] text-slate-400">
              {formatNumber(data.total)} reg. — pag. {page}/{data.pages}
            </span>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="px-2 py-1 rounded text-[11px] text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft size={13} />
              </button>
              {Array.from({ length: Math.min(7, data.pages) }, (_, i) => {
                const pg = data.pages <= 7
                  ? i + 1
                  : page <= 4
                    ? i + 1
                    : page >= data.pages - 3
                      ? data.pages - 6 + i
                      : page - 3 + i
                return (
                  <button
                    key={pg}
                    onClick={() => setPage(pg)}
                    disabled={loading}
                    className={`w-7 h-7 rounded text-[11px] font-medium transition-colors ${
                      pg === page ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {pg}
                  </button>
                )
              })}
              <button
                onClick={() => setPage(p => Math.min(data.pages, p + 1))}
                disabled={page >= data.pages || loading}
                className="px-2 py-1 rounded text-[11px] text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-colors"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
