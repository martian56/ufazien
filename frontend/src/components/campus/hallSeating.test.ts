import { describe, expect, it } from 'vitest'

import {
  ALL_INTERIOR_SEATS,
  CAFE_SEAT_OFFSETS,
  CAFE_TABLE_X,
  CAFE_TABLE_Z,
  SEAT_REACH,
  UFAZ_BENCH_SEAT_HEIGHT,
  UFAZ_BENCH_X,
  UFAZ_BENCH_Z,
  interiorColliders,
  interiorSeats,
  nearestSeat,
  reachDistance,
} from './interiorPhysics'

describe('the benches in the entrance hall', () => {
  const benches = ALL_INTERIOR_SEATS
    .filter(({ seat }) => seat.id.startsWith('ufaz-bench-'))
    .map(({ seat }) => seat)

  it('has one seat per bench', () => {
    expect(benches).toHaveLength(UFAZ_BENCH_Z.length)
  })

  it('puts every seat where its bench actually stands', () => {
    // The failure this is here for: the mesh was drawn at x −14 and the seat
    // registered at x −11, so sitting down moved the player three metres off
    // the bench and left them sitting on air. Both now read the same constant,
    // and this asserts the seat agrees with it.
    for (const seat of benches) {
      expect(seat.x, `bench at z ${seat.z} is not where its seat is`).toBe(UFAZ_BENCH_X)
      expect(UFAZ_BENCH_Z).toContain(seat.z)
      expect(seat.seatHeight).toBe(UFAZ_BENCH_SEAT_HEIGHT)
      expect(seat.y).toBe(0)
    }
  })

  it('sits every seat on something solid', () => {
    // A seat names the object it is part of, and that object has to exist and
    // to be under the seat. A seat floating beside its bench is the bug above;
    // a seat naming a collider that is not there is the same bug earlier.
    const solids = interiorColliders('ufaz-core')
    for (const seat of benches) {
      const carrier = solids.find((collider) => collider.id === seat.on)
      expect(carrier, `seat ${seat.id} sits on nothing`).toBeDefined()
      const box = carrier as { x: number; z: number; halfW?: number; halfD?: number }
      expect(Math.abs(seat.x - box.x)).toBeLessThanOrEqual(box.halfW ?? 0)
      expect(Math.abs(seat.z - box.z)).toBeLessThanOrEqual(box.halfD ?? 0)
    }
  })
})

describe('reaching a seat', () => {
  const seats = interiorSeats('ufaz-core')
  const bench = seats.find((seat) => seat.id === 'ufaz-bench-2')!
  // The hall benches are 1.6 wide and 4.4 long, so half of each.
  const halfLength = 2.2
  const beside = UFAZ_BENCH_X - 1.4

  it('measures to the bench, not to the spot on it', () => {
    // Standing squarely against one end of the bench. To the seat point in the
    // middle that is 2.5 m — further than the 1.6 m reach — which is why a
    // bench you were plainly standing at offered you nothing.
    const endZ = bench.z + halfLength
    expect(Math.hypot(beside - bench.x, endZ - bench.z)).toBeGreaterThan(SEAT_REACH)
    expect(reachDistance(beside, endZ, bench)).toBeLessThan(SEAT_REACH)
  })

  it('offers the bench from anywhere along it', () => {
    for (const z of [bench.z - halfLength, bench.z, bench.z + halfLength]) {
      expect(nearestSeat(beside, z, seats)?.id, `not offered at z ${z}`).toBe(bench.id)
    }
  })

  it('still refuses it from across the room', () => {
    // Widening the reach must not mean every bench in the hall is on offer.
    expect(nearestSeat(UFAZ_BENCH_X + 6, bench.z, seats)?.id).not.toBe(bench.id)
    expect(reachDistance(UFAZ_BENCH_X + 6, bench.z, bench)).toBeGreaterThan(SEAT_REACH)
  })

  it('leaves a loose seat measured from its own point', () => {
    // A chair is its own footprint. One that offered itself from a metre past
    // its back would be worse than the bug this fixes.
    const loose = seats.find((seat) => !seat.carrier)
    if (!loose) return
    expect(reachDistance(loose.x + 0.9, loose.z, loose)).toBeCloseTo(0.9, 6)
  })

  it('picks the nearer end when one piece carries several seats', () => {
    const shared = new Map<string, typeof seats>()
    for (const seat of seats) {
      if (!seat.on) continue
      shared.set(seat.on, [...(shared.get(seat.on) ?? []), seat])
    }
    for (const [, group] of shared) {
      if (group.length < 2) continue
      const [first] = group
      // Standing at one seat's own position, that seat wins even though every
      // seat on the piece is nought from the piece itself.
      expect(nearestSeat(first.x, first.z, group)?.id).toBe(first.id)
    }
  })
})

describe('the cafeteria, now that its furniture is instanced models', () => {
  const seats = ALL_INTERIOR_SEATS
    .filter(({ kind }) => kind === 'cafeteria')
    .map(({ seat }) => seat)

  it('seats four at every table and no more', () => {
    expect(CAFE_SEAT_OFFSETS).toHaveLength(4)
    expect(seats).toHaveLength(CAFE_TABLE_X.length * CAFE_TABLE_Z.length * 4)
  })

  it('puts a seat exactly where a chair is drawn', () => {
    // The renderer builds its chair placements from these same constants. If
    // that ever stops being true this fails, which is the point: the hall's
    // benches were drawn three metres from their seats because the position
    // was written out twice.
    const drawn = new Set(
      CAFE_TABLE_Z.flatMap((z) =>
        CAFE_TABLE_X.flatMap((x) =>
          CAFE_SEAT_OFFSETS.map((offset) => `${x + offset.x},${z + offset.z}`),
        ),
      ),
    )
    for (const seat of seats) {
      expect(drawn.has(`${seat.x},${seat.z}`), `seat ${seat.id} has no chair`).toBe(true)
    }
    expect(drawn.size).toBe(seats.length)
  })

  it('faces every sitter at their own table', () => {
    for (const seat of seats) {
      const table = CAFE_TABLE_Z.flatMap((z) => CAFE_TABLE_X.map((x) => ({ x, z })))
        .find((spot) => Math.abs(spot.x - seat.x) <= 0.81 && Math.abs(spot.z - seat.z) <= 1.41)
      expect(table, `seat ${seat.id} belongs to no table`).toBeDefined()
      // Zero faces +Z, so a chair south of its table looks north and vice versa.
      const expected = seat.z > (table as { z: number }).z ? Math.PI : 0
      expect(seat.ry, seat.id).toBe(expected)
    }
  })
})
