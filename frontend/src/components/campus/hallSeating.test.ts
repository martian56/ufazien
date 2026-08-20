import { describe, expect, it } from 'vitest'

import {
  ALL_INTERIOR_SEATS,
  UFAZ_BENCH_SEAT_HEIGHT,
  UFAZ_BENCH_X,
  UFAZ_BENCH_Z,
  interiorColliders,
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
