import { describe, it, expect } from 'vitest'

import {
  CORRIDOR_OF,
  FLOOR_PLANS,
  LIFT_CAR,
  STAIR,
  STAIR_FOOT,
  STAIR_HEAD,
  STAIR_LANDING,
  STAIR_RISE,
  allRoomIds,
  corridorFor,
  exitOf,
  floorOfCorridor,
  isCorridor,
  portalAt,
  portalsFrom,
  stairTreads,
  stairwellClamp,
} from './verticalCirculation'
import { CAMPUS_BUILDINGS, PLAYER_RADIUS, type InteriorKind } from './campusLayout'
import { interiorColliders, interiorPlatforms } from './interiorPhysics'
import { STEP_UP, groundHeight, insideCollider } from './campusPhysics'
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

describe('the stair and the lift', () => {
  it('goes up from every floor but the top, and down from every floor but the ground', () => {
    for (const plan of FLOOR_PLANS) {
      const kinds = portalsFrom(plan.corridor).map((portal) => portal.kind)
      expect(kinds.includes('stair-up'), `floor ${plan.floor} up`).toBe(plan.floor < 3)
      expect(kinds.includes('stair-down'), `floor ${plan.floor} down`).toBe(plan.floor > 0)
    }
  })

  it('leads where it says it does', () => {
    for (const plan of FLOOR_PLANS) {
      for (const portal of portalsFrom(plan.corridor)) {
        if (portal.kind === 'stair-up') expect(portal.to).toBe(CORRIDOR_OF[(plan.floor + 1) as 1])
        if (portal.kind === 'stair-down') expect(portal.to).toBe(CORRIDOR_OF[(plan.floor - 1) as 0])
      }
    }
  })

  it('comes back to the floor you left, going up and then down again', () => {
    // The one property that matters. A stair you can climb and not descend is
    // a trap, and it is invisible until somebody is standing in it.
    for (const plan of FLOOR_PLANS.filter((p) => p.floor < 3)) {
      const up = portalsFrom(plan.corridor).find((p) => p.kind === 'stair-up')!
      const back = portalsFrom(up.to).find((p) => p.kind === 'stair-down')
      expect(back, `no way down from floor ${plan.floor + 1}`).toBeDefined()
      expect(back!.to).toBe(plan.corridor)
    }
  })

  it('does not send a player upstairs for walking under the stair', () => {
    // The landing sits over the flight in plan, so the trigger has to know how
    // high off the floor the player is. At ground level this is somebody
    // walking beneath it.
    expect(portalAt(1, STAIR_HEAD.x, STAIR_HEAD.z, 0)).toBeNull()
    expect(portalAt(1, STAIR_HEAD.x, STAIR_HEAD.z, STAIR_RISE)?.kind).toBe('stair-up')
  })

  it('has a lift on every floor, and it runs both ways', () => {
    const top = CORRIDOR_OF[3]
    for (const plan of FLOOR_PLANS) {
      const lift = portalsFrom(plan.corridor).find((p) => p.kind === 'lift')
      expect(lift, `floor ${plan.floor}`).toBeDefined()
      expect(lift!.to).toBe(plan.floor === 3 ? CORRIDOR_OF[0] : top)
    }
    // And the top floor's lift comes back to the hall rather than to itself.
    expect(portalsFrom(top).find((p) => p.kind === 'lift')!.to).not.toBe(top)
  })

  it('puts you down clear of the portal you arrived through', () => {
    // Landing inside the trigger sends you straight back, which is a loop the
    // player cannot break out of by walking.
    for (const id of allRoomIds()) {
      for (const portal of portalsFrom(id)) {
        const arrival = portalAt(portal.to, portal.spawn.x, portal.spawn.z, 0)
        expect(
          arrival?.to,
          `${id} -> ${portal.to} lands back in a portal to ${arrival?.to}`,
        ).not.toBe(id)
      }
    }
  })
})

