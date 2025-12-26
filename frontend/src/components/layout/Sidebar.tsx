'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ClipboardCheck,
  FileText,
  Scissors,
  SearchX,
  Users,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Presentation,
  Radio,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useSidebar } from '@/contexts/SidebarContext'
import { SidebarDownloads } from './SidebarDownloads'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Informe NNCC', href: '/dashboard/nuevas-conexiones', icon: ClipboardCheck },
  { name: 'Lecturas', href: '/dashboard/lecturas', icon: FileText },
  { name: 'Telecom', href: '/dashboard/telecomunicaciones', icon: Radio },
  { name: 'Corte y Repo.', href: '/dashboard/corte-reposicion', icon: Scissors, disabled: true },
  { name: 'Ctrl. Perdidas', href: '/dashboard/control-perdidas', icon: SearchX },
]

const adminNavigation = [
  { name: 'Usuarios', href: '/dashboard/usuarios', icon: Users },
  { name: 'Config.', href: '/dashboard/configuracion', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { isNormal, isCollapsed, isReportMode, toggleCollapse, setReportMode } = useSidebar()

  // En modo informe no mostrar sidebar
  if (isReportMode) {
    return null
  }

  const isExpanded = isNormal

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-oca-blue transition-all duration-300 ease-in-out',
        isExpanded ? 'w-56' : 'w-14'
      )}
    >
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className={cn(
          'flex items-center border-b border-white/10 h-14',
          isExpanded ? 'justify-between px-3' : 'justify-center'
        )}>
          {isExpanded && (
            <Link href="/dashboard">
              <Image
                src="/logo_horizontal.svg"
                alt="OCA"
                width={120}
                height={40}
                className="h-10 w-auto"
              />
            </Link>
          )}
          <button
            onClick={toggleCollapse}
            className="rounded p-1.5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
            title={isExpanded ? "Contraer" : "Expandir"}
          >
            {isExpanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.disabled ? '#' : item.href}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-white/15 text-white'
                    : 'text-white/70 hover:bg-white/10 hover:text-white',
                  item.disabled && 'opacity-40 cursor-not-allowed',
                  !isExpanded && 'justify-center px-0'
                )}
                onClick={(e) => item.disabled && e.preventDefault()}
                title={item.name}
              >
                <item.icon size={18} className="shrink-0" />
                {isExpanded && <span className="truncate">{item.name}</span>}
              </Link>
            )
          })}

          {user?.role === 'admin' && (
            <div className="pt-2 mt-2 border-t border-white/10 space-y-0.5">
              {adminNavigation.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
                      isActive
                        ? 'bg-white/15 text-white'
                        : 'text-white/70 hover:bg-white/10 hover:text-white',
                      !isExpanded && 'justify-center px-0'
                    )}
                    title={item.name}
                  >
                    <item.icon size={18} className="shrink-0" />
                    {isExpanded && <span className="truncate">{item.name}</span>}
                  </Link>
                )
              })}
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="border-t border-white/10 p-2 space-y-0.5">
          {/* Exportar */}
          <SidebarDownloads isExpanded={isExpanded} />

          {/* Modo Informe */}
          <button
            onClick={setReportMode}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white',
              !isExpanded && 'justify-center px-0'
            )}
            title="Modo Informe (Esc para salir)"
          >
            <Presentation size={18} className="shrink-0" />
            {isExpanded && <span>Modo Informe</span>}
          </button>

          {/* User info */}
          {isExpanded && user && (
            <div className="px-2.5 py-1.5">
              <p className="truncate text-xs font-medium text-white">{user.full_name}</p>
              <p className="truncate text-[10px] text-white/50">{user.email}</p>
            </div>
          )}

          {/* Logout */}
          <button
            onClick={logout}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white',
              !isExpanded && 'justify-center px-0'
            )}
            title="Cerrar sesion"
          >
            <LogOut size={18} className="shrink-0" />
            {isExpanded && <span>Salir</span>}
          </button>
        </div>
      </div>
    </aside>
  )
}
