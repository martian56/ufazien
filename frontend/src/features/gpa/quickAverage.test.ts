import { describe, it, expect } from 'vitest'

import { UFAZ_BANDS, bandFor, gradePointFor, weightedAverage } from './quickAverage'

describe('bandFor', () => {
  it('places a mark in its band', () => {
    expect(bandFor(18).letter).toBe('A+')
    expect(bandFor(14).letter).toBe('A')
    expect(bandFor(12).letter).toBe('B')
    expect(bandFor(10.5).letter).toBe('C')
    expect(bandFor(4).letter).toBe('F')
  })

  it('includes twenty rather than dropping it off the end', () => {
    // The bands are half-open, so a perfect mark falls past the top one unless
    // that band is closed at both ends.
    expect(bandFor(20).letter).toBe('A+')
    expect(bandFor(20).gpa).toBe(4)
  })

  it('puts a boundary mark in the higher band', () => {
    expect(bandFor(16).letter).toBe('A+')
    expect(bandFor(13.5).letter).toBe('A')
    expect(bandFor(11.5).letter).toBe('B')
    expect(bandFor(10).letter).toBe('C')
  })

  it('clamps nonsense rather than refusing to answer', () => {
    // The terminal is a numeric field somebody can type 25 into.
    expect(bandFor(25).letter).toBe('A+')
    expect(bandFor(-4).letter).toBe('F')
    expect(bandFor(Number.NaN).letter).toBe('F')
  })

  it('covers the whole scale with no gaps', () => {
    for (let mark = 0; mark <= 20; mark += 0.25) {
      expect(bandFor(mark), `no band for ${mark}`).toBeDefined()
    }
    expect(UFAZ_BANDS[0].max).toBe(20)
  })
})

describe('weightedAverage', () => {
  it('weights by credits rather than counting courses', () => {
    // 16 over six credits and 10 over two is not thirteen.
    const rows = [
      { mark: 16, credits: 6 },
      { mark: 10, credits: 2 },
    ]
    expect(weightedAverage(rows)).toBeCloseTo(14.5)
  })

  it('reports nothing rather than zero for no courses', () => {
    // Zero is a failing grade. Showing it to somebody who has typed nothing
    // says something false about them.
    expect(weightedAverage([])).toBeNull()
    expect(weightedAverage([{ mark: 15, credits: 0 }])).toBeNull()
  })

  it('ignores a half-typed row rather than poisoning the total', () => {
    const rows = [
      { mark: 16, credits: 6 },
      { mark: Number.NaN, credits: 3 },
      { mark: 12, credits: Number.NaN },
    ]
    expect(weightedAverage(rows)).toBeCloseTo(16)
  })

  it('ignores a negative credit count', () => {
    const rows = [
      { mark: 16, credits: 6 },
      { mark: 20, credits: -6 },
    ]
    expect(weightedAverage(rows)).toBeCloseTo(16)
  })

  it('clamps a mark outside the scale', () => {
    expect(weightedAverage([{ mark: 40, credits: 1 }])).toBe(20)
    expect(weightedAverage([{ mark: -5, credits: 1 }])).toBe(0)
  })
})

describe('gradePointFor', () => {
  it('converts the weighted average, not the average of the points', () => {
    // These differ: two A+ courses and one F average to a B by mark, which is
    // 3.0 — averaging the grade points instead gives 2.67.
    const rows = [
      { mark: 18, credits: 1 },
      { mark: 18, credits: 1 },
      { mark: 2, credits: 1 },
    ]
    expect(weightedAverage(rows)).toBeCloseTo(12.667, 2)
    expect(gradePointFor(rows)).toBe(3)
  })

  it('reports nothing for no courses', () => {
    expect(gradePointFor([])).toBeNull()
  })
})
