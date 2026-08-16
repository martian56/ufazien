import { describe, it, expect } from 'vitest'

import {
  CORRIDOR_OF,
  FLOOR_PLANS,
  allRoomIds,
  corridorFor,
  exitOf,
  floorOfCorridor,
  isCorridor,
  portalAt,
  portalsFrom,
} from './verticalCirculation'
import { CAMPUS_BUILDINGS, PLAYER_RADIUS } from './campusLayout'
import { interiorColliders, interiorPlatforms } from './interiorPhysics'
import { insideCollider } from './campusPhysics'
import { corridorKind } from './verticalCirculation'

/**
 * The building as a graph: four levels, the rooms off them, and the stair and
 * lift between. Everything here is the kind of mistake that strands a player
 * somewhere with no way back, which is worse than any amount of wrong geometry.
 */

describe('the floors', () => {
  it('puts every room somewhere, exactly once', () => {
    const ids = allRoomIds()
    expect(new Set(ids).size, 'a room appears twice in the plan').toBe(ids.length)
  })

  it('accounts for every enterable room on the campus', () => {
    // A room that exists but is on no floor is unreachable: it has an interior,
    // a projector and seats, and no way in.
    const placed = new Set(allRoomIds())
    for (const building of CAMPUS_BUILDINGS) {
      expect(placed.has(building.id), `${building.name} is on no floor`).toBe(true)
    }
  })

  it('numbers the levels from the ground up with no gaps', () => {
    expect(FLOOR_PLANS.map((plan) => plan.floor)).toEqual([0, 1, 2, 3])
  })

  it('agrees with itself about which corridor is which floor', () => {
    for (const plan of FLOOR_PLANS) {
      expect(CORRIDOR_OF[plan.floor]).toBe(plan.corridor)
      expect(floorOfCorridor(plan.corridor)).toBe(plan.floor)
      expect(isCorridor(plan.corridor)).toBe(true)
    }
  })

  it('does not call a room a corridor', () => {
    for (const plan of FLOOR_PLANS) {
      for (const room of plan.rooms) {
        expect(isCorridor(room.id), `${room.name}`).toBe(false)
        expect(corridorFor(room.id)).toBe(plan.corridor)
      }
    }
  })
})

/**
 * What is left of the portal graph: the doors off each corridor.
 *
 * Neither the stair nor the lift is in it any more. The building is one
 * stacked space — which floor you are on is read off how high you are, and the
 * lift is a car you ride. `ufazCore.test.ts` walks both.
 */
describe('leaving a room', () => {
  it('puts you back in the corridor it opens off', () => {
    for (const plan of FLOOR_PLANS) {
      for (const room of plan.rooms) {
        expect(exitOf(room.id)?.room).toBe(plan.corridor)
      }
    }
  })

  it('does not drop you in the doorway you just came out of', () => {
    for (const plan of FLOOR_PLANS) {
      for (const room of plan.rooms) {
        const back = exitOf(room.id)!
        expect(portalAt(back.room, back.spawn.x, back.spawn.z, 0)?.to).not.toBe(room.id)
      }
    }
  })

  it('has no exit for a corridor, which leaves by its own front door', () => {
    for (const plan of FLOOR_PLANS) {
      expect(exitOf(plan.corridor)).toBeNull()
    }
  })
})

describe('the doors along a corridor', () => {
  it('gives each room on a floor its own doorway', () => {
    for (const plan of FLOOR_PLANS) {
      const doors = portalsFrom(plan.corridor).filter((p) => p.kind === 'door')
      expect(doors.length, `floor ${plan.floor}`).toBe(plan.rooms.length)
      const spots = doors.map((d) => `${d.x},${d.z}`)
      expect(new Set(spots).size, 'two rooms share a doorway').toBe(doors.length)
    }
  })

  it('keeps the doors clear of the stair and the lift', () => {
    // Two triggers on the same patch of floor means whichever is checked first
    // wins, and the loser is a room nobody can reach.
    for (const plan of FLOOR_PLANS) {
      const portals = portalsFrom(plan.corridor)
      for (let i = 0; i < portals.length; i++) {
        for (let j = i + 1; j < portals.length; j++) {
          const a = portals[i]
          const b = portals[j]
          const apart =
            Math.abs(a.x - b.x) > a.halfW + b.halfW || Math.abs(a.z - b.z) > a.halfD + b.halfD
          expect(apart, `floor ${plan.floor}: ${a.label} overlaps ${b.label}`).toBe(true)
        }
      }
    }
  })

})

describe('every portal can actually be reached', () => {
  /**
   * The gap this closes.
   *
   * Everything above proves the graph joins up — that the stair comes back, the
   * lift runs both ways, no two triggers overlap. None of it asks whether a
   * player can *stand* in a trigger, and the lift's could not be stood in at
   * all: it was the lift shaft's own footprint, and the shaft is solid and
   * slightly larger than the trigger, so every point inside it was inside a
   * wall. The feature was unreachable and seventeen passing tests said nothing.
   */
  const standable = (kind: ReturnType<typeof corridorKind>, x: number, z: number) =>
    !interiorColliders(kind).some((collider) => insideCollider(x, z, collider, PLAYER_RADIUS))

  it('leaves somewhere solid-free inside every trigger', () => {
    const stuck: string[] = []

    for (const id of allRoomIds()) {
      const kind = corridorKind(id)
      if (!isCorridor(id)) continue

      for (const portal of portalsFrom(id)) {
        // Sampled across the rectangle rather than at its centre: a trigger
        // half-covered by a desk is still usable, and one wholly inside a wall
        // is not.
        let open = false
        for (let sx = -0.8; sx <= 0.8 && !open; sx += 0.4) {
          for (let sz = -0.8; sz <= 0.8 && !open; sz += 0.4) {
            if (standable(kind, portal.x + sx * portal.halfW, portal.z + sz * portal.halfD)) {
              open = true
            }
          }
        }
        if (!open) stuck.push(`room ${id}: ${portal.label} (${portal.kind}) is inside a wall`)
      }
    }

    expect(stuck).toEqual([])
  })

  it('leaves something to climb to any trigger that is off the floor', () => {
    // The stair up fires from a landing four metres in the air. Without a
    // flight under it that height is unreachable, which is exactly what every
    // floor above the ground had: `ufazFloorPhysics` returned no platforms.
    for (const id of allRoomIds()) {
      if (!isCorridor(id)) continue
      const kind = corridorKind(id)

      for (const portal of portalsFrom(id)) {
        const minY = portal.minY
        if (minY === undefined) continue
        const reaches = interiorPlatforms(kind).some(
          (platform) =>
            platform.top >= minY &&
            Math.abs(platform.x - portal.x) <= platform.halfW + portal.halfW &&
            Math.abs(platform.z - portal.z) <= platform.halfD + portal.halfD,
        )
        expect(reaches, `room ${id}: nothing reaches ${portal.label}`).toBe(true)
      }
    }
  })
})
