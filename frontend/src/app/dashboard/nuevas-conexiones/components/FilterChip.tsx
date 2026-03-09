'use client'

import { X } from 'lucide-react'
import type { DrillFilter } from '../types'

export function FilterChip({ filter, onRemove }: { filter: DrillFilter; onRemove: (key: string) => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
      <span className="text-slate-500">{filter.label}:</span>
      {filter.value}
      <button
        onClick={() => onRemove(filter.key)}
        className="ml-0.5 text-slate-400 hover:text-slate-600 transition-colors"
        aria-label={`Quitar filtro ${filter.label}`}
      >
        <X size={12} />
      </button>
    </span>
  )
}
