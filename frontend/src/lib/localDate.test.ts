import { describe, it, expect, afterEach, vi } from 'vitest'
import { toLocalDateKey, todayKey } from './localDate'

describe('toLocalDateKey', () => {
  it('keeps the local day for a date built from local parts', () => {
    // The calendar grid builds every cell this way: local midnight.
    expect(toLocalDateKey(new Date(2026, 7, 20))).toBe('2026-08-20')
  })

  it('does not shift the day east of Greenwich', () => {
    // Baku is UTC+4, so local midnight on the 21st is 20:00 UTC on the 20th.
    // toISOString() answers "2026-08-20" there, which put every event in the
    // calendar one cell late for the entire user base.
    const cell = new Date('2026-08-21T00:00:00+04:00')
    expect(cell.toISOString().split('T')[0]).toBe('2026-08-20')
    expect(toLocalDateKey(cell)).toBe(
      `${cell.getFullYear()}-${String(cell.getMonth() + 1).padStart(2, '0')}-${String(
        cell.getDate()
      ).padStart(2, '0')}`
    )
  })

  it('pads single-digit months and days', () => {
    expect(toLocalDateKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('handles the last day of a year', () => {
    expect(toLocalDateKey(new Date(2026, 11, 31))).toBe('2026-12-31')
  })
})

describe('todayKey', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses the local day, not the UTC one', () => {
    vi.useFakeTimers()
    // Late enough in the evening that UTC has already rolled over in Baku.
    const now = new Date(2026, 7, 20, 23, 30)
    vi.setSystemTime(now)

    expect(todayKey()).toBe('2026-08-20')
  })
})
