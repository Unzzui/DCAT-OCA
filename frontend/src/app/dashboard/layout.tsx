'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext'
import { BrandProvider } from '@/contexts/ThemeContext'
import { Sidebar } from '@/components/layout/Sidebar'
import { cn } from '@/lib/utils'

// Mapeo de rutas a módulos
const ROUTE_TO_MODULE: Record<string, string> = {
  '/dashboard': 'dashboard',
  '/dashboard/nuevas-conexiones': 'nuevas-conexiones',
  '/dashboard/nuevas-conexiones/medidores-cruzados': 'nuevas-conexiones',
  '/dashboard/lecturas': 'lecturas',
  '/dashboard/telecomunicaciones': 'telecomunicaciones',
  '/dashboard/corte-reposicion': 'corte-reposicion',
  '/dashboard/control-perdidas': 'control-perdidas',
}

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { isNormal, isCollapsed, isReportMode, setNormal } = useSidebar()
  const [showHint, setShowHint] = useState(false)

  // Mostrar hint por 2 segundos al entrar en modo presentacion
  useEffect(() => {
    if (isReportMode) {
      setShowHint(true)
      const timer = setTimeout(() => setShowHint(false), 2000)
      return () => clearTimeout(timer)
    } else {
      setShowHint(false)
    }
  }, [isReportMode])

  return (
    <>
      <main
        className={cn(
          'min-h-screen transition-all duration-300 ease-in-out',
          isNormal && 'pl-56',
          isCollapsed && 'pl-14',
          isReportMode && 'pl-0'
        )}
      >
        {children}
      </main>

      {/* Indicador modo presentacion - aparece 2 segundos */}
      {isReportMode && showHint && (
        <div
          className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-lg bg-black/70 px-4 py-2.5 text-sm text-white shadow-lg backdrop-blur-sm animate-fade-in"
        >
          <kbd className="rounded bg-white/20 px-2 py-0.5 text-xs font-medium">Esc</kbd>
          <span>para salir</span>
        </div>
      )}
    </>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { isAuthenticated, isLoading, hasModuleAccess, user } = useAuth()
  const [hasAccess, setHasAccess] = useState(true)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, isLoading, router])

  // Verificar acceso al módulo actual
  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      // Rutas de admin no necesitan verificación de módulos (ya tienen su propia protección)
      if (pathname?.startsWith('/dashboard/admin') || pathname?.startsWith('/dashboard/configuracion')) {
        setHasAccess(true)
        return
      }

      // Si allowed_modules no está definido, permitir todo (compatibilidad con usuarios existentes)
      if (!user.allowed_modules || !Array.isArray(user.allowed_modules)) {
        setHasAccess(true)
        return
      }

      // Buscar el módulo correspondiente a la ruta actual
      const moduleId = ROUTE_TO_MODULE[pathname || '']
      if (moduleId) {
        const access = hasModuleAccess(moduleId)
        setHasAccess(access)
        if (!access && pathname !== '/dashboard') {
          // Redirigir al dashboard solo si no estamos ya en el dashboard
          router.push('/dashboard')
        } else if (!access && pathname === '/dashboard') {
          // Si no tiene acceso al dashboard, buscar el primer módulo disponible
          const firstAvailableModule = Object.entries(ROUTE_TO_MODULE).find(
            ([route, mod]) => user.allowed_modules?.includes(mod) && route !== '/dashboard'
          )
          if (firstAvailableModule) {
            router.push(firstAvailableModule[0])
          }
          // Si no hay módulos disponibles, mantener hasAccess en false para mostrar mensaje
        }
      } else {
        // Si no hay mapeo, permitir acceso (por compatibilidad)
        setHasAccess(true)
      }
    }
  }, [pathname, isLoading, isAuthenticated, hasModuleAccess, user, router])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-oca-blue border-t-transparent" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  // Mostrar mensaje si no tiene acceso (mientras redirige)
  if (!hasAccess) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">No tienes acceso a este módulo</p>
          <p className="text-sm text-gray-400 mt-1">Redirigiendo...</p>
        </div>
      </div>
    )
  }

  return (
    <BrandProvider>
      <SidebarProvider>
        <div className="min-h-screen bg-gray-50">
          <Sidebar />
          <DashboardContent>{children}</DashboardContent>
        </div>
      </SidebarProvider>
    </BrandProvider>
  )
}