describe('the helical flight', () => {
  /**
   * The graph tests above prove the stair joins two floors together. None of
   * them touches the thing a helix can get wrong that a straight run cannot:
   * whether there is continuous ground under somebody walking round it.
   */
  const platforms = interiorPlatforms('ufaz')
  const at = (angle: number, radius: number) => ({
    x: STAIR.x + Math.sin(angle) * radius,
    z: STAIR.z + Math.cos(angle) * radius,
  })

  it('climbs one floor, in steps a person can take', () => {
    expect(STAIR_RISE).toBeCloseTo(STAIR.treads * STAIR.rise)
    expect(STAIR.rise).toBeLessThanOrEqual(STEP_UP)
    // A going shorter than a foot is a ladder. Measured at the walking line,
    // which is what the 2.75 m radius is for — at the core it is a third of it.
    expect(Math.abs(STAIR.turn) * STAIR.walk).toBeGreaterThan(0.3)
  })

  it('puts a tread under every step of the way up', () => {
    // Walked rather than asserted: start on the floor at the foot and take each
    // tread in turn, carrying the height forward, because `groundHeight` only
    // counts what is within a step of where the feet already are.
    let feet = 0
    for (const tread of stairTreads()) {
      const floor = groundHeight(tread.x, tread.z, platforms, feet)
      expect(floor, `tread ${tread.index} at ${tread.x.toFixed(2)}, ${tread.z.toFixed(2)}`).toBe(
        tread.top,
      )
      feet = floor
    }
    expect(feet).toBeCloseTo(STAIR_RISE)
  })

  it('is mirrored the moment a tread is turned the wrong way', () => {
    // What this is really testing is the sign of `ry`. `insideCollider` and
    // three.js's `rotation.y` turn a box in opposite directions, so the
    // platform takes `-angle` and the mesh takes `angle`. With both the same,
    // the stair is solid where it is not drawn — and at the four right angles
    // the two conventions agree, so a spot check would pass.
    const wrong = stairTreads().map((tread) => ({
      x: tread.x,
      z: tread.z,
      halfW: 0.42,
      halfD: 1.55,
      ry: tread.angle,
      top: tread.top,
    }))
    let feet = 0
    const missed = stairTreads().filter((tread) => {
      const floor = groundHeight(tread.x, tread.z, wrong, feet)
      if (floor === tread.top) feet = floor
      return floor !== tread.top
    })
    expect(missed.length).toBeGreaterThan(0)
  })

  it('leaves no gap between treads at the outside of the bend', () => {
    // Sized to the walking line, the boxes tile at 2.75 m and part by 0.3 m out
    // at 4.3 — a hole exactly where somebody holding forward round a bend ends
    // up. Sampled at the outer edge, between tread centres, which is where a
    // gap would be.
    const treads = stairTreads()
    const edge = STAIR.outer - PLAYER_RADIUS
    for (let i = 1; i < treads.length; i++) {
      for (const t of [0.25, 0.5, 0.75]) {
        const angle = treads[i - 1].angle + (treads[i].angle - treads[i - 1].angle) * t
        const point = at(angle, edge)
        const floor = groundHeight(point.x, point.z, platforms, treads[i - 1].top)
        expect(floor, `gap between treads ${i} and ${i + 1} at the outer edge`).toBeGreaterThan(0)
      }
    }
  })

  it('lands on the landing, and the landing on the last tread', () => {
    const last = stairTreads()[STAIR.treads - 1]
    expect(groundHeight(STAIR_LANDING.x, STAIR_LANDING.z, platforms, last.top)).toBeCloseTo(
      STAIR_RISE,
    )
    // And the two overlap, or there is a step of open air between them.
    const reach = at(last.angle, STAIR.outer)
    expect(Math.abs(reach.x - STAIR_LANDING.x)).toBeLessThan(STAIR_LANDING.halfW)
    expect(Math.abs(reach.z - STAIR_LANDING.z)).toBeLessThan(STAIR_LANDING.halfD)
  })

  it('can be stepped onto from the floor at the foot', () => {
    const first = stairTreads()[0]
    expect(groundHeight(first.x, first.z, platforms, 0)).toBe(first.top)
    // And the trigger that goes down is on open floor, not under the flight,
    // where everything overhead is a wall.
    const toCentre = Math.hypot(STAIR_FOOT.x - STAIR.x, STAIR_FOOT.z - STAIR.z)
    expect(toCentre - STAIR_FOOT.halfD).toBeGreaterThan(STAIR.outer)
  })
})

