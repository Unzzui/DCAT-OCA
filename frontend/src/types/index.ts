// User types
export type UserRole = 'admin' | 'editor' | 'viewer'

export interface User {
  id: number
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  created_at: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}

// Nuevas Conexiones types
export interface NuevaConexion {
  id: number
  n_cliente: string
  fecha_reporte: string
  estado_nv: string
  etapa_nv: string
  comuna: string
  fecha_protocolo: string | null
  n_medidor: string | null
  potencia_instalada: number | null
  tipo_cliente: string
  tension: string
  tarifa: string
  ejecutor: string
  subestacion: string
  zona: string
}

export interface NuevasConexionesFilters {
  fecha_desde?: string
  fecha_hasta?: string
  mes?: string
  zona?: string
  tipo_cliente?: string
  estado?: string
  comuna?: string
  page?: number
  limit?: number
  sort_by?: string
  order?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  pages: number
}

export interface NuevasConexionesStats {
  total: number
  por_estado: Record<string, number>
  por_zona: Record<string, number>
  por_tipo_cliente: Record<string, number>
  por_mes: Array<{ mes: string; cantidad: number }>
  potencia_total: number
}

// General types
export interface SelectOption {
  value: string
  label: string
}

export interface ApiError {
  detail: string
}
