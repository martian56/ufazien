import { describe, expect, it } from 'vitest'
import {
  RateLimiter,
  isValidImageUrl,
  sanitizeHtml,
  sanitizeText,
  validateImageFile,
} from './security'

describe('sanitizeHtml', () => {
  it('strips script tags', () => {
    expect(sanitizeHtml('<p>hi</p><script>alert(1)</script>')).not.toContain('script')
  })

  it('strips inline event handlers', () => {
    expect(sanitizeHtml('<p onclick="alert(1)">hi</p>')).not.toContain('onclick')
  })

  it('drops javascript: URLs', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).not.toContain('javascript:')
  })

  it('keeps allowed formatting', () => {
    const out = sanitizeHtml('<h2>Title</h2><p><strong>bold</strong></p>')
    expect(out).toContain('<h2>')
    expect(out).toContain('<strong>')
  })

  it('handles null and non-strings', () => {
    expect(sanitizeHtml(null)).toBe('')
    expect(sanitizeHtml(undefined)).toBe('')
  })

  // These two were configured through a `HOOKS` key, which DOMPurify does not
  // read: hooks must be registered with addHook. Both silently did nothing.
  it('hardens external links', () => {
    const out = sanitizeHtml('<a href="https://example.com">x</a>')
    expect(out).toContain('rel="noopener noreferrer"')
    expect(out).toContain('target="_blank"')
  })

  it('removes an image src that fails validation', () => {
    const out = sanitizeHtml('<img src="https://evil.test/payload.exe">')
    expect(out).not.toContain('payload.exe')
  })

  it('keeps a legitimate image src', () => {
    const out = sanitizeHtml('<img src="https://cdn.test/photo.png">')
    expect(out).toContain('photo.png')
  })
})

describe('isValidImageUrl', () => {
  it.each([
    ['https://cdn.test/a.png', true],
    ['https://cdn.test/a.jpeg', true],
    ['https://cdn.test/media/whatever', true],
    ['https://cdn.test/a.exe', false],
    ['javascript:alert(1)', false],
    ['data:image/png;base64,AAA', true],
    ['data:text/html;base64,AAA', false],
  ])('%s -> %s', (url, expected) => {
    expect(isValidImageUrl(url)).toBe(expected)
  })

  it('rejects empty input', () => {
    expect(isValidImageUrl('')).toBe(false)
    expect(isValidImageUrl(null)).toBe(false)
  })
})

describe('sanitizeText', () => {
  it('removes tags and trims', () => {
    expect(sanitizeText('  <b>hello</b> ')).toBe('hello')
  })

  it('truncates to maxLength', () => {
    expect(sanitizeText('abcdef', 3)).toBe('abc')
  })
})

describe('validateImageFile', () => {
  const file = (name: string, type: string, size: number) => {
    const f = new File(['x'], name, { type })
    Object.defineProperty(f, 'size', { value: size })
    return f
  }

  it('accepts a normal png', () => {
    expect(validateImageFile(file('a.png', 'image/png', 1000)).valid).toBe(true)
  })

  it('rejects a wrong mime type', () => {
    expect(validateImageFile(file('a.pdf', 'application/pdf', 1000)).valid).toBe(false)
  })

  it('rejects oversized files', () => {
    expect(validateImageFile(file('a.png', 'image/png', 11 * 1024 * 1024)).valid).toBe(false)
  })

  it('rejects a double extension', () => {
    expect(validateImageFile(file('a.php.png', 'image/png', 1000)).valid).toBe(false)
  })

  it('rejects nothing at all', () => {
    expect(validateImageFile(null).valid).toBe(false)
  })
})

describe('RateLimiter', () => {
  it('allows up to the limit then blocks', () => {
    const limiter = new RateLimiter(2, 60000)
    expect(limiter.isAllowed('a')).toBe(true)
    expect(limiter.isAllowed('a')).toBe(true)
    expect(limiter.isAllowed('a')).toBe(false)
  })

  it('tracks identifiers separately', () => {
    const limiter = new RateLimiter(1, 60000)
    expect(limiter.isAllowed('a')).toBe(true)
    expect(limiter.isAllowed('b')).toBe(true)
  })
})
