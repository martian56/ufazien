import { ApiError } from './errors'
import { request, type RequestOptions } from './client'

interface FetchLike<T> {
  ok: boolean
  status: number
  json: () => Promise<T>
}

/**
 * A fetch-shaped wrapper around the shared client.
 *
 * The blog reading pages have dozens of call sites written against fetch:
 * `const res = await fetch(...); if (res.ok) { const data = await res.json() }`.
 * Rewriting each into try/catch would be a large, risky diff through a
 * 1,400-line component that is due to be split anyway.
 *
 * This keeps the call shape and still gets what matters: one base URL, the auth
 * header, shared token refresh, and no hand-built URLs. A failed request comes
 * back as `ok: false` rather than throwing, which is what these call sites
 * already expect.
 *
 * Prefer `api.get` and friends in new code. This exists to finish a migration,
 * not to be the pattern.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<FetchLike<T>> {
  try {
    const data = await request<T>(path, options)
    return { ok: true, status: 200, json: async () => data }
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 0
    const body = error instanceof ApiError ? error.body : null
    return { ok: false, status, json: async () => body as T }
  }
}

export default apiFetch
