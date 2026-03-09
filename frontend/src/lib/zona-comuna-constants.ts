/**
 * Zona-Comuna constants for NNCC (Nuevas Conexiones) module.
 * Extracted from database analysis of 43,210 records.
 * Last updated: 2026-03-02
 */

export const ZONA_COMUNA_MAPPING = {
  CHACABUCO: [
    'CERRO NAVIA',
    'COLINA',
    'CONCHALI',
    'CONCHALÍ',
    'HUECHURABA',
    'INDEPENDENCIA',
    'LAMPA',
    'QUILICURA',
    'QUINTA NORMAL',
    'RECOLETA',
    'RENCA',
    'TIL TIL',
    'TILTIL',
  ],
  CORDILLERA: [
    'INDEPENDENCIA',
    'LAS CONDES',
    'LO BARNECHEA',
    'PROVIDENCIA',
    'RECOLETA',
    'SANTIAGO',
    'VITACURA',
  ],
  FLORIDA: [
    'LA CISTERNA',
    'LA FLORIDA',
    'LA GRANJA',
    'LA REINA',
    'MACUL',
    'NUNOA',
    'PENALOLEN',
    'PEÑALOLEN',
    'PEÑALOLÉN',
    'SAN JOAQUIN',
    'SAN RAMON',
    'ÑUÑOA',
  ],
  PACIFICO: [
    'CERRILLOS',
    'ESTACION CENTRAL',
    'LO ESPEJO',
    'LO PRADO',
    'MAIPU',
    'MAIPÚ',
    'PEDRO AGUIRRE CERDA',
    'PUDAHUEL',
    'SAN MIGUEL',
  ],
} as const

export type Zona = keyof typeof ZONA_COMUNA_MAPPING

// All valid zonas
export const VALID_ZONAS: Zona[] = Object.keys(ZONA_COMUNA_MAPPING) as Zona[]

// All valid comunas (deduplicated and sorted)
export const VALID_COMUNAS: string[] = Array.from(
  new Set(
    Object.values(ZONA_COMUNA_MAPPING).flatMap((comunas) => [...comunas])
  )
).sort()

// Reverse mapping: Comuna -> List of Zonas (for disambiguation)
const _buildComunaZonaMapping = () => {
  const mapping: Record<string, Zona[]> = {}
  for (const [zona, comunas] of Object.entries(ZONA_COMUNA_MAPPING)) {
    for (const comuna of comunas) {
      if (!mapping[comuna]) {
        mapping[comuna] = []
      }
      mapping[comuna].push(zona as Zona)
    }
  }
  return mapping
}

export const COMUNA_ZONA_MAPPING = _buildComunaZonaMapping()

/**
 * Get list of comunas for a given zona
 */
export function getComunasForZona(zona: string): readonly string[] {
  return ZONA_COMUNA_MAPPING[zona as Zona] || []
}

/**
 * Get list of zonas for a given comuna (may have multiple)
 */
export function getZonasForComuna(comuna: string): Zona[] {
  return COMUNA_ZONA_MAPPING[comuna] || []
}

/**
 * Check if a zona is valid
 */
export function isValidZona(zona: string): zona is Zona {
  return zona in ZONA_COMUNA_MAPPING
}

/**
 * Check if a comuna is valid
 */
export function isValidComuna(comuna: string): boolean {
  return VALID_COMUNAS.includes(comuna)
}

/**
 * Check if a zona-comuna pair is valid
 */
export function isValidZonacomunaPair(zona: string, comuna: string): boolean {
  if (!isValidZona(zona)) {
    return false
  }
  return ([...ZONA_COMUNA_MAPPING[zona as Zona]] as string[]).includes(comuna)
}
