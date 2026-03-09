// Executive color palette — sober, authoritative, minimal
// Only 4 semantic colors: base, positive, negative, neutral
export const CHART_COLORS = {
  primary: '#475569',     // Slate 600 — authoritative base
  secondary: '#64748b',   // Slate 500 — secondary data
  danger: '#b91c1c',      // Deep red — risk / mal ejecutado
  warning: '#92400e',     // Deep amber — caution
  muted: '#94a3b8',       // Slate 400 — neutral / background data
  success: '#15803d',     // Deep green — bien ejecutado
  accent: '#475569',      // Same as primary — no accent color needed
  light: '#e2e8f0',       // Grid lines
}

// Consistent tooltip styling across all charts
export const TOOLTIP_STYLE = {
  backgroundColor: '#ffffff',
  borderColor: '#e2e8f0',
  borderWidth: 1,
  textStyle: { color: '#334155', fontSize: 12, fontFamily: 'inherit' },
  padding: [8, 12],
}

// Grid with breathing room
export const GRID_STYLE = {
  left: 12,
  right: 24,
  bottom: 40,
  top: 20,
  containLabel: true,
}

// Axis styling — minimal, clean
export const AXIS_STYLE = {
  axisLine: { show: false },
  axisTick: { show: false },
  axisLabel: { fontSize: 11, color: '#64748b' },
  splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' as const } },
}

export const CATEGORY_AXIS = {
  ...AXIS_STYLE,
  splitLine: { show: false },
}

// Legend — subtle, bottom-aligned
export const LEGEND_STYLE = {
  bottom: 0,
  textStyle: { fontSize: 11, color: '#64748b' },
  icon: 'roundRect',
  itemWidth: 12,
  itemHeight: 8,
  itemGap: 16,
}

// Distinct colors per contratista — sober, professional, still distinguishable
export const CONTRATISTA_COLORS = [
  '#1e40af', // Blue 800
  '#9333ea', // Purple 600
  '#0d9488', // Teal 600
  '#c2410c', // Orange 700
  '#4f46e5', // Indigo 600
  '#0369a1', // Sky 700
  '#b91c1c', // Red 700
  '#15803d', // Green 700
  '#7c3aed', // Violet 600
  '#a16207', // Yellow 700
]

// Bar radius for polished look
export const BAR_RADIUS = [3, 3, 0, 0] as [number, number, number, number]
export const BAR_RADIUS_H = [0, 3, 3, 0] as [number, number, number, number]
