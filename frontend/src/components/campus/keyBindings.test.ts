import { describe, expect, it } from 'vitest'
import {
  CAMPUS_KEY_MAP,
  HUD_KEYS,
  KEY_BINDINGS,
  KEY_GROUPS,
  bindingsIn,
  hudActionFor,
} from './keyBindings'

describe('the movement key map', () => {
  it('names every control exactly once', () => {
    const names = CAMPUS_KEY_MAP.map((control) => control.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('binds each physical key to a single control', () => {
    const seen = new Map<string, string>()
    for (const control of CAMPUS_KEY_MAP) {
      for (const key of control.keys) {
        expect(seen.get(key), `${key} is bound to two controls`).toBeUndefined()
        seen.set(key, control.name)
      }
    }
  })
})

describe('what the settings panel shows', () => {
  it('has a row for every control the game listens for', () => {
    const documented = new Set(KEY_BINDINGS.map((binding) => binding.action).filter(Boolean))
    for (const control of CAMPUS_KEY_MAP) {
      expect(documented.has(control.name), `${control.name} is unlisted`).toBe(true)
    }
  })

  it('does not describe a control that no longer exists', () => {
    const live = new Set(CAMPUS_KEY_MAP.map((control) => control.name))
    for (const binding of KEY_BINDINGS) {
      if (!binding.action) continue
      expect(live.has(binding.action), `${binding.action} is documented but unbound`).toBe(true)
    }
  })

  it('puts every binding in a group the panel renders', () => {
    const rendered = KEY_GROUPS.flatMap((group) => bindingsIn(group))
    expect(rendered).toHaveLength(KEY_BINDINGS.length)
  })

  it('labels every binding with at least one key', () => {
    for (const binding of KEY_BINDINGS) {
      expect(binding.keys.length, binding.label).toBeGreaterThan(0)
      expect(binding.label.trim()).not.toBe('')
    }
  })
})

describe('the panel hotkeys', () => {
  it('never reuses a key the player walks with', () => {
    const movement = new Set(CAMPUS_KEY_MAP.flatMap((control) => control.keys))
    for (const [action, code] of Object.entries(HUD_KEYS)) {
      expect(movement.has(code), `${action} steals ${code} from movement`).toBe(false)
    }
  })

  it('gives each panel a key of its own', () => {
    const codes = Object.values(HUD_KEYS)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('resolves a press to its action', () => {
    expect(hudActionFor('KeyM')).toBe('map')
    expect(hudActionFor('KeyT')).toBe('chat')
    expect(hudActionFor('KeyB')).toBe('mute')
  })

  it('ignores a key it does not own', () => {
    expect(hudActionFor('KeyW')).toBeNull()
    expect(hudActionFor('Escape')).toBeNull()
  })
})
