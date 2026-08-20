import { describe, expect, it } from 'vitest'

import { CORRIDOR_DOORS, FLOOR_PLANS, portalsFrom } from './verticalCirculation'
import { FLOORS } from './ufazCore'

describe('the doors off a corridor', () => {
  it('has a room behind every one of them', () => {
    // Four doors were drawn on every floor, at four fixed positions, whatever
    // the floor actually contained. No floor has four rooms: the hall and the
    // library floor have one each. So three doors in the hall opened onto
    // nothing, and looked exactly like the one that opened onto something.
    for (const plan of FLOOR_PLANS) {
      const doors = plan.rooms.length
      expect(doors, `floor ${plan.floor} draws more doors than it has rooms`)
        .toBeLessThanOrEqual(CORRIDOR_DOORS.length)
      expect(doors, `floor ${plan.floor} has no way into any room`).toBeGreaterThan(0)
    }
  })

  it('gives each room a door position of its own', () => {
    for (const plan of FLOOR_PLANS) {
      const used = plan.rooms.map((_, i) => CORRIDOR_DOORS[i])
      expect(new Set(used).size, `two rooms on floor ${plan.floor} share a doorway`)
        .toBe(plan.rooms.length)
      expect(used.every((z) => z !== undefined)).toBe(true)
    }
  })

  it('puts a portal at each of those doors and nowhere else', () => {
    // What is drawn and what opens come from the same list, so a door exists
    // exactly when there is something behind it.
    for (const plan of FLOOR_PLANS) {
      const portals = portalsFrom(plan.corridor).filter((portal) => portal.kind === 'door')
      expect(portals).toHaveLength(plan.rooms.length)
      expect(portals.map((portal) => portal.z)).toEqual(
        plan.rooms.map((_, i) => CORRIDOR_DOORS[i]),
      )
    }
  })

  it('covers every floor of the building', () => {
    expect(FLOOR_PLANS.map((plan) => plan.floor)).toEqual([...FLOORS])
  })
})
