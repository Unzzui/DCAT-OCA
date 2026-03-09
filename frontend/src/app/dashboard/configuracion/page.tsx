'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'

interface Setting {
  key: string
  value: string
  description: string
  category: string
}

const categoryLabels: Record<string, string> = {
  telecomunicaciones: 'Telecomunicaciones',
  nuevas_conexiones: 'Nuevas Conexiones',
  lecturas: 'Lecturas',
  control_perdidas: 'Control de Perdidas',
  corte_reposicion: 'Corte y Reposicion',
  general: 'General',
}

const categoryOrder = ['telecomunicaciones', 'nuevas_conexiones', 'lecturas', 'control_perdidas', 'corte_reposicion', 'general']

// Tabs: fechas de envio + each settings category
const TAB_FECHAS = 'fechas_envio'

export default function ConfiguracionPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [settings, setSettings] = useState<Setting[]>([])
  const [editedValues, setEditedValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [fechasEnvio, setFechasEnvio] = useState<Record<string, string>>({})
  const [editedFechas, setEditedFechas] = useState<Record<string, string>>({})
  const [nnccBases, setNnccBases] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState(TAB_FECHAS)

  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.push('/dashboard')
    }
  }, [user, router])

  const fetchSettings = useCallback(async () => {
    try {
      const data = await api.get<Setting[]>('/api/v1/settings')
      setSettings(data)
      const initial: Record<string, string> = {}
      data.forEach(s => { initial[s.key] = s.value })
      setEditedValues(initial)
    } catch {
      setError('Error al cargar configuraciones')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  const fetchFechasEnvio = useCallback(async () => {
    try {
      const [fechas, bases] = await Promise.all([
        api.get<Record<string, string>>('/api/v1/settings/fechas-envio-base'),
        api.get<string[]>('/api/v1/nuevas-conexiones/dashboard/bases'),
      ])
      setFechasEnvio(fechas)
      setEditedFechas(fechas)
      setNnccBases(bases)
    } catch {
      console.error('Error fetching fechas envio')
    }
  }, [])

  useEffect(() => { fetchFechasEnvio() }, [fetchFechasEnvio])

  const handleValueChange = (key: string, value: string) => {
    setEditedValues(prev => ({ ...prev, [key]: value }))
  }

  const hasChanges = () => {
    const settingsChanged = settings.some(s => editedValues[s.key] !== s.value)
    const fechasChanged = nnccBases.some(b => (editedFechas[b] || '') !== (fechasEnvio[b] || ''))
    return settingsChanged || fechasChanged
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const changedSettings: Record<string, string> = {}
      settings.forEach(s => {
        if (editedValues[s.key] !== s.value) {
          changedSettings[s.key] = editedValues[s.key]
        }
      })

      const changedFechas: Record<string, string> = {}
      nnccBases.forEach(b => {
        if ((editedFechas[b] || '') !== (fechasEnvio[b] || '')) {
          changedFechas[b] = editedFechas[b] || ''
        }
      })

      if (Object.keys(changedSettings).length === 0 && Object.keys(changedFechas).length === 0) {
        setSuccess('No hay cambios para guardar')
        setTimeout(() => setSuccess(''), 3000)
        return
      }

      if (Object.keys(changedSettings).length > 0) {
        await api.put('/api/v1/settings', { settings: changedSettings })
        fetchSettings()
      }

      if (Object.keys(changedFechas).length > 0) {
        await api.put('/api/v1/settings/fechas-envio-base', { fechas: changedFechas })
        fetchFechasEnvio()
      }

      setSuccess('Configuraciones guardadas exitosamente')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al guardar'
      setError(message)
      setTimeout(() => setError(''), 5000)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (!confirm('Esto restaurara todas las configuraciones a sus valores por defecto. Continuar?')) {
      return
    }

    setSaving(true)
    setError('')

    try {
      await api.post('/api/v1/settings/reset')
      setSuccess('Configuraciones restauradas')
      fetchSettings()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al restaurar'
      setError(message)
      setTimeout(() => setError(''), 5000)
    } finally {
      setSaving(false)
    }
  }

  const groupedSettings = categoryOrder.map(cat => ({
    category: cat,
    settings: settings.filter(s => s.category === cat)
  })).filter(g => g.settings.length > 0)

  // Build tabs list
  const tabs = [
    ...(nnccBases.length > 0 ? [{ key: TAB_FECHAS, label: 'Fechas de Envio' }] : []),
    ...groupedSettings.map(g => ({ key: g.category, label: categoryLabels[g.category] || g.category })),
  ]

  if (user?.role !== 'admin') return null

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-oca-blue border-t-transparent mx-auto"></div>
          <p className="mt-3 text-sm text-gray-500">Cargando configuraciones...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Configuracion" subtitle="Ajustes del sistema" />

      <div className="p-6">
        {/* Messages */}
        {success && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-md">
            <span className="text-sm text-emerald-700">{success}</span>
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex justify-end gap-2 mb-6">
          <button
            onClick={handleReset}
            disabled={saving}
            className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            Restaurar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges()}
            className="px-4 py-2 text-sm font-medium text-white bg-slate-800 rounded-md hover:bg-slate-700 disabled:opacity-40 transition-colors"
          >
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>

        {/* Tabs + Content */}
        <div className="bg-white rounded-lg border border-slate-200/60 shadow-sm">
          {/* Tab bar */}
          <div className="border-b border-slate-200/60 px-1">
            <nav className="flex gap-0 overflow-x-auto">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-3 text-[11px] font-medium uppercase tracking-wider whitespace-nowrap border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? 'border-slate-800 text-slate-800'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab content */}
          <div className="p-5">
            {/* Fechas de Envio tab */}
            {activeTab === TAB_FECHAS && nnccBases.length > 0 && (
              <div>
                <p className="text-[11px] text-slate-400 mb-5">
                  Fecha en que se envio cada base de NNCC. Se usa para calcular los dias de ejecucion en el dashboard.
                </p>
                <div className="space-y-0 divide-y divide-slate-100">
                  {nnccBases.map(base => (
                    <div key={base} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                      <span className="text-sm text-slate-700">{base}</span>
                      <input
                        type="date"
                        value={editedFechas[base] || ''}
                        onChange={(e) => setEditedFechas(prev => ({ ...prev, [base]: e.target.value }))}
                        className={`w-40 px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-300/50 focus:border-slate-400 transition-colors ${
                          (editedFechas[base] || '') !== (fechasEnvio[base] || '')
                            ? 'border-amber-400 bg-amber-50/50'
                            : 'border-slate-200'
                        }`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Settings category tabs */}
            {groupedSettings.map(group => (
              activeTab === group.category && (
                <div key={group.category} className="space-y-0 divide-y divide-slate-100">
                  {group.settings.map(setting => (
                    <div key={setting.key} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                      <div>
                        <p className="text-sm text-slate-700">{setting.description}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{setting.key}</p>
                      </div>
                      <input
                        type="text"
                        value={editedValues[setting.key] || ''}
                        onChange={(e) => handleValueChange(setting.key, e.target.value)}
                        className={`w-28 px-3 py-1.5 text-sm text-right border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-300/50 focus:border-slate-400 transition-colors ${
                          editedValues[setting.key] !== setting.value
                            ? 'border-amber-400 bg-amber-50/50'
                            : 'border-slate-200'
                        }`}
                      />
                    </div>
                  ))}
                </div>
              )
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="mt-5 px-1">
          <p className="text-[10px] text-slate-400">
            Los valores de metas se expresan en porcentaje. Los cambios se aplican inmediatamente. Los campos con borde amarillo tienen cambios sin guardar.
          </p>
        </div>
      </div>
    </div>
  )
}
