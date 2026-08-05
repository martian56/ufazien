import { ApiError } from './errors'
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from './tokens'

/**
 * The single HTTP client.
 *
 * There used to be two: a fetch one in utils/api.js returning parsed JSON and
 * an axios one in services/api.js returning an envelope, and 51 call sites that
 * used neither and built URLs by hand. That is how the same bug, a relative
 * fetch to an endpoint that does not exist, shipped twice.
 *
 * This returns parsed JSON directly. There is no `.data` to unwrap.
 */

/** Base URL including the /api prefix, derived once. */
export const API_BASE_URL = buildBaseUrl()

function buildBaseUrl(): string {
  const configured = import.meta.env.VITE_API_URL || 'http://localhost:8000'
  const root = configured.replace(/\/+$/, '')
  // Tolerate VITE_API_URL being set with or without the /api suffix. The axios
  // client assumed one and its refresh call assumed the other, so refresh went
  // to a 404.
  return root.endsWith('/api') ? root : `${root}/api`
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** Serialised as JSON, unless it is FormData. */
  body?: unknown
  /** Appended as a query string; null and undefined are dropped. */
  params?: Record<string, string | number | boolean | null | undefined>
  headers?: Record<string, string>
  signal?: AbortSignal
  /** Skip the Authorization header, for login and register. */
  anonymous?: boolean
}

function buildUrl(path: string, params?: RequestOptions['params']): string {
  const url = new URL(`${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined && value !== '') {
        url.searchParams.set(key, String(value))
      }
    }
  }
  return url.toString()
}

/**
 * Shared across concurrent 401s.
 *
 * The community page fires five requests at once. Without this, an expired
 * token means five refreshes racing, four of which lose and log the user out.
 */
let refreshInFlight: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = (async () => {
    const refresh = getRefreshToken()
    if (!refresh) return null

    try {
      const response = await fetch(`${API_BASE_URL}/auth/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      })
      if (!response.ok) return null

      const data = (await response.json()) as { access?: string; refresh?: string }
      if (!data.access) return null

      setTokens(data.access, data.refresh)
      return data.access
    } catch {
      return null
    } finally {
      refreshInFlight = null
    }
  })()

  return refreshInFlight
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204 || response.headers.get('content-length') === '0') return null

  const text = await response.text()
  if (!text) return null

  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('json')) return text

  try {
    return JSON.parse(text)
  } catch {
    // A relative URL that hit the SPA instead of the API lands here as HTML.
    return text
  }
}

async function send(url: string, options: RequestOptions, token: string | null): Promise<Response> {
  const isFormData = options.body instanceof FormData

  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }

  return fetch(url, {
    method: options.method || 'GET',
    headers,
    signal: options.signal,
    body: isFormData
      ? (options.body as FormData)
      : options.body !== undefined
        ? JSON.stringify(options.body)
        : undefined,
  })
}

/** Issue a request and return the parsed body, or throw ApiError. */
export async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = buildUrl(path, options.params)
  const token = options.anonymous ? null : getAccessToken()

  let response: Response
  try {
    response = await send(url, options, token)
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
    throw new ApiError('Network request failed', 0, url, null)
  }

  // One retry after a refresh. Never for the refresh endpoint itself, which
  // would recurse.
  if (response.status === 401 && !options.anonymous && !path.includes('/auth/token/refresh')) {
    const fresh = await refreshAccessToken()
    if (fresh) {
      response = await send(url, options, fresh)
    } else {
      clearTokens()
    }
  }

  const body = await parseBody(response)

  if (!response.ok) {
    throw new ApiError(`${response.status} ${response.statusText}`.trim(), response.status, url, body)
  }

  return body as T
}

export const api = {
  get: <T = unknown>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'GET' }),

  post: <T = unknown>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'POST', body }),

  put: <T = unknown>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PUT', body }),

  patch: <T = unknown>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PATCH', body }),

  delete: <T = unknown>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'DELETE' }),
}

export { ApiError }
