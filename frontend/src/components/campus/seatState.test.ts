import { describe, it, expect } from 'vitest'

import {
  NO_SEATS,
  ownSeatFromSnapshot,
  seatAfterDenial,
  seatsFromSnapshot,
  takenSeatIds,
  withSeat,
  withoutPlayer,
} from './seatState'

describe('withSeat', () => {
  it('records where somebody is sitting', () => {
    const seats = withSeat(NO_SEATS, 7, 'lecture-1-3')
    expect(seats.get(7)).toBe('lecture-1-3')
  })

  it('seats a player it has never heard of', () => {
    // The whole reason this map is separate. Somebody can sit down before
    // their first position frame reaches us, and dropping that update leaves
    // their chair looking free to everybody else in the room.
    expect(withSeat(NO_SEATS, 99, 'cafe-2').get(99)).toBe('cafe-2')
  })

  it('stands a player up', () => {
    const seated = withSeat(NO_SEATS, 7, 'lecture-1-3')
    expect(withoutSeatOf(seated, 7)).toBe(true)
  })

  it('moves a player between chairs without leaving the old one taken', () => {
    let seats = withSeat(NO_SEATS, 7, 'lecture-1-3')
    seats = withSeat(seats, 7, 'lecture-2-1')
    expect(takenSeatIds(seats)).toEqual(new Set(['lecture-2-1']))
  })

  it('does not treat an empty seat id as a seat', () => {
    // The server rejects one, and holding it here would put a nameless chair
    // in the taken set that nothing can ever release.
    expect(withSeat(NO_SEATS, 7, '').size).toBe(0)
    expect(withSeat(NO_SEATS, 7, undefined).size).toBe(0)
  })

  it('returns the same map when nothing changed', () => {
    // Position frames arrive ten times a second per player. A new Map each
    // time re-renders every avatar on the campus for no reason at all.
    const seats = withSeat(NO_SEATS, 7, 'lecture-1-3')
    expect(withSeat(seats, 7, 'lecture-1-3')).toBe(seats)
    expect(withSeat(seats, 8, null)).toBe(seats)
  })

  it('keeps other players where they were', () => {
    let seats = withSeat(NO_SEATS, 7, 'lecture-1-3')
    seats = withSeat(seats, 8, 'lecture-1-4')
    seats = withSeat(seats, 7, null)
    expect(seats.get(8)).toBe('lecture-1-4')
    expect(seats.has(7)).toBe(false)
  })
})

describe('withoutPlayer', () => {
  it('frees the chair of somebody who left', () => {
    const seats = withSeat(NO_SEATS, 7, 'lecture-1-3')
    expect(withoutPlayer(seats, 7).size).toBe(0)
  })

  it('returns the same map for somebody who was not sitting', () => {
    const seats = withSeat(NO_SEATS, 7, 'lecture-1-3')
    expect(withoutPlayer(seats, 8)).toBe(seats)
  })
})

describe('seatAfterDenial', () => {
  it('gives up the chair the refusal is about', () => {
    expect(seatAfterDenial('lecture-1-3', 'lecture-1-3')).toBeNull()
  })

  it('keeps a chair the refusal was not about', () => {
    // Press the key at two chairs before the first answer arrives: the first
    // claim is granted and the second refused. Clearing unconditionally stands
    // the player up locally while the server still has them in chair one, and
    // no further seat_update is coming to correct it — so the chair stays
    // claimed by an avatar that looks like it is standing next to it.
    expect(seatAfterDenial('lecture-1-3', 'lecture-2-1')).toBe('lecture-1-3')
  })

  it('keeps the held chair when the refusal names none', () => {
    expect(seatAfterDenial('lecture-1-3', null)).toBe('lecture-1-3')
    expect(seatAfterDenial('lecture-1-3', undefined)).toBe('lecture-1-3')
  })

  it('leaves a standing player standing', () => {
    expect(seatAfterDenial(null, 'lecture-1-3')).toBeNull()
    expect(seatAfterDenial(null, null)).toBeNull()
  })
})

describe('seatsFromSnapshot', () => {
  const positions = [
    { user_id: 7, seat: 'lecture-1-3' },
    { user_id: 8, seat: null },
    { user_id: 9, seat: 'cafe-2' },
  ]

  it('takes the seating out of a lobby snapshot', () => {
    expect(takenSeatIds(seatsFromSnapshot(positions, 1))).toEqual(
      new Set(['lecture-1-3', 'cafe-2']),
    )
  })

  it('leaves the reader out of it', () => {
    // Their own chair is `ownSeat`. In the taken set as well, the chair they
    // just stood up from could not be offered back to them.
    expect(seatsFromSnapshot(positions, 7).has(7)).toBe(false)
  })

  it('copes with a snapshot that carries no seating at all', () => {
    expect(seatsFromSnapshot([], null).size).toBe(0)
    expect(seatsFromSnapshot([{ user_id: 7 }], null).size).toBe(0)
  })
})

describe('ownSeatFromSnapshot', () => {
  const positions = [
    { user_id: 7, seat: 'lecture-1-3' },
    { user_id: 9, seat: 'cafe-2' },
  ]

  it('reads the chair the server has the reader in', () => {
    // The counterpart to the omission above. Both halves of the snapshot have
    // to be read, or the one seat the client cares about most is the one it
    // never learns about.
    expect(ownSeatFromSnapshot(positions, 7)).toBe('lecture-1-3')
  })

  it('reports nothing for a player the server has standing', () => {
    expect(ownSeatFromSnapshot([{ user_id: 7, seat: null }], 7)).toBeNull()
    expect(ownSeatFromSnapshot([{ user_id: 7 }], 7)).toBeNull()
    expect(ownSeatFromSnapshot(positions, 11)).toBeNull()
  })

  it('reports nothing when it does not know who is reading', () => {
    expect(ownSeatFromSnapshot(positions, null)).toBeNull()
    expect(ownSeatFromSnapshot(positions, undefined)).toBeNull()
  })
})

describe('takenSeatIds', () => {
  it('is empty for an empty room', () => {
    expect(takenSeatIds(NO_SEATS).size).toBe(0)
  })

  it('collapses two players onto one id only if the server allowed it', () => {
    // It cannot happen — the unique constraint is what stops it — but the set
    // must not report a count that pretends otherwise.
    const seats = new Map<number, string>([[7, 'cafe-2'], [8, 'cafe-2']])
    expect(takenSeatIds(seats)).toEqual(new Set(['cafe-2']))
  })
})

/* ------------------------------------------------------------------ */

function withoutSeatOf(seats: ReadonlyMap<string | number, string>, userId: number): boolean {
  return !withSeat(seats, userId, null).has(userId)
}
