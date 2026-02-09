'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Card, Title, Text } from '@tremor/react'
import {
  Settings,
  Save,
  RotateCcw,
  Check,
  AlertTriangle,
  Radio,
  ClipboardCheck,
  FileText,
  SearchX,
  Scissors,
  Database,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'

interface Setting {
  key: string
  value: string
  description: string
  category: string
}

const categoryLabels: Record<string, { label: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = {
  telecomunicaciones: { label: 'Telecomunicaciones', icon: Radio },
  nuevas_conexiones: { label: 'Nuevas Conexiones', icon: ClipboardCheck },
  lecturas: { label: 'Lecturas', icon: FileText },
  control_perdidas: { label: 'Control de Perdidas', icon: SearchX },
  corte_reposicion: { label: 'Corte y Reposicion', icon: Scissors },
  general: { label: 'General', icon: Database },
}

const categoryOrder = ['telecomunicaciones', 'nuevas_conexiones', 'lecturas', 'control_perdidas', 'corte_reposicion', 'general']

export default function ConfiguracionPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [settings, setSettings] = useState<Setting[]>([])
  const [editedValues, setEditedValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.push('/dashboard')
    }
  }, [user, router])

  const fetchSettings = useCallback(async () => {
    try {
      const data = await api.get<Setting[]>('/api/v1/settings')
      setSettings(data)
      // Initialize edited values
      const initial: Record<string, string> = {}
      data.forEach(s => { initial[s.key] = s.value })
      setEditedValues(initial)
    } catch (err) {
      console.error('Error fetching settings:', err)
      setError('Error al cargar configuraciones')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const handleValueChange = (key: string, value: string) => {
    setEditedValues(prev => ({ ...prev, [key]: value }))
  }

  const hasChanges = () => {
    return settings.some(s => editedValues[s.key] !== s.value)
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      // Get only changed settings
      const changedSettings: Record<string, string> = {}
      settings.forEach(s => {
        if (editedValues[s.key] !== s.value) {
          changedSettings[s.key] = editedValues[s.key]
        }
      })

      if (Object.keys(changedSettings).length === 0) {
        setSuccess('No hay cambios para guardar')
        setTimeout(() => setSuccess(''), 3000)
        return
      }

      await api.put('/api/v1/settings', { settings: changedSettings })
      setSuccess('Configuraciones guardadas exitosamente')
      fetchSettings()
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

  if (user?.role !== 'admin') {
    return null
  }

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
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-md flex items-center gap-2">
            <Check size={16} className="text-emerald-600" />
            <span className="text-sm text-emerald-700">{success}</span>
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-600" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex justify-end gap-2 mb-6">
          <button
            onClick={handleReset}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-700 border rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            <RotateCcw size={16} />
            Restaurar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges()}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-oca-blue rounded-md hover:bg-oca-blue-dark disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>

        {/* Settings by category */}
        <div className="space-y-6">
          {groupedSettings.map(group => {
            const catInfo = categoryLabels[group.category] || { label: group.category, icon: Settings }
            const Icon = catInfo.icon

            return (
              <Card key={group.category}>
                <div className="flex items-center gap-2 mb-4">
                  <Icon size={20} className="text-oca-blue" />
                  <Title>{catInfo.label}</Title>
                </div>

                <div className="space-y-4">
                  {group.settings.map(setting => (
                    <div key={setting.key} className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {setting.description}
                        </label>
                        <Text className="text-xs text-gray-500 mb-2">{setting.key}</Text>
                      </div>
                      <div className="w-32">
                        <input
                          type="text"
                          value={editedValues[setting.key] || ''}
                          onChange={(e) => handleValueChange(setting.key, e.target.value)}
                          className={`w-full px-3 py-2 text-sm text-right border rounded-md focus:outline-none focus:ring-2 focus:ring-oca-blue/20 focus:border-oca-blue ${
                            editedValues[setting.key] !== setting.value
                              ? 'border-amber-400 bg-amber-50'
                              : 'border-gray-300'
                          }`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )
          })}
        </div>

        {/* Info */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-start gap-2">
            <Settings size={16} className="text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-800">Notas</p>
              <ul className="text-xs text-blue-700 mt-1 space-y-1">
                <li>Los valores de metas se expresan en porcentaje (%).</li>
                <li>Los cambios se aplican inmediatamente despues de guardar.</li>
                <li>Las configuraciones con borde amarillo tienen cambios sin guardar.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
