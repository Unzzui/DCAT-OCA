'use client'

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'

type Brand = 'oca' | 'enel'

const STORAGE_KEY = 'dcat-brand'

interface BrandContextType {
  brand: Brand
  isOca: boolean
  isEnel: boolean
  toggleBrand: () => void
}

const BrandContext = createContext<BrandContextType | undefined>(undefined)

export function BrandProvider({ children }: { children: ReactNode }) {
  const [brand, setBrand] = useState<Brand>('oca')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'enel') setBrand('enel')
    setMounted(true)
  }, [])

  const toggleBrand = useCallback(() => {
    setBrand(prev => {
      const next = prev === 'oca' ? 'enel' : 'oca'
      localStorage.setItem(STORAGE_KEY, next)
      return next
    })
  }, [])

  // Prevent flash of wrong theme
  if (!mounted) {
    return <>{children}</>
  }

  return (
    <BrandContext.Provider value={{ brand, isOca: brand === 'oca', isEnel: brand === 'enel', toggleBrand }}>
      {children}
    </BrandContext.Provider>
  )
}

export function useBrand() {
  const context = useContext(BrandContext)
  if (!context) {
    // Return default when outside provider (e.g. login page)
    return { brand: 'oca' as Brand, isOca: true, isEnel: false, toggleBrand: () => {} }
  }
  return context
}
