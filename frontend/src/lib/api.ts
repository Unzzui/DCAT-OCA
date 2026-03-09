import Cookies from 'js-cookie'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>
}

interface CacheEntry<T> {
  data: T
  timestamp: number
}

class ApiClient {
  private baseUrl: string
  private cache = new Map<string, CacheEntry<unknown>>()
  private inflight = new Map<string, Promise<unknown>>()
  private defaultTtl = 120_000 // 2 min cache

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  clearCache() {
    this.cache.clear()
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    const token = Cookies.get('access_token')
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    return headers
  }

  private buildUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined>): string {
    const url = new URL(`${this.baseUrl}${endpoint}`)

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value))
        }
      })
    }

    return url.toString()
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { params, ...fetchOptions } = options
    const url = this.buildUrl(endpoint, params)

    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        ...this.getHeaders(),
        ...fetchOptions.headers,
      },
    })

    if (!response.ok) {
      if (response.status === 401) {
        Cookies.remove('access_token')
        window.location.href = '/login'
      }

      const error = await response.json().catch(() => ({ detail: 'Error de conexion' }))
      throw new Error(error.detail || 'Error en la solicitud')
    }

    return response.json()
  }

  async get<T>(endpoint: string, params?: Record<string, string | number | boolean | undefined>, options?: { ttl?: number; noCache?: boolean }): Promise<T> {
    const cacheKey = this.buildUrl(endpoint, params)
    const ttl = options?.ttl ?? this.defaultTtl

    // Return cached data if fresh
    if (!options?.noCache) {
      const cached = this.cache.get(cacheKey)
      if (cached && Date.now() - cached.timestamp < ttl) {
        return cached.data as T
      }
    }

    // Deduplicate in-flight requests
    const existing = this.inflight.get(cacheKey)
    if (existing) return existing as Promise<T>

    const promise = this.request<T>(endpoint, { method: 'GET', params })
      .then((data) => {
        this.cache.set(cacheKey, { data, timestamp: Date.now() })
        this.inflight.delete(cacheKey)
        return data
      })
      .catch((err) => {
        this.inflight.delete(cacheKey)
        throw err
      })

    this.inflight.set(cacheKey, promise)
    return promise
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' })
  }

  async uploadFile<T>(endpoint: string, file: File, fieldName = 'file'): Promise<T> {
    const formData = new FormData()
    formData.append(fieldName, file)

    const token = Cookies.get('access_token')
    const headers: HeadersInit = {}
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Error al subir archivo' }))
      throw new Error(error.detail || 'Error al subir archivo')
    }

    return response.json()
  }

  getDownloadUrl(endpoint: string): string {
    const token = Cookies.get('access_token')
    const url = new URL(`${this.baseUrl}${endpoint}`)
    if (token) {
      url.searchParams.append('token', token)
    }
    return url.toString()
  }

  async downloadFile(endpoint: string, filename: string, params?: Record<string, string | number | boolean | undefined>): Promise<void> {
    const url = this.buildUrl(endpoint, params)

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      if (response.status === 401) {
        Cookies.remove('access_token')
        window.location.href = '/login'
      }
      const error = await response.json().catch(() => ({ detail: 'Error al descargar' }))
      throw new Error(error.detail || 'Error al descargar archivo')
    }

    const blob = await response.blob()
    const downloadUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(downloadUrl)
  }
}

export const api = new ApiClient(API_URL)
