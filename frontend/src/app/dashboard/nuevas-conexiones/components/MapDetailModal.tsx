'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { X, ExternalLink, Camera, ChevronLeft, ChevronRight, Loader2, ImageOff } from 'lucide-react'
import type { MapPoint } from '@/components/ui/LeafletMap'
import { api } from '@/lib/api'

interface FotoODIS {
  id: string | number
  descripcion: string
  base64: string | null
  create_at: string
}

function isValid(val?: string): boolean {
  return !!val && val !== '' && val !== 'None' && val !== 'nan' && val !== 'NaN' && val !== 'null'
}

function cleanVta(val?: string | number): string {
  if (val == null) return ''
  return String(val).replace(/\.0$/, '')
}

function DetailRow({ label, value, className = '' }: { label: string; value?: string; className?: string }) {
  if (!isValid(value)) return null
  return (
    <div className={className}>
      <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{label}</span>
      <p className="text-[13px] text-slate-800 mt-0.5 leading-snug">{value}</p>
    </div>
  )
}

function resolveResultado(point: MapPoint): { label: string; type: 'bien' | 'mal' | 'no_efectiva' | 'pendiente' } {
  const resultado = (point.resultado || '').toUpperCase()
  const efectividad = (point.estado_efectividad || '').toUpperCase()

  if (resultado.includes('MAL EJECUTADO')) return { label: 'TRABAJO MAL EJECUTADO', type: 'mal' }
  if (resultado.includes('BIEN EJECUTADO')) return { label: 'TRABAJO BIEN EJECUTADO', type: 'bien' }
  if (efectividad.includes('NO EFECTIVA') || resultado === 'OTROS') return { label: 'NO EFECTIVA', type: 'no_efectiva' }
  if (efectividad.includes('EFECTIVA')) return { label: 'EFECTIVA — BIEN EJECUTADO', type: 'bien' }
  return { label: isValid(resultado) ? resultado : 'PENDIENTE', type: 'pendiente' }
}

function extractOrderId(linkFormulario?: string): string | null {
  if (!linkFormulario || !isValid(linkFormulario)) return null
  const clean = linkFormulario.replace(/\/+$/, '')
  const parts = clean.split('/')
  const last = parts[parts.length - 1]
  return /^\d+$/.test(last) ? last : null
}

// ─── Lazy Image (renders base64 only when visible) ───────────────────────────

