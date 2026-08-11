import { describe, it, expect } from 'vitest'
import { avatarLook, avatarSeed } from './avatarAppearance'

describe('avatarSeed', () => {
  it('is stable for the same id', () => {
    expect(avatarSeed(42)).toBe(avatarSeed(42))
    expect(avatarSeed('42')).toBe(avatarSeed('42'))
  })

  it('treats the numeric and string form of an id as the same person', () => {
    // The socket sends ids as numbers, the route as strings, and the same
    // student must not change face depending on which one reached the avatar.
    expect(avatarSeed(7)).toBe(avatarSeed('7'))
  })

  it('separates different ids', () => {
    expect(avatarSeed(1)).not.toBe(avatarSeed(2))
  })

  it('stays a non-negative 32-bit integer', () => {
    for (const id of [0, 1, 999999, 'abc', '-3']) {
      const seed = avatarSeed(id)
      expect(Number.isInteger(seed)).toBe(true)
      expect(seed).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('avatarLook', () => {
  it('gives the same person the same appearance every time', () => {
    expect(avatarLook(31)).toEqual(avatarLook(31))
  })

  it('does not give everybody the same appearance', () => {
    const looks = Array.from({ length: 40 }, (_, i) => JSON.stringify(avatarLook(i + 1)))
    // Not a hard uniqueness guarantee — the palettes are finite — but a lobby
    // of forty should not be a lobby of two.
    expect(new Set(looks).size).toBeGreaterThan(25)
  })

  it('varies each trait across a population rather than pinning it', () => {
    const population = Array.from({ length: 60 }, (_, i) => avatarLook(i + 1))
    for (const trait of ['skin', 'hair', 'trousers', 'shoes'] as const) {
      const distinct = new Set(population.map((look) => look[trait]))
      expect(distinct.size, `${trait} never varies`).toBeGreaterThan(2)
    }
    expect(new Set(population.map((l) => l.hairStyle)).size).toBe(3)
    expect(new Set(population.map((l) => l.face)).size).toBe(3)
    expect(new Set(population.map((l) => l.backpack)).size).toBe(2)
  })

  it('keeps heights within a believable range', () => {
    for (let id = 1; id <= 200; id++) {
      const { height } = avatarLook(id)
      expect(height).toBeGreaterThanOrEqual(0.93)
      expect(height).toBeLessThanOrEqual(1.07)
    }
  })

  it('only ever returns colours the renderer can parse', () => {
    for (let id = 1; id <= 100; id++) {
      const look = avatarLook(id)
      for (const value of [look.skin, look.hair, look.trousers, look.shoes]) {
        expect(value).toMatch(/^#[0-9a-f]{6}$/i)
      }
    }
  })

  it('keeps the style indices in range for the meshes that switch on them', () => {
    for (let id = 1; id <= 200; id++) {
      const { hairStyle, face } = avatarLook(id)
      expect([0, 1, 2]).toContain(hairStyle)
      expect([0, 1, 2]).toContain(face)
    }
  })
})
