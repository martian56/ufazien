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
  'table', 'thead', 'tbody', 'tr', 'th', 'td'
]

const ALLOWED_ATTRIBUTES = {
  'a': ['href', 'title', 'target', 'rel'],
  'img': ['src', 'alt', 'title', 'width', 'height', 'data-alignment'],
  'div': ['class', 'data-alignment'],
  'span': ['style', 'class'],
  'h1': ['class'],
  'h2': ['class'],
  'h3': ['class'],
  'h4': ['class'],
  'h5': ['class'],
  'h6': ['class'],
  'p': ['class', 'style'],
  'pre': ['class'],
  'code': ['class'],
  'blockquote': ['class'],
  'ul': ['class'],
  'ol': ['class'],
  'li': ['class'],
  'table': ['class'],
  'thead': ['class'],
  'tbody': ['class'],
  'tr': ['class'],
  'th': ['class'],
  'td': ['class'],
  'hr': ['class']
}

const ALLOWED_SCHEMES = ['http', 'https', 'mailto', 'tel']

/**
 * Sanitize HTML content to prevent XSS attacks
 * @param {string} html - Raw HTML content
 * @returns {string} - Sanitized HTML content
 */
export const sanitizeHtml = (html) => {
  if (!html || typeof html !== 'string') {
    return ''
  }

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: Object.keys(ALLOWED_ATTRIBUTES).reduce((acc, tag) => {
      return acc.concat(ALLOWED_ATTRIBUTES[tag])
    }, []),
    ALLOWED_SCHEMES,
    KEEP_CONTENT: true,
    ADD_ATTR: ['target'],
    // Hook to add security attributes to links
    HOOKS: {
      afterSanitizeAttributes: function(node) {
        // Add rel="noopener noreferrer" to external links
        if (node.tagName === 'A') {
          const href = node.getAttribute('href')
          if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
            node.setAttribute('rel', 'noopener noreferrer')
            node.setAttribute('target', '_blank')
          }
        }
        
        // Validate image sources
        if (node.tagName === 'IMG') {
          const src = node.getAttribute('src')
          if (src && !isValidImageUrl(src)) {
            node.removeAttribute('src')
          }
        }
      }
    }
  })
}

/**
 * Validate image URLs for security
 * @param {string} url - Image URL to validate
 * @returns {boolean} - Whether the URL is valid and safe
 */
export const isValidImageUrl = (url) => {
  if (!url || typeof url !== 'string') {
    return false
  }

  try {
    const urlObj = new URL(url)
    
    // Only allow HTTP/HTTPS protocols
    if (!['http:', 'https:', 'data:'].includes(urlObj.protocol)) {
      return false
    }
    
    // For data URLs, only allow image types
    if (urlObj.protocol === 'data:') {
      return /^data:image\/(jpeg|jpg|png|gif|webp|svg\+xml);/.test(url)
    }
    
    // Validate file extension for HTTP/HTTPS URLs
    const pathname = urlObj.pathname.toLowerCase()
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']
    
    return validExtensions.some(ext => pathname.endsWith(ext)) || 
           pathname.includes('/upload/') || // Allow upload endpoints
           pathname.includes('/media/') ||  // Allow media endpoints
           pathname.includes('/static/')    // Allow static file endpoints
  } catch (error) {
    return false
  }
}

/**
 * Sanitize user input text
 * @param {string} text - Raw text input
 * @param {number} maxLength - Maximum allowed length
 * @returns {string} - Sanitized text
 */
export const sanitizeText = (text, maxLength = 1000) => {
  if (!text || typeof text !== 'string') {
    return ''
  }

  // Remove any HTML tags
  const stripped = text.replace(/<[^>]*>/g, '')
  
  // Trim whitespace
  const trimmed = stripped.trim()
  
  // Limit length
  return trimmed.length > maxLength ? trimmed.substring(0, maxLength) : trimmed
}

/**
 * Validate and sanitize file uploads
 * @param {File} file - File to validate
 * @returns {Object} - Validation result
 */
export const validateImageFile = (file) => {
  const result = {
    valid: false,
    error: null
  }

  if (!file) {
    result.error = 'No file provided'
    return result
  }

  // Check file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    result.error = 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'
    return result
  }

  // Check file size (10MB limit)
  const maxSize = 10 * 1024 * 1024 // 10MB
  if (file.size > maxSize) {
    result.error = 'File too large. Maximum size is 10MB.'
    return result
  }

  // Check file name for security
  const fileName = file.name.toLowerCase()
  const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
  const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext))
  
  if (!hasValidExtension) {
    result.error = 'Invalid file extension.'
    return result
  }

  // Check for suspicious file names
  const suspiciousPatterns = ['.php', '.js', '.html', '.htm', '.exe', '.bat']
  const hasSuspiciousPattern = suspiciousPatterns.some(pattern => fileName.includes(pattern))
  
  if (hasSuspiciousPattern) {
    result.error = 'Suspicious file name detected.'
    return result
  }

  result.valid = true
  return result
}

/**
 * Generate Content Security Policy
 * @returns {string} - CSP header value
 */
export const generateCSP = () => {
  return [
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
    "manifest-src 'self'"
  ].join('; ')
}

/**
 * Rate limiting utility for API calls
 */
export class RateLimiter {
  constructor(maxRequests = 10, windowMs = 60000) {
    this.maxRequests = maxRequests
    this.windowMs = windowMs
    this.requests = new Map()
  }

  isAllowed(identifier) {
    const now = Date.now()
    const windowStart = now - this.windowMs
    
    if (!this.requests.has(identifier)) {
      this.requests.set(identifier, [])
    }
    
    const userRequests = this.requests.get(identifier)
    
    // Remove old requests outside the window
    const recentRequests = userRequests.filter(timestamp => timestamp > windowStart)
    this.requests.set(identifier, recentRequests)
    
    if (recentRequests.length >= this.maxRequests) {
      return false
    }
    
    recentRequests.push(now)
    return true
  }
}

// Export configured rate limiter instance
export const apiRateLimiter = new RateLimiter(50, 60000) // 50 requests per minute
export const uploadRateLimiter = new RateLimiter(10, 60000) // 10 uploads per minute
