'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Card, Title, Text, Flex } from '@tremor/react'
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Shield,
  ShieldOff,
  KeyRound,
  X,
  Check,
  AlertTriangle,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { UserAdmin, UserRole } from '@/types'

interface FormData {
  email: string
  full_name: string
  password: string
  role: UserRole
  is_active: boolean
}

const initialFormData: FormData = {
  email: '',
  full_name: '',
  password: '',
  role: 'viewer',
  is_active: true,
}

const roleLabels: Record<UserRole, string> = {
  admin: 'Administrador',
  editor: 'Editor',
  viewer: 'Visualizador',
}

const roleColors: Record<UserRole, string> = {
  admin: 'bg-red-100 text-red-700',
  editor: 'bg-blue-100 text-blue-700',
  viewer: 'bg-gray-100 text-gray-700',
}

export default function AdminUsuariosPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [users, setUsers] = useState<UserAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [editingUser, setEditingUser] = useState<UserAdmin | null>(null)
  const [passwordUserId, setPasswordUserId] = useState<number | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.push('/dashboard')
    }
  }, [user, router])

  const fetchUsers = useCallback(async () => {
    try {
      const data = await api.get<UserAdmin[]>('/api/v1/admin/users')
      setUsers(data)
    } catch (err) {
      console.error('Error fetching users:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleCreate = () => {
    setEditingUser(null)
    setFormData(initialFormData)
    setError('')
    setShowModal(true)
  }

  const handleEdit = (u: UserAdmin) => {
    setEditingUser(u)
    setFormData({
      email: u.email,
      full_name: u.full_name,
      password: '',
      role: u.role,
      is_active: u.is_active,
    })
    setError('')
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      if (editingUser) {
        // Update
        const updateData: Record<string, string | boolean> = {}
        if (formData.full_name !== editingUser.full_name) updateData.full_name = formData.full_name
        if (formData.email !== editingUser.email) updateData.email = formData.email
        if (formData.role !== editingUser.role) updateData.role = formData.role
        if (formData.is_active !== editingUser.is_active) updateData.is_active = formData.is_active

        await api.put(`/api/v1/admin/users/${editingUser.id}`, updateData)
        setSuccess('Usuario actualizado exitosamente')
      } else {
        // Create
        if (!formData.password) {
          setError('La contrasena es requerida')
          return
        }
        await api.post('/api/v1/admin/users', formData)
        setSuccess('Usuario creado exitosamente')
      }
      setShowModal(false)
      fetchUsers()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(message)
    }
  }

  const handleToggleActive = async (userId: number) => {
    try {
      await api.post(`/api/v1/admin/users/${userId}/toggle-active`)
      fetchUsers()
      setSuccess('Estado actualizado')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error'
      setError(message)
      setTimeout(() => setError(''), 3000)
    }
  }

  const handleDelete = async (userId: number) => {
    try {
      await api.delete(`/api/v1/admin/users/${userId}`)
      setConfirmDelete(null)
      fetchUsers()
      setSuccess('Usuario eliminado')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error'
      setError(message)
      setTimeout(() => setError(''), 3000)
    }
  }

  const handleResetPassword = async () => {
    if (!passwordUserId || !newPassword) return
    try {
      await api.post(`/api/v1/admin/users/${passwordUserId}/reset-password`, { password: newPassword })
      setShowPasswordModal(false)
      setNewPassword('')
      setPasswordUserId(null)
      setSuccess('Contrasena actualizada')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error'
      setError(message)
      setTimeout(() => setError(''), 3000)
    }
  }

  if (user?.role !== 'admin') {
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-oca-blue border-t-transparent mx-auto"></div>
          <p className="mt-3 text-sm text-gray-500">Cargando usuarios...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Gestion de Usuarios" subtitle="Administrar usuarios del sistema" />

      <div className="p-6">
        {/* Messages */}
        {success && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-md flex items-center gap-2">
            <Check size={16} className="text-emerald-600" />
            <span className="text-sm text-emerald-700">{success}</span>
          </div>
        )}
        {error && !showModal && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-600" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase">Total Usuarios</p>
            <p className="text-3xl font-semibold text-gray-900 mt-1">{users.length}</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase">Activos</p>
            <p className="text-3xl font-semibold text-emerald-600 mt-1">{users.filter(u => u.is_active).length}</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase">Administradores</p>
            <p className="text-3xl font-semibold text-red-600 mt-1">{users.filter(u => u.role === 'admin').length}</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase">Inactivos</p>
            <p className="text-3xl font-semibold text-gray-400 mt-1">{users.filter(u => !u.is_active).length}</p>
          </div>
        </div>

        {/* Users Table */}
        <Card>
          <Flex justifyContent="between" alignItems="center" className="mb-4">
            <div>
              <Title>Usuarios</Title>
              <Text className="text-gray-500">{users.length} usuarios registrados</Text>
            </div>
            <button
              onClick={handleCreate}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-oca-blue rounded-md hover:bg-oca-blue-dark"
            >
              <Plus size={16} />
              Nuevo Usuario
            </button>
          </Flex>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Nombre</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Rol</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Estado</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Ultimo Login</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-medium">{u.email}</span>
                    </td>
                    <td className="px-4 py-3">{u.full_name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${roleColors[u.role]}`}>
                        {roleLabels[u.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {u.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {u.last_login ? new Date(u.last_login).toLocaleString('es-CL') : 'Nunca'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEdit(u)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="Editar"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => {
                            setPasswordUserId(u.id)
                            setNewPassword('')
                            setShowPasswordModal(true)
                          }}
                          className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded"
                          title="Reset contrasena"
                        >
                          <KeyRound size={14} />
                        </button>
                        <button
                          onClick={() => handleToggleActive(u.id)}
                          disabled={u.id === user?.id}
                          className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                          title={u.is_active ? 'Desactivar' : 'Activar'}
                        >
                          {u.is_active ? <ShieldOff size={14} /> : <Shield size={14} />}
                        </button>
                        {confirmDelete === u.id ? (
                          <div className="flex items-center gap-1 ml-1">
                            <button
                              onClick={() => handleDelete(u.id)}
                              className="p-1 text-white bg-red-500 rounded text-xs px-2"
                            >
                              Confirmar
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="p-1 text-gray-500 hover:text-gray-700"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(u.id)}
                            disabled={u.id === user?.id}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Eliminar"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">
                {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  required
                  className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-oca-blue/20 focus:border-oca-blue"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                  required
                  className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-oca-blue/20 focus:border-oca-blue"
                />
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contrasena</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    required={!editingUser}
                    minLength={8}
                    className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-oca-blue/20 focus:border-oca-blue"
                    placeholder="Min 8 chars, 1 mayuscula, 1 digito"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as UserRole }))}
                  className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-oca-blue/20 focus:border-oca-blue"
                >
                  <option value="viewer">Visualizador</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">Usuario activo</label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-gray-700 border rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-oca-blue rounded-md hover:bg-oca-blue-dark"
                >
                  {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Reset Contrasena</h3>
              <button onClick={() => setShowPasswordModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nueva Contrasena</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={8}
                  className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-oca-blue/20 focus:border-oca-blue"
                  placeholder="Min 8 caracteres"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 text-sm text-gray-700 border rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleResetPassword}
                  disabled={newPassword.length < 8}
                  className="px-4 py-2 text-sm font-medium text-white bg-oca-blue rounded-md hover:bg-oca-blue-dark disabled:opacity-50"
                >
                  Actualizar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
