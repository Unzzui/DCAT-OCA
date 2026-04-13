'use client'

import { useMemo, useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, Polygon, useMap, Marker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { getPointCategory, CATEGORY_COLORS } from './mapUtils'
import type { MapPoint, MarkerCategory } from './mapUtils'

// Re-export for consumers that import from this file
export type { MapPoint, MarkerCategory } from './mapUtils'
export { getPointCategory } from './mapUtils'

interface LeafletMapProps {
  points: MapPoint[]
  height?: string
  onPointClick?: (point: MapPoint) => void
}

// Grupo de puntos con la misma coordenada
interface PointGroup {
  lat: number
  lng: number
  points: MapPoint[]
  dominantCategory: MarkerCategory
}

function getMarkerColor(point: MapPoint): string {
  return CATEGORY_COLORS[getPointCategory(point)]
}

// Agrupa puntos con coordenadas identicas
function groupPointsByCoordinate(points: MapPoint[]): PointGroup[] {
  const groups = new Map<string, MapPoint[]>()

  for (const point of points) {
    // Usar precision de 6 decimales para agrupar
    const key = `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(point)
  }

  return Array.from(groups.entries()).map(([key, pts]) => {
    const [lat, lng] = key.split(',').map(Number)

    // Determinar categoria dominante (prioridad: mal > no_efectiva > pendiente > bien)
    const categories = pts.map(p => getPointCategory(p))
    let dominantCategory: MarkerCategory = 'bien'
    if (categories.includes('mal')) dominantCategory = 'mal'
    else if (categories.includes('no_efectiva')) dominantCategory = 'no_efectiva'
    else if (categories.includes('pendiente')) dominantCategory = 'pendiente'

    return { lat, lng, points: pts, dominantCategory }
  })
}

// Crear icono custom para grupos con multiples puntos
function createClusterIcon(count: number, color: string): L.DivIcon {
  return L.divIcon({
    className: 'custom-cluster-icon',
    html: `
      <div style="
        background: ${color};
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 600;
        font-size: 11px;
        font-family: system-ui, sans-serif;
      ">${count}</div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

// ─── Zone colors (exported for legend use) ──────────────────────────────────

export const ZONE_COLORS: Record<string, string> = {
  CHACABUCO: '#3b82f6',
  CORDILLERA: '#8b5cf6',
  FLORIDA: '#06b6d4',
  PACIFICO: '#f59e0b',
}

function getZoneColor(zona: string): string {
  return ZONE_COLORS[zona.toUpperCase()] || '#64748b'
}

// ─── GeoJSON parsing ────────────────────────────────────────────────────────

interface GeoFeature {
  type: 'Feature'
  properties: { comuna: string; zona: string }
  geometry: { type: string; coordinates: number[][][] | number[][][][] }
}

interface GeoCollection {
  type: 'FeatureCollection'
  features: GeoFeature[]
}

type LatLng = [number, number]

interface ZonePolygonData {
  zona: string
  color: string
  // Each comuna = array of rings; each ring = array of [lat, lng]
  polygons: LatLng[][][]
}

interface ZoneLabelData {
  zona: string
  centroid: LatLng
  count: number
  color: string
}

function geoJsonToLatLngs(geometry: GeoFeature['geometry']): LatLng[][] {
  // GeoJSON is [lng, lat], Leaflet needs [lat, lng]
  if (geometry.type === 'Polygon') {
    const coords = geometry.coordinates as number[][][]
    return coords.map((ring) => ring.map(([lng, lat]) => [lat, lng] as LatLng))
  } else if (geometry.type === 'MultiPolygon') {
    const coords = geometry.coordinates as number[][][][]
    // Flatten multi-polygon to array of rings
    const rings: LatLng[][] = []
    for (const poly of coords) {
      for (const ring of poly) {
        rings.push(ring.map(([lng, lat]) => [lat, lng] as LatLng))
      }
    }
    return rings
  }
  return []
}

function buildZonePolygons(geoData: GeoCollection): ZonePolygonData[] {
  const grouped: Record<string, LatLng[][][]> = {}
  for (const feat of geoData.features) {
    const zona = feat.properties.zona
    if (!grouped[zona]) grouped[zona] = []
    const rings = geoJsonToLatLngs(feat.geometry)
    if (rings.length > 0) grouped[zona].push(rings)
  }
  return Object.entries(grouped).map(([zona, polygons]) => ({
    zona,
    color: getZoneColor(zona),
    polygons,
  }))
}

function computeZoneLabels(geoData: GeoCollection, points: MapPoint[]): ZoneLabelData[] {
  const zoneCounts: Record<string, number> = {}
  for (const p of points) {
    if (!p.zona) continue
    zoneCounts[p.zona] = (zoneCounts[p.zona] || 0) + 1
  }

  const zoneBounds: Record<string, { minLat: number; maxLat: number; minLng: number; maxLng: number }> = {}
  for (const feat of geoData.features) {
    const zona = feat.properties.zona
    const rings = geoJsonToLatLngs(feat.geometry)
    for (const ring of rings) {
      for (const [lat, lng] of ring) {
        if (!zoneBounds[zona]) {
          zoneBounds[zona] = { minLat: lat, maxLat: lat, minLng: lng, maxLng: lng }
        } else {
          const b = zoneBounds[zona]
          if (lat < b.minLat) b.minLat = lat
          if (lat > b.maxLat) b.maxLat = lat
          if (lng < b.minLng) b.minLng = lng
          if (lng > b.maxLng) b.maxLng = lng
        }
      }
    }
  }

  return Object.entries(zoneBounds).map(([zona, b]) => ({
    zona,
    centroid: [(b.minLat + b.maxLat) / 2, (b.minLng + b.maxLng) / 2] as LatLng,
    count: zoneCounts[zona] || 0,
    color: getZoneColor(zona),
  }))
}

// ─── Invalidate map size on container resize ───────────────────────────────

function MapResizer({ height }: { height: string }) {
  const map = useMap()
  const prevHeight = useRef(height)

  useEffect(() => {
    if (prevHeight.current !== height) {
      prevHeight.current = height
      // Small delay so the DOM has time to apply the new size
      const t = setTimeout(() => map.invalidateSize(), 100)
      return () => clearTimeout(t)
    }
  }, [height, map])

  // Also observe the container element for resize
  useEffect(() => {
    const container = map.getContainer()
    if (!container || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(container)
    return () => ro.disconnect()
  }, [map])

  return null
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function LeafletMapInner({ points, height = '400px', onPointClick }: LeafletMapProps) {
  const [geoData, setGeoData] = useState<GeoCollection | null>(null)

  useEffect(() => {
    fetch('/geo/comunas-zonas.geojson')
      .then((r) => r.json())
      .then((data: GeoCollection) => setGeoData(data))
      .catch(() => {})
  }, [])

  const zonePolygons = useMemo(() => (geoData ? buildZonePolygons(geoData) : []), [geoData])
  const zoneLabels = useMemo(
    () => (geoData ? computeZoneLabels(geoData, points) : []),
    [geoData, points]
  )

  // Agrupar puntos con coordenadas identicas
  const pointGroups = useMemo(() => groupPointsByCoordinate(points), [points])

  return (
    <div style={{ height, width: '100%', position: 'relative' }}>
      <MapContainer
        center={[-33.45, -70.65]}
        zoom={10}
        style={{ height: '100%', width: '100%', borderRadius: '0.5rem' }}
        scrollWheelZoom={true}
      >
        <MapResizer height={height} />
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />

        {/* Zone boundary polygons from GeoJSON — one Polygon per comuna */}
        {zonePolygons.map((zone) =>
          zone.polygons.map((rings, i) => (
            <Polygon
              key={`zone-${zone.zona}-${i}`}
              positions={rings}
              pathOptions={{
                color: zone.color,
                weight: 2,
                opacity: 0.7,
                fillColor: zone.color,
                fillOpacity: 0.08,
              }}
              interactive={false}
            />
          ))
        )}

        {/* Data points - agrupados por coordenada */}
        {pointGroups.map((group, groupIndex) => {
          const color = CATEGORY_COLORS[group.dominantCategory]

          // Punto unico: CircleMarker simple
          if (group.points.length === 1) {
            const point = group.points[0]
            return (
              <CircleMarker
                key={`single-${group.lat}-${group.lng}-${groupIndex}`}
                center={[group.lat, group.lng]}
                radius={6}
                fillOpacity={0.8}
                weight={1}
                color={getMarkerColor(point)}
                fillColor={getMarkerColor(point)}
                eventHandlers={
                  onPointClick
                    ? { click: () => onPointClick(point) }
                    : undefined
                }
              >
                <Popup>
                  <div className="text-sm leading-relaxed">
                    <p className="font-semibold mb-1">{point.resultado || point.estado_efectividad || 'Sin estado'}</p>
                    <p><span className="font-medium">Zona:</span> {point.zona}</p>
                    <p><span className="font-medium">Comuna:</span> {point.comuna}</p>
                    <p><span className="font-medium">Contratista:</span> {point.contratista}</p>
                    {point.direccion && <p><span className="font-medium">Direccion:</span> {point.direccion}</p>}
                  </div>
                </Popup>
              </CircleMarker>
            )
          }

          // Multiples puntos en la misma ubicacion: Marker con icono custom
          return (
            <Marker
              key={`cluster-${group.lat}-${group.lng}-${groupIndex}`}
              position={[group.lat, group.lng]}
              icon={createClusterIcon(group.points.length, color)}
            >
              <Popup maxHeight={280}>
                <div className="text-sm" style={{ minWidth: 220 }}>
                  <div className="font-semibold text-slate-700 border-b border-slate-200 pb-1.5 mb-2" style={{ fontSize: 12 }}>
                    {group.points.length} inspecciones en esta ubicacion
                  </div>
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    {group.points.map((point, idx) => (
                      <div
                        key={idx}
                        className={`py-1.5 ${idx < group.points.length - 1 ? 'border-b border-slate-100' : ''}`}
                        style={{ cursor: onPointClick ? 'pointer' : 'default' }}
                        onClick={() => onPointClick?.(point)}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: getMarkerColor(point),
                              flexShrink: 0,
                            }}
                          />
                          <span className="font-medium text-slate-700" style={{ fontSize: 11 }}>
                            {point.resultado || point.estado_efectividad || 'Sin estado'}
                          </span>
                        </div>
                        <div className="text-slate-500 pl-3" style={{ fontSize: 10, lineHeight: 1.4 }}>
                          {point.direccion && <div>{point.direccion}</div>}
                          <div>{point.contratista}</div>
                          {point.cliente && <div>Cliente: {point.cliente}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>

      {/* Zone legend overlay */}
      {zoneLabels.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            zIndex: 1000,
            background: 'white',
            borderRadius: '8px',
            padding: '10px 14px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
            fontSize: '12px',
            lineHeight: '1.6',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: '11px', color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Zonas
          </div>
          {zoneLabels.map((z) => (
            <div key={z.zona} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 3,
                  background: z.color,
                  flexShrink: 0,
                  border: '1px solid rgba(0,0,0,0.1)',
                }}
              />
              <span style={{ color: '#334155', fontWeight: 600 }}>{z.zona}</span>
              <span style={{ color: '#94a3b8', fontWeight: 400 }}>({z.count})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
