'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext'
import { Sidebar } from '@/components/layout/Sidebar'
import { cn } from '@/lib/utils'

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { isNormal, isCollapsed, isReportMode, setNormal } = useSidebar()
  const [showHint, setShowHint] = useState(false)

  // Mostrar hint por 2 segundos al entrar en modo informe
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

      {/* Indicador modo informe - aparece 2 segundos */}
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
  const { isAuthenticated, isLoading } = useAuth()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, isLoading, router])

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

  return (
    <SidebarProvider>
      <div className="min-h-screen bg-gray-50">
        <Sidebar />
        <DashboardContent>{children}</DashboardContent>
      </div>
    </SidebarProvider>
  )
}
