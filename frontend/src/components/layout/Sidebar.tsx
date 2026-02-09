'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
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
  ChevronDown,
  Presentation,
  Radio,
  GitCompare,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useSidebar } from '@/contexts/SidebarContext'
import { SidebarDownloads } from './SidebarDownloads'

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  disabled?: boolean
  children?: NavItem[]
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  {
    name: 'Nuevas Conexiones',
    href: '/dashboard/nuevas-conexiones',
    icon: ClipboardCheck,
    children: [
      { name: 'Informe NNCC', href: '/dashboard/nuevas-conexiones', icon: ClipboardCheck },
      { name: 'Med. Cruzados', href: '/dashboard/nuevas-conexiones/medidores-cruzados', icon: GitCompare },
    ],
  },
  { name: 'Lecturas', href: '/dashboard/lecturas', icon: FileText },
  { name: 'Telecom', href: '/dashboard/telecomunicaciones', icon: Radio },
  { name: 'Corte y Repo.', href: '/dashboard/corte-reposicion', icon: Scissors },
  { name: 'Ctrl. Perdidas', href: '/dashboard/control-perdidas', icon: SearchX },
]

const adminNavigation: NavItem[] = [
  { name: 'Usuarios', href: '/dashboard/admin/usuarios', icon: Users },
  { name: 'Config.', href: '/dashboard/configuracion', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { isNormal, isCollapsed, isReportMode, toggleCollapse, setReportMode } = useSidebar()
  const [expandedItems, setExpandedItems] = useState<string[]>(['Nuevas Conexiones'])

  // En modo informe no mostrar sidebar
  if (isReportMode) {
    return null
  }

  const isExpanded = isNormal

  const toggleExpand = (name: string) => {
    setExpandedItems(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    )
  }

  const isItemActive = (item: NavItem): boolean => {
    if (item.children) {
      return item.children.some(child => pathname === child.href)
    }
    return pathname === item.href
  }

  const renderNavItem = (item: NavItem) => {
    const hasChildren = item.children && item.children.length > 0
    const isActive = isItemActive(item)
    const isOpen = expandedItems.includes(item.name)

    if (hasChildren) {
      return (
        <div key={item.name}>
          <button
            onClick={() => isExpanded ? toggleExpand(item.name) : undefined}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
              isActive
                ? 'bg-white/15 text-white'
                : 'text-white/70 hover:bg-white/10 hover:text-white',
              !isExpanded && 'justify-center px-0'
            )}
            title={item.name}
          >
            <item.icon size={18} className="shrink-0" />
            {isExpanded && (
              <>
                <span className="truncate flex-1 text-left">{item.name}</span>
                <ChevronDown
                  size={14}
                  className={cn('shrink-0 transition-transform', isOpen && 'rotate-180')}
                />
              </>
            )}
          </button>
          {isExpanded && isOpen && (
            <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/10 pl-2">
              {item.children!.map(child => {
                const childActive = pathname === child.href
                return (
                  <Link
                    key={child.href}
                    href={child.href}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors',
                      childActive
                        ? 'bg-white/15 text-white'
                        : 'text-white/60 hover:bg-white/10 hover:text-white'
                    )}
                    title={child.name}
                  >
                    <child.icon size={14} className="shrink-0" />
                    <span className="truncate">{child.name}</span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )
    }

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
  }

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
          {navigation.map(renderNavItem)}

          {user?.role === 'admin' && (
            <div className="pt-2 mt-2 border-t border-white/10 space-y-0.5">
              {adminNavigation.map(renderNavItem)}
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
