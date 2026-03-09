'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, X } from 'lucide-react'

interface MultiSelectProps {
  options: string[]
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
  className?: string
}

export default function MultiSelect({ options, selected, onChange, placeholder = 'Todos', className = '' }: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = useCallback((val: string) => {
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val])
  }, [selected, onChange])

  const clear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onChange([])
  }, [onChange])

  const label = selected.length === 0
    ? placeholder
    : selected.length === 1
      ? selected[0]
      : `${selected.length} seleccionados`

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="h-8 w-full flex items-center justify-between gap-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-600 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300 transition-colors"
      >
        <span className="truncate">{label}</span>
        <span className="flex items-center gap-0.5 shrink-0">
          {selected.length > 0 && (
            <span onClick={clear} className="p-0.5 rounded hover:bg-slate-100">
              <X size={11} className="text-slate-400" />
            </span>
          )}
          <ChevronDown size={12} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[180px] max-h-[240px] overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg py-1">
          {options.map(opt => (
            <label
              key={opt}
              className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 cursor-pointer text-[11px] text-slate-600"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggle(opt)}
                className="rounded border-slate-300 text-slate-700 focus:ring-slate-300 h-3 w-3"
              />
              <span className="truncate">{opt}</span>
            </label>
          ))}
          {options.length === 0 && (
            <div className="px-2 py-2 text-[10px] text-slate-400">Sin opciones</div>
          )}
        </div>
      )}
    </div>
  )
}
