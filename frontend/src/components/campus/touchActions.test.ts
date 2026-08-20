import { describe, it, expect } from 'vitest'

import {
  EMOTE_CONTROLS,
  RUN_DEFLECTION,
  createTouchActions,
  isRunning,
  mergeTouch,
} from './touchActions'
import { CAMPUS_KEY_MAP } from './keyBindings'

/**
 * Touch and keyboard are one set of controls.
 *
 * Every controller in the campus reads drei's keyboard map, and the touch layer
 * only ever wrote movement, jump and the door — so sitting down, leaning,
 * picking things up, the light switch and all four emotes were keyboard-only.
 */
describe('merging the two surfaces', () => {
  const keysAllUp = (): Record<string, boolean> =>
    Object.fromEntries(CAMPUS_KEY_MAP.map((control) => [control.name, false]))

  it('covers every action the keyboard has', () => {
    // A control the touch layer cannot reach is one a phone cannot use. Movement
    // is the exception: the joystick writes a vector, not four booleans.
    const movement = new Set(['forward', 'backward', 'leftward', 'rightward'])
    const touch = { ...createTouchActions(), emote: '' as const }
    const reachable = new Set([...Object.keys(touch), ...EMOTE_CONTROLS])

    const unreachable = CAMPUS_KEY_MAP.map((c) => c.name)
      .filter((name) => !movement.has(name))
      .filter((name) => !reachable.has(name))

    expect(unreachable, 'these controls exist on a keyboard and nowhere else').toEqual([])
  })

  it('holds a control the thumb is holding', () => {
    const merged = mergeTouch(keysAllUp(), { ...createTouchActions(), sit: true })
    expect(merged.sit).toBe(true)
    expect(merged.lean).toBe(false)
  })

  it('does not release a key because the thumb is off it', () => {
    // A tablet with a keyboard attached: neither surface may cancel the other.
    const merged = mergeTouch({ ...keysAllUp(), grab: true }, createTouchActions())
    expect(merged.grab).toBe(true)
  })

  it('turns the chosen emote into the control the keyboard would press', () => {
    const merged = mergeTouch(keysAllUp(), { ...createTouchActions(), emote: 'clap' })
    expect(merged.clap).toBe(true)
    expect(merged.wave).toBe(false)
    expect(merged.point).toBe(false)
  })

  it('leaves the keyboard alone when there is no touch state', () => {
    const keys = { ...keysAllUp(), jump: true }
    expect(mergeTouch(keys, null)).toBe(keys)
  })

  it('does not mutate what it is given', () => {
    const keys = keysAllUp()
    mergeTouch(keys, { ...createTouchActions(), sit: true, emote: 'wave' })
    expect(keys.sit).toBe(false)
    expect(keys.wave).toBe(false)
  })

  it('starts with nothing held', () => {
    const fresh = createTouchActions()
    expect(Object.values(fresh).every((held) => held === false || held === '')).toBe(true)
  })
})

/**
 * Running.
 *
 * Shift is a modifier and a thumb has none, so the stick says it: walk near the
 * middle, run at the edge.
 */
describe('running from the stick', () => {
  it('walks when the stick is barely over', () => {
    expect(isRunning({ x: 0, y: 0 })).toBe(false)
    expect(isRunning({ x: 0, y: -0.5 })).toBe(false)
  })

  it('runs when it is pushed to the edge', () => {
    expect(isRunning({ x: 0, y: -1 })).toBe(true)
    expect(isRunning({ x: 0.75, y: -0.75 })).toBe(true) // a diagonal is 1.06
  })

  it('is reached before the rim, which a thumb often falls short of', () => {
    expect(RUN_DEFLECTION).toBeGreaterThan(0.5)
    expect(RUN_DEFLECTION).toBeLessThan(1)
    expect(isRunning({ x: 0, y: -RUN_DEFLECTION })).toBe(true)
  })
})
