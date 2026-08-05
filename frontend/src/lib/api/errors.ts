/** Everything the API layer throws, so callers can branch on status instead of parsing messages. */
export class ApiError extends Error {
  readonly status: number
  readonly url: string
  /** Parsed response body, when the server sent one. */
  readonly body: unknown

  constructor(message: string, status: number, url: string, body: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.url = url
    this.body = body
  }

  get isUnauthorized(): boolean {
    return this.status === 401
  }

  get isForbidden(): boolean {
    return this.status === 403
  }

  get isNotFound(): boolean {
    return this.status === 404
  }

  /** True when the request never reached the server. */
  get isNetworkError(): boolean {
    return this.status === 0
  }

  /**
   * The message worth showing a user.
   *
   * DRF reports errors in several shapes: {detail}, {field: [messages]}, or a
   * bare string. Callers should not each rediscover that.
   */
  get userMessage(): string {
    const body = this.body

    if (typeof body === 'string' && body.trim()) return body

    if (body && typeof body === 'object') {
      const record = body as Record<string, unknown>

      for (const key of ['detail', 'error', 'message']) {
        const value = record[key]
        if (typeof value === 'string' && value.trim()) return value
      }

      // First field error, e.g. {email: ["This field is required."]}
      for (const value of Object.values(record)) {
        if (typeof value === 'string' && value.trim()) return value
        if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
      }
    }

    if (this.isNetworkError) return 'Could not reach the server. Check your connection.'
    return this.message
  }
}

/**
 * The message to show for anything thrown.
 *
 * Under `strict`, a caught value is `unknown`, so every `catch (err)` block
 * would otherwise need the same three checks before reaching `err.message`.
 */
export function errorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (error instanceof ApiError) return error.userMessage
  if (error instanceof Error) return error.message
  if (typeof error === 'string' && error.trim()) return error
  return fallback
}
