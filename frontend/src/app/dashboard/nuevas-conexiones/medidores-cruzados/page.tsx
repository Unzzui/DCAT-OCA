'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Loader2, RefreshCw, AlertTriangle } from 'lucide-react'
import { Select, SelectItem, Tab, TabGroup, TabList, TabPanel, TabPanels } from '@tremor/react'
import { Header } from '@/components/layout/Header'
import { api } from '@/lib/api'
import type { MCDashboardData, MCDrillFilter } from './types'
import ResumenTab from './components/ResumenTab'
import InspectoresTab from './components/InspectoresTab'
import OperacionalTab from './components/OperacionalTab'
import DetalleTab from './components/DetalleTab'

const MESES: Record<number, string> = {
  1: 'ENERO', 2: 'FEBRERO', 3: 'MARZO', 4: 'ABRIL', 5: 'MAYO', 6: 'JUNIO',
  7: 'JULIO', 8: 'AGOSTO', 9: 'SEPTIEMBRE', 10: 'OCTUBRE', 11: 'NOVIEMBRE', 12: 'DICIEMBRE',
}

interface Periodos {
  meses: number[]
  anios: number[]
  ultimo_mes: number | null
  ultimo_anio: number | null
  meses_por_anio: Record<string, number[]>
}

export default function MedidoresCruzadosPage() {
  const [activeTab, setActiveTab] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dashboardData, setDashboardData] = useState<MCDashboardData | null>(null)
  const [selectedZona, setSelectedZona] = useState<string | null>(null)
  const [drillFilters, setDrillFilters] = useState<MCDrillFilter[]>([])

  // Global filters
  const [globalMes, setGlobalMes] = useState('')
  const [globalAnio, setGlobalAnio] = useState('')
  const [globalZona, setGlobalZona] = useState('')

  // Filter options
  const [zonas, setZonas] = useState<string[]>([])
  const [comunas, setComunas] = useState<string[]>([])
  const [inspectors, setInspectors] = useState<string[]>([])
  const [estadosMedidor, setEstadosMedidor] = useState<string[]>([])
  const [periodos, setPeriodos] = useState<Periodos>({
    meses: [], anios: [], ultimo_mes: null, ultimo_anio: null, meses_por_anio: {},
  })

  // Meses disponibles segun el año seleccionado
  const availableMeses = useMemo(() => {
    if (!globalAnio) return periodos.meses
    return periodos.meses_por_anio[globalAnio] || []
  }, [globalAnio, periodos.meses, periodos.meses_por_anio])

  // Si el mes seleccionado no existe en el año, limpiar
  useEffect(() => {
    if (globalMes && globalAnio) {
      const mesNum = Object.entries(MESES).find(([, v]) => v === globalMes)?.[0]
      if (mesNum && !availableMeses.includes(Number(mesNum))) {
        setGlobalMes('')
      }
    }
  }, [globalAnio, globalMes, availableMeses])

  // Load filter options on mount
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const [z, c, i, e, p] = await Promise.all([
          api.get<string[]>('/api/v1/medidores-cruzados/zonas'),
          api.get<string[]>('/api/v1/medidores-cruzados/comunas'),
          api.get<Array<{ inspector: string }>>('/api/v1/medidores-cruzados/inspectors'),
          api.get<string[]>('/api/v1/medidores-cruzados/estados-medidor'),
          api.get<Periodos>('/api/v1/medidores-cruzados/periodos'),
        ])
        setZonas(z)
        setComunas(c)
        setInspectors(i.map((x) => x.inspector))
        setEstadosMedidor(e)
        setPeriodos(p)
        // Default: consolidado 2025 (todos los meses)
        setGlobalAnio(p.anios.includes(2025) ? '2025' : String(p.ultimo_anio || ''))
      } catch (err) {
        console.error('Error loading filters:', err)
      }
    }
    loadFilters()
  }, [])

  // Load dashboard data when filters change
  const fetchDashboard = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, string> = {}
      if (globalZona) params.zona = globalZona
      if (globalMes) params.mes = globalMes
      if (globalAnio) params.anio = globalAnio
      const data = await api.get<MCDashboardData>('/api/v1/medidores-cruzados/dashboard/all', params)
      setDashboardData(data)
    } catch (err) {
      setError('Error al cargar los datos del dashboard')
      console.error('Error fetching dashboard:', err)
    } finally {
      setLoading(false)
    }
  }, [globalZona, globalMes, globalAnio])

  useEffect(() => {
    if (periodos.ultimo_anio) fetchDashboard()
  }, [fetchDashboard, periodos.ultimo_anio])

  // Drill-through handler
  const addDrillFilter = useCallback((key: string, label: string, value: string) => {
    setDrillFilters((prev) => {
      const existing = prev.find((f) => f.key === key)
      return existing
        ? prev.map((f) => (f.key === key ? { key, label, value } : f))
        : [...prev, { key, label, value }]
    })
    setActiveTab(3)
  }, [])

  return (
    <div className="flex flex-col min-h-screen bg-slate-50/80">
      <Header title="Medidores Cruzados" subtitle="Dashboard de inspecciones y estado de medidores" />

      <main className="flex-1 px-4 py-3 space-y-3 max-w-[1600px] mx-auto w-full">
        {/* Global filter bar */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Año</span>
            <div className="w-40">
              <Select value={globalAnio} onValueChange={setGlobalAnio} placeholder="Todos los años">
                <SelectItem value="">Todos los años</SelectItem>
                {periodos.anios.map((a) => (
                  <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Mes</span>
            <div className="w-48">
              <Select value={globalMes} onValueChange={setGlobalMes} placeholder="Todos los meses">
                <SelectItem value="">Todos los meses</SelectItem>
                {availableMeses.map((m) => (
                  <SelectItem key={m} value={MESES[m]}>{MESES[m]}</SelectItem>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Zona</span>
            <div className="w-48">
              <Select value={globalZona} onValueChange={setGlobalZona} placeholder="Todas las zonas">
                <SelectItem value="">Todas las zonas</SelectItem>
                {zonas.map((z) => (
                  <SelectItem key={z} value={z}>{z}</SelectItem>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex-1" />

          <button
            onClick={() => { api.clearCache(); fetchDashboard() }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-white border border-transparent hover:border-slate-200 transition-all"
          >
            <RefreshCw size={13} /> Actualizar
          </button>
        </div>

        {/* Tabs */}
        <TabGroup index={activeTab} onIndexChange={setActiveTab}>
          <TabList className="mb-0 border-b border-slate-200">
            <Tab>Resumen Ejecutivo</Tab>
            <Tab>Inspectores</Tab>
            <Tab>Análisis Operacional</Tab>
            <Tab>Detalle</Tab>
          </TabList>

          <TabPanels>
            <TabPanel>
              {activeTab !== 0 ? null : loading ? (
                <div className="flex items-center justify-center h-48"><Loader2 size={24} className="animate-spin text-slate-400" /></div>
              ) : error ? (
                <div className="bg-white rounded-lg border border-slate-200 p-8 text-center mt-3">
                  <AlertTriangle size={24} className="mx-auto text-red-500 mb-2" />
                  <p className="text-sm text-slate-600 font-medium">{error}</p>
                  <button onClick={fetchDashboard} className="mt-3 px-4 py-1.5 rounded-md text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors">Reintentar</button>
                </div>
              ) : dashboardData ? (
                <div className="mt-3">
                  <ResumenTab data={dashboardData.overview} selectedZona={selectedZona} setSelectedZona={setSelectedZona} />
                </div>
              ) : null}
            </TabPanel>

            <TabPanel>
              {activeTab !== 1 ? null : loading ? (
                <div className="flex items-center justify-center h-48"><Loader2 size={24} className="animate-spin text-slate-400" /></div>
              ) : dashboardData ? (
                <div className="mt-3">
                  <InspectoresTab data={dashboardData.inspectores} overview={dashboardData.overview} addDrillFilter={addDrillFilter} />
                </div>
              ) : null}
            </TabPanel>

            <TabPanel>
              {activeTab !== 2 ? null : loading ? (
                <div className="flex items-center justify-center h-48"><Loader2 size={24} className="animate-spin text-slate-400" /></div>
              ) : dashboardData ? (
                <div className="mt-3">
                  <OperacionalTab data={dashboardData.operacional} />
                </div>
              ) : null}
            </TabPanel>

            <TabPanel>
              {activeTab !== 3 ? null : (
                <DetalleTab
                  drillFilters={drillFilters}
                  setDrillFilters={setDrillFilters}
                  zonas={zonas}
                  comunas={comunas}
                  inspectors={inspectors}
                  estadosMedidor={estadosMedidor}
                  globalFilters={{ zona: globalZona || null, mes: globalMes || null, anio: globalAnio || null }}
                />
              )}
            </TabPanel>
          </TabPanels>
        </TabGroup>
      </main>
    </div>
  )
}
