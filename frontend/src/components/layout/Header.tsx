'use client'

import { useState, useRef, useEffect } from 'react'
import { LogOut, ChevronDown } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useBrand } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'

interface HeaderProps {
  title: string
  subtitle?: string
  lastUpdate?: string | null
}

export function Header({ title, subtitle, lastUpdate }: HeaderProps) {
  const { user, logout } = useAuth()
  const { brand, isEnel, toggleBrand } = useBrand()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white">
      <div className="flex h-14 items-center justify-between px-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 leading-tight">{title}</h1>
          <div className="flex items-center gap-3 -mt-0.5">
            {subtitle && <p className="text-[11px] text-gray-500">{subtitle}</p>}
            {lastUpdate && (
              <p className="text-[10px] text-slate-400">
                Actualizado: {lastUpdate}
              </p>
            )}
          </div>
        </div>

        {user && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 rounded-md px-2.5 py-1.5 hover:bg-slate-50 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-oca-blue flex items-center justify-center text-white text-[10px] font-bold uppercase">
                {user.full_name?.split(' ').map(n => n[0]).slice(0, 2).join('')}
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-xs font-medium text-slate-700 leading-tight">{user.full_name}</p>
                <p className="text-[10px] text-slate-400 leading-tight">{user.role}</p>
              </div>
              <ChevronDown size={13} className={cn('text-slate-400 transition-transform', menuOpen && 'rotate-180')} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
                <div className="px-3 py-2.5 border-b border-slate-100">
                  <p className="text-xs font-medium text-slate-700 truncate">{user.full_name}</p>
                  <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
                </div>

                {/* Brand toggle */}
                <div className="px-3 py-2.5 border-b border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium mb-2">Tema</p>
                  <button
                    onClick={toggleBrand}
                    className="relative flex items-center w-full h-8 rounded-full bg-slate-100 p-0.5"
                  >
                    <div
                      className="absolute top-0.5 h-7 w-[calc(50%-2px)] rounded-full bg-white shadow-sm transition-all duration-300 ease-in-out"
                      style={{ left: isEnel ? 'calc(50% + 1px)' : '2px' }}
                    />
                    <span className={cn(
                      'relative z-10 flex-1 text-center text-[11px] font-semibold transition-colors',
                      !isEnel ? 'text-slate-800' : 'text-slate-400'
                    )}>
                      OCA
                    </span>
                    <span className={cn(
                      'relative z-10 flex-1 text-center text-[11px] font-semibold transition-colors',
                      isEnel ? 'text-slate-800' : 'text-slate-400'
                    )}>
                      Enel
                    </span>
                  </button>
                </div>

                <button
                  onClick={() => { setMenuOpen(false); logout() }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <LogOut size={14} />
                  Cerrar sesion
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
