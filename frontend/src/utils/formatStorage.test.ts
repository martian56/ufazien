import { describe, it, expect } from 'vitest'

import { subscriptionHelpers } from './hostingApi'

/**
 * Sizes as a person would say them.
 *
 * `${0.02} MB` reads as nothing at all, which is what the bandwidth panel
 * showed for a real day's traffic — the sites here serve kilobytes a day.
 */
describe('writing a size', () => {
  const format = subscriptionHelpers.formatStorage

  it('uses kilobytes below a megabyte', () => {
    expect(format(0.02)).toBe('20 KB')
    expect(format(0.5)).toBe('512 KB')
  })

  it('does not print a long decimal at the reader', () => {
    expect(format(1234.5678)).toBe('1.2 GB')
    expect(format(12.3456)).toBe('12 MB')
  })

  it('keeps one decimal while the number is small', () => {
    expect(format(1.5)).toBe('1.5 MB')
  })

  it('goes to gigabytes when it should', () => {
    expect(format(1024)).toBe('1.0 GB')
    expect(format(10240)).toBe('10.0 GB')
  })

  it('says nothing is nothing', () => {
    expect(format(0)).toBe('0 MB')
    expect(format(-5)).toBe('0 MB')
    expect(format(NaN)).toBe('0 MB')
  })
})
