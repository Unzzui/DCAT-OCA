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
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Presentation,
  Radio,
  GitCompare,
  Shield,
  ClipboardList,
  Receipt,
  Mail,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useSidebar } from '@/contexts/SidebarContext'
import { useBrand } from '@/contexts/ThemeContext'
import { SidebarDownloads } from './SidebarDownloads'

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  disabled?: boolean
  children?: NavItem[]
  moduleId?: string  // ID del módulo para control de acceso
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, moduleId: 'dashboard' },
  {
    name: 'Nuevas Conexiones',
    href: '/dashboard/nuevas-conexiones',
    icon: ClipboardCheck,
    moduleId: 'nuevas-conexiones',
    children: [
      { name: 'Informe NNCC', href: '/dashboard/nuevas-conexiones', icon: ClipboardCheck, moduleId: 'nuevas-conexiones' },
      { name: 'Med. Cruzados', href: '/dashboard/nuevas-conexiones/medidores-cruzados', icon: GitCompare, moduleId: 'nuevas-conexiones' },
    ],
  },
  // Módulos desactivados temporalmente — sin updates del cliente
  // { name: 'Lecturas', href: '/dashboard/lecturas', icon: FileText, moduleId: 'lecturas', children: [...] },
  // { name: 'Telecom', href: '/dashboard/telecomunicaciones', icon: Radio, moduleId: 'telecomunicaciones' },
  // { name: 'Corte y Repo.', href: '/dashboard/corte-reposicion', icon: Scissors, moduleId: 'corte-reposicion' },
  // { name: 'Ctrl. Perdidas', href: '/dashboard/control-perdidas', icon: SearchX, moduleId: 'control-perdidas' },
]

const adminNavigation: NavItem[] = [
  { name: 'Usuarios', href: '/dashboard/admin/usuarios', icon: Users },
  { name: 'Config.', href: '/dashboard/configuracion', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user } = useAuth()
  const { isNormal, isCollapsed, isReportMode, toggleCollapse, setReportMode } = useSidebar()
  const { isEnel } = useBrand()
  const [expandedItems, setExpandedItems] = useState<string[]>(['Nuevas Conexiones', 'Lecturas'])

  // En modo presentacion no mostrar sidebar
  if (isReportMode) {
    return null
  }

  const isExpanded = isNormal

  // Theme-dependent classes
  const t = isEnel ? {
    bg: 'bg-white border-r border-slate-200',
    text: 'text-slate-700',
    textMuted: 'text-slate-500',
    textFaint: 'text-slate-400',
    active: 'bg-slate-100 text-slate-900',
    inactive: 'text-slate-500 hover:bg-slate-50 hover:text-slate-800',
    childActive: 'bg-slate-100 text-slate-900',
    childInactive: 'text-slate-400 hover:bg-slate-50 hover:text-slate-700',
    border: 'border-slate-200',
    chevron: 'text-slate-400 hover:bg-slate-100 hover:text-slate-600',
    logo: '/logo-enel.png',
    logoH: 36,
  } : {
    bg: 'bg-oca-blue',
    text: 'text-white',
    textMuted: 'text-white/70',
    textFaint: 'text-white/50',
    active: 'bg-white/15 text-white',
    inactive: 'text-white/70 hover:bg-white/10 hover:text-white',
    childActive: 'bg-white/15 text-white',
    childInactive: 'text-white/60 hover:bg-white/10 hover:text-white',
    border: 'border-white/10',
    chevron: 'text-white/60 hover:bg-white/10 hover:text-white',
    logo: '/logo_horizontal.svg',
    logoH: 40,
  }

  // Filtrar navegación según módulos permitidos del usuario
  const userModules = user?.allowed_modules
  const isAdmin = user?.role === 'admin'
  // Si allowed_modules no está definido o no es array, mostrar todos (compatibilidad)
  const hasModuleRestrictions = Array.isArray(userModules)

  const filterNavigation = (items: NavItem[]): NavItem[] => {
    return items.filter(item => {
      // Si es admin, mostrar todo
      if (isAdmin) return true
      // Si no hay restricciones de módulos (allowed_modules no definido), mostrar todo
      if (!hasModuleRestrictions) return true
      // Si no tiene moduleId, mostrar siempre (por compatibilidad)
      if (!item.moduleId) return true
      // Verificar si el usuario tiene acceso al módulo
      return userModules.includes(item.moduleId)
    }).map(item => {
      // Si tiene hijos, filtrarlos también
      if (item.children) {
        return {
          ...item,
          children: filterNavigation(item.children)
        }
      }
      return item
    })
  }

  const filteredNavigation = filterNavigation(navigation)

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
              isActive ? t.active : t.inactive,
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
            <div className={cn('ml-4 mt-0.5 space-y-0.5 border-l pl-2', t.border)}>
              {item.children!.map(child => {
                const childActive = pathname === child.href
                return (
                  <Link
                    key={child.href}
                    href={child.href}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors',
                      childActive ? t.childActive : t.childInactive
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
          isActive ? t.active : t.inactive,
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
        'fixed left-0 top-0 z-40 h-screen transition-all duration-300 ease-in-out',
        t.bg,
        isExpanded ? 'w-56' : 'w-14'
      )}
    >
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className={cn(
          'flex items-center h-14',
          `border-b ${t.border}`,
          isExpanded ? 'justify-between px-3' : 'justify-center'
        )}>
          {isExpanded && (
            <Link href="/dashboard">
              <Image
                src={t.logo}
                alt={isEnel ? 'Enel' : 'OCA'}
                width={120}
                height={t.logoH}
                className="h-10 w-auto"
              />
            </Link>
          )}
          <button
            onClick={toggleCollapse}
            className={cn('rounded p-1.5 transition-colors', t.chevron)}
            title={isExpanded ? "Contraer" : "Expandir"}
          >
            {isExpanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto">
          {filteredNavigation.map(renderNavItem)}

          {user?.role === 'admin' && (
            <div className={cn('pt-2 mt-2 border-t space-y-0.5', t.border)}>
              {adminNavigation.map(renderNavItem)}
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className={cn('border-t p-2 space-y-0.5', t.border)}>
          {/* Exportar */}
          <SidebarDownloads isExpanded={isExpanded} />

          {/* Modo Presentacion */}
          <button
            onClick={setReportMode}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
              t.inactive,
              !isExpanded && 'justify-center px-0'
            )}
            title="Modo Presentacion (Esc para salir)"
          >
            <Presentation size={18} className="shrink-0" />
            {isExpanded && <span>Modo Presentacion</span>}
          </button>

        </div>
      </div>
    </aside>
  )
}
