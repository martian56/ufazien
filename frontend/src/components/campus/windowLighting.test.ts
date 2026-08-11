import { describe, it, expect } from 'vitest'
import { splitLitWindows, type WindowPlacement } from './windowLighting'

const facade = (count: number): WindowPlacement[] =>
  Array.from({ length: count }, (_, i) => ({ x: i, y: 0, z: 0, ry: 0 }))

describe('splitLitWindows', () => {
  it('leaves every window dark by day', () => {
    const items = facade(50)
    const { onItems, offItems } = splitLitWindows(items, false, 1)
    expect(onItems).toEqual([])
    expect(offItems).toBe(items)
  })

  it('lights some but not all of them at night', () => {
    const { onItems, offItems } = splitLitWindows(facade(100), true, 1)
    expect(onItems.length).toBeGreaterThan(20)
    expect(offItems.length).toBeGreaterThan(20)
  })

  it('accounts for every window exactly once', () => {
    const items = facade(137)
    const { onItems, offItems } = splitLitWindows(items, true, 9)
    expect(onItems.length + offItems.length).toBe(items.length)
    const seen = new Set([...onItems, ...offItems].map((w) => w.x))
    expect(seen.size).toBe(items.length)
  })

  it('is stable, so a building does not flicker between frames', () => {
    const items = facade(60)
    expect(splitLitWindows(items, true, 4)).toEqual(splitLitWindows(items, true, 4))
  })

  it('differs between buildings, so a street is not in lockstep', () => {
    const items = facade(60)
    const a = splitLitWindows(items, true, 4).onItems.map((w) => w.x)
    const b = splitLitWindows(items, true, 5).onItems.map((w) => w.x)
    expect(a).not.toEqual(b)
  })

  it('does not light every third window in a stripe', () => {
    // The failure mode of a modulo: a visible diagonal band up the facade.
    const lit = new Set(splitLitWindows(facade(90), true, 3).onItems.map((w) => w.x))
    const everyThird = [0, 3, 6, 9, 12, 15, 18, 21].every((i) => lit.has(i))
    const neverThird = [0, 3, 6, 9, 12, 15, 18, 21].every((i) => !lit.has(i))
    expect(everyThird || neverThird).toBe(false)
  })

  it('handles an empty facade', () => {
    expect(splitLitWindows([], true, 1)).toEqual({ onItems: [], offItems: [] })
  })
})