describe('staying on the stair', () => {
  it('holds a climber inside the outer edge', () => {
    // Walking a helix means holding forward while the ground curves away. Two
    // metres past the edge at head height is the top of the flight.
    const held = stairwellClamp('ufaz', STAIR.x, STAIR.z + STAIR.outer + 1.5, 3)
    expect(held).not.toBeNull()
    expect(Math.hypot(held!.x - STAIR.x, held!.z - STAIR.z)).toBeCloseTo(
      STAIR.outer - PLAYER_RADIUS,
    )
  })

  it('leaves somebody on the treads alone', () => {
    for (const tread of stairTreads()) {
      expect(stairwellClamp('ufaz', tread.x, tread.z, tread.top), `tread ${tread.index}`).toBeNull()
    }
  })

  it('does not fence off the floor around the stair', () => {
    // At ground level the stair is something you walk past, not into.
    expect(stairwellClamp('ufaz', STAIR.x, STAIR.z + STAIR.outer + 1, 0)).toBeNull()
    expect(stairwellClamp('ufaz-floor', STAIR_FOOT.x, STAIR_FOOT.z, 0)).toBeNull()
  })

  it('lets go at the landing rather than dragging you back onto the flight', () => {
    // The landing is outside the outer radius, so a clamp that did not know
    // about it would pull a player who has just finished climbing back over
    // the edge of the stair they climbed.
    expect(stairwellClamp('ufaz', STAIR_LANDING.x, STAIR_LANDING.z, STAIR_RISE)).toBeNull()
    expect(stairwellClamp('ufaz-floor', STAIR_HEAD.x, STAIR_HEAD.z, STAIR_RISE)).toBeNull()
  })

  it('ignores somewhere else in the room entirely', () => {
    // Otherwise a player on another part of the floor at height is dragged to
    // the edge of a stair they are nowhere near.
    expect(stairwellClamp('ufaz', -15, 10, 3)).toBeNull()
  })

  it('does not reach into rooms that have no stair in them', () => {
    // Every interior is drawn about the same origin, so a clamp that only asked
    // where the player was standing would fence off a circle of the
    // amphitheatre and the sports hall as well — the two other rooms on the
    // campus where somebody stands metres above the floor, on a raked tier and
    // on the bleachers. Both have a platform under this exact spot.
    for (const kind of ['lecture', 'sports', 'library'] as InteriorKind[]) {
      const outside = { x: STAIR.x, z: STAIR.z + STAIR.outer + 1.5 }
      expect(stairwellClamp(kind, outside.x, outside.z, 3), kind).toBeNull()
    }
    // And the guard is worth having: the same spot in the hall is clamped.
    expect(stairwellClamp('ufaz', STAIR.x, STAIR.z + STAIR.outer + 1.5, 3)).not.toBeNull()
  })
})

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

  it('keeps the lift out of the stairwell', () => {
    const apart =
      Math.abs(LIFT_CAR.x - STAIR_FOOT.x) > LIFT_CAR.halfW + STAIR_FOOT.halfW ||
      Math.abs(LIFT_CAR.z - STAIR_FOOT.z) > LIFT_CAR.halfD + STAIR_FOOT.halfD
    expect(apart).toBe(true)
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
