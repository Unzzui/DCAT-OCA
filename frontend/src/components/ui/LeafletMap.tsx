'use client'

import dynamic from 'next/dynamic'

// Re-export SSR-safe types and utilities from mapUtils (no leaflet dependency)
export type { MapPoint, MarkerCategory } from './mapUtils'
export { getPointCategory, CATEGORY_COLORS } from './mapUtils'

const LeafletMap = dynamic(() => import('./LeafletMapInner'), {
  ssr: false,
  loading: () => (
    <div
      style={{ height: '400px', width: '100%' }}
      className="flex items-center justify-center bg-gray-100 rounded-lg"
    >
      <p className="text-gray-500">Cargando mapa...</p>
    </div>
  ),
})

export { LeafletMap }
