import { describe, expect, it } from 'vitest'

import {
  AVATAR_CATALOGUE,
  UNCHOSEN,
  characterFile,
  characterFor,
  characterForSeed,
  packIndex,
} from './avatarCatalogue'

describe('the character catalogue', () => {
  it('gives every entry a distinct id and a built asset', () => {
    const ids = AVATAR_CATALOGUE.map((entry) => entry.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const entry of AVATAR_CATALOGUE) {
      expect(entry.file, entry.id).toMatch(/^\/avatars\/[\w-]+\.glb$/)
      expect(entry.label.trim().length).toBeGreaterThan(0)
    }
  })

  it('uses ids the server will accept', () => {
    // Kebab-case, matching `backend/game/characters.py`. The backend test reads
    // this file; this one keeps the shape it expects to find parseable.
    for (const entry of AVATAR_CATALOGUE) {
      expect(entry.id, entry.id).toMatch(/^[a-z0-9-]+$/)
    }
  })
})

describe('what a player is drawn as', () => {
  it('gives somebody who never chose exactly what they always had', () => {
    // The rule the campus has always used. Changing it — even to something
    // tidier — restyles every existing player at once, so it is pinned.
    expect(packIndex(0)).toBe(0)
    expect(packIndex(1)).toBe(1)
    expect(packIndex(3)).toBe(0)
    expect(packIndex('ilkin')).toBe(packIndex('ilkin'))
    expect(characterForSeed(1).id).toBe(AVATAR_CATALOGUE[1].id)
  })

  it('prefers what they chose', () => {
    const chosen = AVATAR_CATALOGUE[2]
    // Seed 0 would give entry 0; the choice has to win.
    expect(characterFor(chosen.id, 0).id).toBe(chosen.id)
  })

  it('falls back to the seed when nothing is chosen', () => {
    expect(characterFor(UNCHOSEN, 1).id).toBe(AVATAR_CATALOGUE[1].id)
    expect(characterFor(null, 1).id).toBe(AVATAR_CATALOGUE[1].id)
    expect(characterFor(undefined, 1).id).toBe(AVATAR_CATALOGUE[1].id)
  })

  it('falls back rather than failing on a body we no longer ship', () => {
    // A character could be retired while somebody is still wearing it. That
    // player gets their old derived body, not a missing mesh.
    expect(characterFor('a-body-we-removed', 1).id).toBe(AVATAR_CATALOGUE[1].id)
  })

  it('never returns something without a file to load', () => {
    for (const seed of [0, 1, 7, 12345, 'ilkin', 'ayşə', '']) {
      expect(characterFor(null, seed).file).toBeTruthy()
    }
  })

  it('resolves a file only for a body it has', () => {
    expect(characterFile(AVATAR_CATALOGUE[0].id)).toBe(AVATAR_CATALOGUE[0].file)
    expect(characterFile('nope')).toBeNull()
    expect(characterFile('')).toBeNull()
    expect(characterFile(null)).toBeNull()
  })
})
