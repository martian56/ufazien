import { describe, it, expect } from 'vitest'

import {
  BUBBLE_MAX,
  BUBBLE_MS,
  bubbleFor,
  buildingName,
  inSameRoom,
  isSameParticipant,
  isSpeaking,
  statusFor,
} from './playerStatus'
import { CAMPUS_BUILDINGS } from './campusLayout'

const NOW = Date.parse('2026-08-11T12:00:00.000Z')
const at = (secondsAgo: number) => new Date(NOW - secondsAgo * 1000).toISOString()

describe('bubbleFor', () => {
  const messages = [
    { user_id: 7, message: 'first', timestamp: at(30) },
    { user_id: 7, message: 'second', timestamp: at(1) },
    { user_id: 9, message: 'someone else', timestamp: at(1) },
  ]

  it('shows a player their most recent message', () => {
    expect(bubbleFor(7, messages, NOW)).toBe('second')
  })

  it('does not put one player message over another player', () => {
    expect(bubbleFor(9, messages, NOW)).toBe('someone else')
  })

  it('shows nothing for somebody who has not spoken', () => {
    expect(bubbleFor(11, messages, NOW)).toBeNull()
  })

  it('lets a message expire', () => {
    // A bubble that never goes away turns a busy quad into a wall of text.
    const old = [{ user_id: 7, message: 'stale', timestamp: at(BUBBLE_MS / 1000 + 5) }]
    expect(bubbleFor(7, old, NOW)).toBeNull()
  })

  it('matches a numeric id against a string one', () => {
    // Ids arrive as numbers from the socket and as strings from REST. A bubble
    // that never matches is a feature that silently does nothing.
    expect(bubbleFor('7', messages, NOW)).toBe('second')
    expect(bubbleFor(7, [{ user_id: '7', message: 'hi', timestamp: at(1) }], NOW)).toBe('hi')
  })

  it('truncates a very long message rather than filling the sky', () => {
    const long = 'x'.repeat(400)
    const bubble = bubbleFor(7, [{ user_id: 7, message: long, timestamp: at(1) }], NOW)
    expect(bubble).toHaveLength(BUBBLE_MAX)
    expect(bubble?.endsWith('…')).toBe(true)
  })

  it('ignores a message that is only whitespace', () => {
    expect(bubbleFor(7, [{ user_id: 7, message: '   ', timestamp: at(1) }], NOW)).toBeNull()
  })

  it('shows a message whose timestamp cannot be parsed', () => {
    // Better a bubble that lingers than one that never appears at all.
    expect(bubbleFor(7, [{ user_id: 7, message: 'hi', timestamp: 'nonsense' }], NOW)).toBe('hi')
    expect(bubbleFor(7, [{ user_id: 7, message: 'hi' }], NOW)).toBe('hi')
  })

  it('ignores a message timestamped far in the future', () => {
    // A client with a wrong clock would otherwise pin a bubble up permanently.
    const ahead = [{ user_id: 7, message: 'later', timestamp: at(-3600) }]
    expect(bubbleFor(7, ahead, NOW)).toBeNull()
  })

  it('handles an empty backlog', () => {
    expect(bubbleFor(7, [], NOW)).toBeNull()
  })
})

describe('statusFor', () => {
  const library = CAMPUS_BUILDINGS.find((b) => b.interior === 'library')!

  it('says nothing about somebody just walking about', () => {
    expect(statusFor({ activity: 'standing', currentRoom: null })).toBeNull()
  })

  it('names the building somebody is in', () => {
    expect(statusFor({ activity: 'standing', currentRoom: String(library.id) })).toBe(
      `in the ${library.name}`,
    )
  })

  it('reports sitting, with the room when it knows it', () => {
    expect(statusFor({ activity: 'sitting', currentRoom: String(library.id) })).toContain('sitting')
    expect(statusFor({ activity: 'sitting', currentRoom: null })).toBe('sitting')
  })

  it('reports a raised hand', () => {
    expect(statusFor({ activity: 'hand_raised' })).toBe('hand up')
  })

  it('puts presenting above everything else', () => {
    // Whatever else they are doing, the useful fact is that this is the person
    // whose screen is on the projector.
    expect(statusFor({ activity: 'sitting', currentRoom: '2', isPresenting: true })).toBe(
      'presenting',
    )
  })

  it('says nothing for a room id that matches no building', () => {
    expect(statusFor({ activity: 'standing', currentRoom: '9999' })).toBeNull()
  })

  it('does not treat an inherited key as an activity', () => {
    expect(statusFor({ activity: 'constructor' })).toBeNull()
  })
})

describe('buildingName', () => {
  it('resolves the id that travels as current_room', () => {
    for (const building of CAMPUS_BUILDINGS) {
      // Compared against the same transform the function applies, so this
      // stays a test of the lookup rather than an accident of the fact that
      // no building is currently called "The Library".
      expect(buildingName(String(building.id))).toBe(building.name.replace(/^The\s+/i, ''))
    }
  })

  it('does not label somebody as being "in the The Library"', () => {
    // The article-stripping branch, which the loop above cannot reach while
    // no building name happens to start with one.
    const named = CAMPUS_BUILDINGS.map((b) => b.name)
    expect(named.some((n) => /^The\s+/i.test(n))).toBe(false)
    expect(buildingName('nope')).toBeNull()
  })

  it('returns nothing for no room', () => {
    expect(buildingName(null)).toBeNull()
    expect(buildingName(undefined)).toBeNull()
    expect(buildingName('')).toBeNull()
  })
})

describe('inSameRoom', () => {
  it('puts two people on the open campus together', () => {
    expect(inSameRoom(null, null)).toBe(true)
    expect(inSameRoom(undefined, null)).toBe(true)
    expect(inSameRoom('', null)).toBe(true)
  })

  it('puts two people in the same building together', () => {
    expect(inSameRoom('3', '3')).toBe(true)
    expect(inSameRoom(3, '3')).toBe(true)
  })

  it('keeps somebody indoors out of the quad', () => {
    // The bug this exists for: a player inside a building keeps sending their
    // position, and inside, that position is room space — the room is built at
    // the origin. Unfiltered, everyone outdoors saw them walking around the
    // middle of the quad while they were actually in the library.
    expect(inSameRoom('3', null)).toBe(false)
    expect(inSameRoom(null, '3')).toBe(false)
  })

  it('keeps two different buildings apart', () => {
    expect(inSameRoom('3', '4')).toBe(false)
  })
})

describe('participants', () => {
  it('matches a LiveKit identity against a campus user id', () => {
    // Identities are minted as `user-<id>`. Compared raw, the speaking ring
    // never appears on anybody at all.
    expect(isSameParticipant('user-42', 42)).toBe(true)
    expect(isSameParticipant('user-42', '42')).toBe(true)
    expect(isSameParticipant('42', 42)).toBe(true)
  })

  it('does not match a different player', () => {
    expect(isSameParticipant('user-42', 43)).toBe(false)
    expect(isSameParticipant(undefined, 42)).toBe(false)
    expect(isSameParticipant(null, 42)).toBe(false)
  })

  it('rings only whoever is actually talking', () => {
    const participants = [
      { identity: 'user-1', speaking: true },
      { identity: 'user-2', speaking: false },
    ]
    expect(isSpeaking(1, participants)).toBe(true)
    expect(isSpeaking(2, participants)).toBe(false)
    expect(isSpeaking(3, participants)).toBe(false)
  })
})
