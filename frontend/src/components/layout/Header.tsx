'use client'

import { Bell, Search } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface HeaderProps {
  title: string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  const { user } = useAuth()

  const getRoleBadge = (role: string) => {
    const badges: Record<string, { label: string; className: string }> = {
      admin: { label: 'Administrador', className: 'bg-oca-red text-white' },
      editor: { label: 'Editor', className: 'bg-oca-blue-light text-white' },
      viewer: { label: 'Visualizador', className: 'bg-gray-500 text-white' },
    }
    return badges[role] || badges.viewer
  }

  const badge = user ? getRoleBadge(user.role) : null

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white">
      <div className="flex h-16 items-center justify-between px-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar..."
              className="h-9 w-64 rounded-md border border-gray-300 bg-gray-50 pl-9 pr-4 text-sm focus:border-oca-blue focus:outline-none focus:ring-1 focus:ring-oca-blue"
            />
          </div>

          {/* Notifications */}
          <button className="relative rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700">
            <Bell size={20} />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-oca-red" />
          </button>

          {/* User badge */}
          {badge && (
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${badge.className}`}>
              {badge.label}
            </span>
          )}
        </div>
      </div>
    </header>
  )
}
