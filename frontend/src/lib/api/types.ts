/** Shapes the API returns, shared by every endpoint module. */

export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

/**
 * Some endpoints paginate and some return a bare array, so call sites were all
 * writing `response.results || response`. One place to get that wrong instead
 * of thirty.
 */
export function toList<T>(response: Paginated<T> | T[] | null | undefined): T[] {
  if (!response) return []
  if (Array.isArray(response)) return response
  return response.results ?? []
}

export interface User {
  id: number
  username: string
  /** Only ever populated for the user themselves; null for everyone else. */
  email: string | null
  first_name?: string
  last_name?: string
  full_name?: string
  avatar?: string | null
  major?: string | null
  year?: string | number | null
}
