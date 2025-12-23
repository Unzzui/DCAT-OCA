'use client'

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react'

type ViewMode = 'normal' | 'collapsed' | 'report'

interface SidebarContextType {
  mode: ViewMode
  isNormal: boolean
  isCollapsed: boolean
  isReportMode: boolean
  setNormal: () => void
  setCollapsed: () => void
  setReportMode: () => void
  toggleCollapse: () => void
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined)

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ViewMode>('normal')

  const setNormal = useCallback(() => setMode('normal'), [])
  const setCollapsed = useCallback(() => setMode('collapsed'), [])
  const setReportMode = useCallback(() => setMode('report'), [])

  const toggleCollapse = useCallback(() => {
    setMode(current => current === 'normal' ? 'collapsed' : 'normal')
  }, [])

  // Escape para salir del modo informe
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mode === 'report') {
        setMode('normal')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mode])

  return (
    <SidebarContext.Provider
      value={{
        mode,
        isNormal: mode === 'normal',
        isCollapsed: mode === 'collapsed',
        isReportMode: mode === 'report',
        setNormal,
        setCollapsed,
        setReportMode,
        toggleCollapse,
      }}
    >
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const context = useContext(SidebarContext)
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider')
  }
  return context
}