function LazyImage({ base64, alt, className, onClick }: {
  base64: string
  alt: string
  className?: string
  onClick?: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { rootMargin: '100px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div ref={ref} className={className} onClick={onClick}>
      {visible ? (
        <img
          src={`data:image/jpeg;base64,${base64}`}
          alt={alt}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-slate-200 animate-pulse" />
      )}
    </div>
  )
}

// ─── Photo Gallery ───────────────────────────────────────────────────────────

function PhotoGallery({ orderId }: { orderId: string }) {
  const [fotos, setFotos] = useState<FotoODIS[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)

    api.get<FotoODIS[]>(`/api/v1/nuevas-conexiones/imagenes/${orderId}`, undefined, { noCache: true })
      .then(data => {
        if (!cancelled) {
          setFotos(data.filter(f => f.base64))
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true)
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [orderId])

  const handlePrev = useCallback(() => {
    setSelectedIdx(prev => (prev !== null && prev > 0) ? prev - 1 : fotos.length - 1)
  }, [fotos.length])

  const handleNext = useCallback(() => {
    setSelectedIdx(prev => (prev !== null && prev < fotos.length - 1) ? prev + 1 : 0)
  }, [fotos.length])

  useEffect(() => {
    if (selectedIdx === null) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrev()
      else if (e.key === 'ArrowRight') handleNext()
      else if (e.key === 'Escape') setSelectedIdx(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedIdx, handlePrev, handleNext])

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-slate-400">
        <Loader2 size={14} className="animate-spin" />
        <span className="text-[12px]">Cargando fotos...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 py-3 text-slate-400">
        <ImageOff size={14} />
        <span className="text-[12px]">No se pudieron cargar las fotos</span>
      </div>
    )
  }

  if (fotos.length === 0) return null

  return (
    <>
      <div className="border-t border-slate-100 pt-3">
        <div className="flex items-center gap-2 mb-3">
          <Camera size={13} className="text-slate-500" />
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            Fotos de Inspeccion ({fotos.length})
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {fotos.map((foto, i) => (
            <button
              key={foto.id}
              onClick={() => setSelectedIdx(i)}
              className="relative aspect-[4/3] rounded-lg overflow-hidden bg-slate-100 hover:ring-2 hover:ring-blue-400 transition-all cursor-pointer group"
            >
              <LazyImage
                base64={foto.base64!}
                alt={foto.descripcion || `Foto ${i + 1}`}
                className="w-full h-full"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-[10px] text-white leading-tight truncate">
                  {foto.descripcion || `Foto ${i + 1}`}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {selectedIdx !== null && fotos[selectedIdx] && (
        <div
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/85"
          onClick={() => setSelectedIdx(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full mx-4" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setSelectedIdx(null)}
              className="absolute -top-10 right-0 p-1 text-white/70 hover:text-white transition-colors"
            >
              <X size={22} />
            </button>

            <img
              src={`data:image/jpeg;base64,${fotos[selectedIdx].base64}`}
              alt={fotos[selectedIdx].descripcion || `Foto ${selectedIdx + 1}`}
              className="w-full max-h-[82vh] object-contain rounded-lg"
            />

            {fotos[selectedIdx].descripcion && (
              <p className="text-center text-sm text-white/80 mt-2">{fotos[selectedIdx].descripcion}</p>
            )}
            <p className="text-center text-xs text-white/50 mt-1">{selectedIdx + 1} / {fotos.length}</p>

            {fotos.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); handlePrev() }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/40 text-white/80 hover:bg-black/60 hover:text-white transition-colors"
                >
                  <ChevronLeft size={26} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleNext() }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/40 text-white/80 hover:bg-black/60 hover:text-white transition-colors"
                >
                  <ChevronRight size={26} />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

// ─── Main Modal ──────────────────────────────────────────────────────────────

export function MapDetailModal({ point, onClose }: { point: MapPoint; onClose: () => void }) {
  const { label: resultadoLabel, type: resultadoType } = resolveResultado(point)
  const isMal = resultadoType === 'mal'

  const headerBg = resultadoType === 'mal' ? 'bg-red-600' : resultadoType === 'bien' ? 'bg-green-600' : resultadoType === 'no_efectiva' ? 'bg-slate-500' : 'bg-slate-400'
  const causas = isValid(point.causa) ? point.causa!.split('|').map(c => c.trim().replace(/_/g, ' ')).filter(Boolean) : []
  const orderId = extractOrderId(point.link_formulario)

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/30" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lg border border-slate-200/60 w-full max-w-2xl mx-4 overflow-hidden max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Color header */}
        <div className={`${headerBg} px-6 py-3.5 flex items-center justify-between shrink-0`}>
          <span className="text-sm font-semibold text-white">{resultadoLabel}</span>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/20 transition-colors text-white/80 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {/* Key info strip */}
          <div className="pb-3 border-b border-slate-100 space-y-2">
            <div className="flex items-center gap-5">
              {isValid(point.cliente) && (
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider">Cliente</span>
                  <p className="text-sm font-semibold text-slate-900">{point.cliente}</p>
                </div>
              )}
              {isValid(point.nombre_cliente) && (
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider">Nombre</span>
                  <p className="text-sm font-semibold text-slate-900 truncate">{point.nombre_cliente}</p>
                </div>
              )}
            </div>
            <div className="flex items-center gap-5">
              {isValid(point.vta) && (
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider">VTA</span>
                  <p className="text-sm font-semibold text-slate-900">{cleanVta(point.vta)}</p>
                </div>
              )}
              {isValid(point.fecha) && (
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider">Fecha</span>
                  <p className="text-sm font-semibold text-slate-900">{point.fecha}</p>
                </div>
              )}
              {isValid(point.n_medidor) && (
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider">Medidor</span>
                  <p className="text-sm font-semibold text-slate-900">{point.n_medidor}</p>
                </div>
              )}
            </div>
          </div>

          {/* Location + people */}
          <div className="grid grid-cols-3 gap-x-4 gap-y-2.5">
            <DetailRow label="Zona" value={point.zona} />
            <DetailRow label="Comuna" value={point.comuna} />
            <DetailRow label="Contratista" value={point.contratista} />
            <DetailRow label="Inspector" value={point.inspector} />
            <DetailRow label="Tipo Trabajo" value={point.tipo_trabajo} />
            {isValid(point.direccion) && <DetailRow label="Direccion" value={point.direccion} className="col-span-3" />}
          </div>

          {/* Inspection details */}
          {(isValid(point.estado_efectividad) || isValid(point.estado_empalme) || isValid(point.cumple_norma_cc) || isValid(point.cliente_conforme)) && (
            <div className="border-t border-slate-100 pt-3">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Detalle de Inspeccion</p>
              <div className="grid grid-cols-3 gap-x-4 gap-y-2.5">
                <DetailRow label="Efectividad" value={point.estado_efectividad} />
                <DetailRow label="Estado Empalme" value={point.estado_empalme} />
                <DetailRow label="Norma CC" value={point.cumple_norma_cc} />
                <DetailRow label="Cliente Conforme" value={point.cliente_conforme} />
                <DetailRow label="Estado Contratista" value={point.estado_contratista} />
                <DetailRow label="Resultado Norm." value={point.resultado_normalizacion} />
              </div>
            </div>
          )}

          {/* Multa section */}
          {isValid(point.multa) && point.multa !== 'NO' && (
            <div className="border-t border-slate-100 pt-3">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Multa</p>
                <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${point.multa === 'SI' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                  {point.multa}
                </span>
              </div>
              {isValid(point.observaciones_multa) && (
                <p className="text-[12px] text-slate-600 bg-slate-50 rounded-lg px-3 py-2 leading-relaxed">{point.observaciones_multa}</p>
              )}
            </div>
          )}

          {/* Mal ejecutado — causes */}
          {isMal && causas.length > 0 && (
            <div className="border-t border-red-100 pt-3">
              <p className="text-[10px] font-semibold text-red-600 uppercase tracking-wider mb-2">
                Causas de Mal Ejecucion ({causas.length})
              </p>
              <div className="space-y-1.5">
                {causas.map((causa, i) => (
                  <div key={i} className="flex items-start gap-2 bg-red-50 rounded-lg px-3 py-2">
                    <span className="text-red-400 font-bold text-[11px] mt-0.5">{i + 1}.</span>
                    <span className="text-[12px] text-red-800 font-medium leading-snug">{causa}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No efectiva — causa */}
          {resultadoType === 'no_efectiva' && isValid(point.categoria_no_efectivo) && (
            <div className="border-t border-slate-200 pt-3">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Causa No Efectiva
              </p>
              <div className="bg-slate-50 rounded-lg px-3 py-2">
                <span className="text-[12px] text-slate-700 font-medium leading-snug">{point.categoria_no_efectivo!.replace(/_/g, ' ')}</span>
              </div>
            </div>
          )}

          {/* Photos from ODIS */}
          {orderId && <PhotoGallery orderId={orderId} />}
        </div>

        {/* Footer — form link */}
        {isValid(point.link_formulario) && (
          <div className="shrink-0 px-6 py-3 border-t border-slate-100 bg-slate-50">
            <a
              href={point.link_formulario}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-900 transition-colors"
            >
              <ExternalLink size={15} />
              Ver Formulario en ODIS
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
