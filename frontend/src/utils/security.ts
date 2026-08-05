import DOMPurify from 'dompurify'

// Configure DOMPurify with safe settings for blog content
const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'div', 'span',
  'strong', 'b', 'em', 'i', 'u', 's', 'mark',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code',
  'a', 'img',
  'hr',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
]

const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  a: ['href', 'title', 'target', 'rel'],
  img: ['src', 'alt', 'title', 'width', 'height', 'data-alignment'],
  div: ['class', 'data-alignment'],
  span: ['style', 'class'],
  h1: ['class'],
  h2: ['class'],
  h3: ['class'],
  h4: ['class'],
  h5: ['class'],
  h6: ['class'],
  p: ['class', 'style'],
  pre: ['class'],
  code: ['class'],
  blockquote: ['class'],
  ul: ['class'],
  ol: ['class'],
  li: ['class'],
  table: ['class'],
  thead: ['class'],
  tbody: ['class'],
  tr: ['class'],
  th: ['class'],
  td: ['class'],
  hr: ['class'],
}

const ALLOWED_ATTR = [...new Set(Object.values(ALLOWED_ATTRIBUTES).flat())]

/**
 * Harden links and images after sanitising.
 *
 * DOMPurify's `HOOKS` config key does not exist: hooks are registered with
 * DOMPurify.addHook. Passing them in the config object silently did nothing, so
 * external links never got rel="noopener noreferrer" and image sources were
 * never validated. Registered once at module load instead.
 */
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  const element = node as Element

  if (element.tagName === 'A') {
    const href = element.getAttribute('href')
    if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
      element.setAttribute('rel', 'noopener noreferrer')
      element.setAttribute('target', '_blank')
    }
  }

  if (element.tagName === 'IMG') {
    const src = element.getAttribute('src')
    if (src && !isValidImageUrl(src)) {
      element.removeAttribute('src')
    }
  }
})

/** Sanitize HTML content to prevent XSS attacks. */
export const sanitizeHtml = (html: string | null | undefined): string => {
  if (!html || typeof html !== 'string') return ''

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    KEEP_CONTENT: true,
    ADD_ATTR: ['target'],
  })
}

/** Validate image URLs for security. */
export const isValidImageUrl = (url: string | null | undefined): boolean => {
  if (!url || typeof url !== 'string') return false

  try {
    const urlObj = new URL(url, window.location.origin)

    // Only allow HTTP/HTTPS protocols
    if (!['http:', 'https:', 'data:'].includes(urlObj.protocol)) return false

    // For data URLs, only allow image types
    if (urlObj.protocol === 'data:') {
      return /^data:image\/(jpeg|jpg|png|gif|webp|svg\+xml);/.test(url)
    }

    // Validate file extension for HTTP/HTTPS URLs
    const pathname = urlObj.pathname.toLowerCase()
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']

    return (
      validExtensions.some((ext) => pathname.endsWith(ext)) ||
      pathname.includes('/upload/') || // Allow upload endpoints
      pathname.includes('/media/') || //  Allow media endpoints
      pathname.includes('/static/') //   Allow static file endpoints
    )
  } catch {
    return false
  }
}

/** Sanitize user input text. */
export const sanitizeText = (text: string | null | undefined, maxLength = 1000): string => {
  if (!text || typeof text !== 'string') return ''

  const stripped = text.replace(/<[^>]*>/g, '')
  const trimmed = stripped.trim()

  return trimmed.length > maxLength ? trimmed.substring(0, maxLength) : trimmed
}

export interface FileValidationResult {
  valid: boolean
  error: string | null
}

/** Validate and sanitize file uploads. */
export const validateImageFile = (file: File | null | undefined): FileValidationResult => {
  if (!file) return { valid: false, error: 'No file provided' }

  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.',
    }
  }

  const maxSize = 10 * 1024 * 1024 // 10MB
  if (file.size > maxSize) {
    return { valid: false, error: 'File too large. Maximum size is 10MB.' }
  }

  const fileName = file.name.toLowerCase()
  const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
  if (!validExtensions.some((ext) => fileName.endsWith(ext))) {
    return { valid: false, error: 'Invalid file extension.' }
  }

  const suspiciousPatterns = ['.php', '.js', '.html', '.htm', '.exe', '.bat']
  if (suspiciousPatterns.some((pattern) => fileName.includes(pattern))) {
    return { valid: false, error: 'Suspicious file name detected.' }
  }

  return { valid: true, error: null }
}

/** Generate Content Security Policy. */
export const generateCSP = (): string =>
  [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "media-src 'self'",
    "object-src 'none'",
    "frame-src 'none'",
    "worker-src 'none'",
    "manifest-src 'self'",
  ].join('; ')

/** Rate limiting utility for API calls. */
export class RateLimiter {
  private readonly maxRequests: number
  private readonly windowMs: number
  private readonly requests = new Map<string, number[]>()

  constructor(maxRequests = 10, windowMs = 60000) {
    this.maxRequests = maxRequests
    this.windowMs = windowMs
  }

  isAllowed(identifier: string): boolean {
    const now = Date.now()
    const windowStart = now - this.windowMs

    const userRequests = this.requests.get(identifier) ?? []

    // Remove old requests outside the window
    const recentRequests = userRequests.filter((timestamp) => timestamp > windowStart)
    this.requests.set(identifier, recentRequests)

    if (recentRequests.length >= this.maxRequests) return false

    recentRequests.push(now)
    return true
  }
}

// Export configured rate limiter instance
export const apiRateLimiter = new RateLimiter(50, 60000) // 50 requests per minute
export const uploadRateLimiter = new RateLimiter(10, 60000) // 10 uploads per minute
