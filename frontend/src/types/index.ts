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

// Medidores Cruzados types
export interface MedidorCruzado {
  id: number
  mes: string | null
  fecha_correo: string | null
  num_cliente: string | null
  encargado_enel: string | null
  area: string | null
  etapa_caso: string | null
  fecha_asignacion: string | null
  fecha_analisis: string | null
  fecha_inspeccion: string | null
  direccion: string | null
  comuna: string | null
  medidor_sistema: string | null
  zona: string | null
  eett: string | null
  observacion_inspector: string | null
  estado_medidor: string | null
  inspector: string | null
  resultado_inspeccion: string | null
  eepp_oca: string | null
}

export interface MedidoresCruzadosStats {
  total: number
  por_zona: Record<string, number>
  por_inspector: Array<{ inspector: string; cantidad: number; tasa_bien_ejecutado: number }>
  por_estado_medidor: Record<string, number>
  por_resultado: Record<string, number>
  por_comuna: Array<{ comuna: string; cantidad: number }>
  por_mes: Array<{ mes: string; cantidad: number }>
  por_etapa_caso: Record<string, number>
  evolucion_mensual: Array<{ mes: string; total: number; bien_ejecutados: number; mal_ejecutados: number; tasa_bien_ejecutado: number }>
}

// Admin types
export interface UserAdmin {
  id: number
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  created_at: string
  updated_at: string | null
  last_login: string | null
}

export interface UserCreateRequest {
  email: string
  full_name: string
  password: string
  role: UserRole
  is_active: boolean
}

export interface UserUpdateRequest {
  email?: string
  full_name?: string
  role?: UserRole
  is_active?: boolean
}

// General types
export interface SelectOption {
  value: string
  label: string
}

export interface ApiError {
  detail: string
}
