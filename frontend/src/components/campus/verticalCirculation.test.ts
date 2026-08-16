import { describe, it, expect } from 'vitest'

import {
  CORRIDOR_OF,
  FLOOR_PLANS,
  LIFT_CAR,
  STAIR_FOOT,
  STAIR_HEAD,
  allRoomIds,
  corridorFor,
  exitOf,
  floorOfCorridor,
  isCorridor,
  portalAt,
  portalsFrom,
} from './verticalCirculation'
import { CAMPUS_BUILDINGS, PLAYER_RADIUS } from './campusLayout'
import {
  STOREY_HEIGHT,
  UFAZ_STAIR,
  interiorColliders,
  interiorPlatforms,
} from './interiorPhysics'
import {
  STEP_UP,
  blockingPlatforms,
  groundHeight,
  insideCollider,
  resolveColliders,
} from './campusPhysics'
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
    expect(portalAt(1, STAIR_HEAD.x, STAIR_HEAD.z, 4.55)?.kind).toBe('stair-up')
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


/**
 * Walking up the stair, with gravity.
 *
 * Everything else in this file is geometry: the graph joins up, no two
 * triggers overlap, every trigger has somewhere solid-free inside it. All of
 * it passed while the flight was unclimbable, because none of it runs the
 * loop the player actually runs.
 *
 * The order in that loop is the whole point. `Player` applies a frame of
 * gravity to the camera and *then* reads the height of its feet, so a surface
 * exactly `STEP_UP` above the player is more than `STEP_UP` above them by
 * about five millimetres — and `blockingPlatforms` turns it into a wall. A
 * pure walk that resolves the floor first compares 4.55 against 4.55, finds it
 * is not greater, and strolls up a stair the game will not let you climb.
 */

/** `EYE_HEIGHT` from `CampusWithBackend`. */
const EYE = 1.5
/** Its gravity, its walk speed, and a 60 Hz frame. */
const GRAVITY = 20
const SPEED = 5.5
const DT = 1 / 60

interface Spot {
  x: number
  z: number
}

/**
 * Walks a player from `start` towards `target`, one controller frame at a
 * time, and reports the first portal they end up standing in.
 */
function walk(roomId: number, start: Spot, target: Spot, seconds = 15) {
  const kind = corridorKind(roomId)
  const colliders = interiorColliders(kind)
  const platforms = interiorPlatforms(kind)

  let x = start.x
  let z = start.z
  let camY = EYE
  let vy = 0
  let highest = 0

  for (let frame = 0; frame < Math.round(seconds / DT); frame++) {
    const dx = target.x - x
    const dz = target.z - z
    const gap = Math.hypot(dx, dz)
    if (gap > 0.05) {
      x += (dx / gap) * SPEED * DT
      z += (dz / gap) * SPEED * DT
    }

    vy -= GRAVITY * DT
    camY += vy * DT

    // Read after gravity, exactly as the controller does.
    const feet = camY - EYE
    const solid = [...colliders, ...blockingPlatforms(platforms, feet)]
    const resolved = resolveColliders(x, z, solid)
    x = resolved.x
    z = resolved.z

    const floor = groundHeight(x, z, platforms, feet)
    if (camY <= floor + EYE && vy <= 0) {
      vy = 0
      camY = floor + EYE
    }

    highest = Math.max(highest, camY - EYE)
    const portal = portalAt(roomId, x, z, camY - EYE)
    if (portal) return { portal, x, z, feet: camY - EYE, highest }
  }

  return { portal: null, x, z, feet: camY - EYE, highest }
}

describe('climbing the stair for real', () => {
  it('gets a player from the entrance hall to the floor above', () => {
    // The bug: the player stopped dead at z -16.7, two treads short of the
    // landing, and no amount of walking or jumping got them any further.
    const climbed = walk(1, { x: UFAZ_STAIR.x, z: -5 }, { x: UFAZ_STAIR.x, z: -21 })
    expect(climbed.portal?.kind, `stopped at z ${climbed.z.toFixed(2)}`).toBe('stair-up')
    expect(climbed.portal?.to).toBe(CORRIDOR_OF[1])
  })

  it('reaches the top of the flight rather than stalling part way up', () => {
    const climbed = walk(1, { x: UFAZ_STAIR.x, z: -5 }, { x: UFAZ_STAIR.x, z: -21 })
    // The landing is 4.55 and the trigger fires on it; anything much below
    // that means the player was walled off somewhere on the treads.
    expect(climbed.highest).toBeGreaterThan(UFAZ_STAIR.landing.top - 0.3)
  })

  it('leaves no step on the flight taller than a player can climb', () => {
    // The landing was exactly STEP_UP above the tread below it, which one
    // frame of gravity turns into a wall. Every rise wants clearance, not a tie.
    const tops = interiorPlatforms('ufaz')
      .filter((p) => Math.abs(p.x - UFAZ_STAIR.x) < 0.01)
      .map((p) => p.top)
      .sort((a, b) => a - b)
    for (let i = 1; i < tops.length; i++) {
      expect(tops[i] - tops[i - 1], `step from ${tops[i - 1]} to ${tops[i]}`).toBeLessThan(
        STEP_UP - 0.05,
      )
    }
  })

  it('does not stand the landing out over its own flight', () => {
    // In plan the landing covered the last two treads, so the only way onto
    // them was through the landing's footprint.
    const landing = UFAZ_STAIR.landing
    const landingFront = landing.z + landing.halfD
    const topTreadBack =
      UFAZ_STAIR.z - (UFAZ_STAIR.steps - 1) * UFAZ_STAIR.going - UFAZ_STAIR.going / 2
    expect(landingFront).toBeLessThanOrEqual(topTreadBack + 1e-9)
  })

  it('puts the head trigger on the landing and not on the treads', () => {
    // `verticalCirculation` cannot import the stair geometry without a cycle,
    // so the two are held together here instead.
    const landing = UFAZ_STAIR.landing
    expect(STAIR_HEAD.z + STAIR_HEAD.halfD).toBeLessThanOrEqual(landing.z + landing.halfD)
    expect(STAIR_HEAD.z - STAIR_HEAD.halfD).toBeGreaterThanOrEqual(landing.z - landing.halfD)
  })
})

describe('coming back down', () => {
  it('does not put the player down inside the flight', () => {
    // The descent spawned at z -16.4, which is inside tread 10 — the arriving
    // player stood at floor level under the staircase, wedged in three tread
    // colliders the resolver could free them from by a quarter of a metre.
    for (const plan of FLOOR_PLANS.filter((p) => p.floor > 0)) {
      const down = portalsFrom(plan.corridor).find((p) => p.kind === 'stair-down')!
      const kind = corridorKind(down.to)
      const platforms = interiorPlatforms(kind)
      const colliders = interiorColliders(kind)

      const inPlatform = platforms.filter((p) =>
        insideCollider(down.spawn.x, down.spawn.z, p, PLAYER_RADIUS),
      )
      expect(
        inPlatform.map((p) => p.top),
        `floor ${plan.floor} lands inside the flight`,
      ).toEqual([])

      const stuck = colliders.filter((c) =>
        insideCollider(down.spawn.x, down.spawn.z, c, PLAYER_RADIUS),
      )
      expect(stuck.length, `floor ${plan.floor} lands inside something solid`).toBe(0)
    }
  })

  it('leaves both directions of the stair arriving in the same place', () => {
    // It is one flight. Coming up to a floor and coming down to it put you at
    // its foot either way.
    for (const plan of FLOOR_PLANS) {
      const portals = portalsFrom(plan.corridor)
      const up = portals.find((p) => p.kind === 'stair-up')
      const down = portals.find((p) => p.kind === 'stair-down')
      if (!up || !down) continue
      const arrivals = [up, down].map((p) => portalsFrom(p.to).length)
      expect(arrivals.length).toBe(2)
    }
    const fromBelow = portalsFrom(CORRIDOR_OF[0]).find((p) => p.kind === 'stair-up')!
    const fromAbove = portalsFrom(CORRIDOR_OF[2]).find((p) => p.kind === 'stair-down')!
    expect(fromBelow.spawn).toEqual(fromAbove.spawn)
  })
})


describe('the flight is a stair you could actually build', () => {
  /**
   * It was fourteen risers of 300 mm with a 620 mm going: a thirty-centimetre
   * hop onto a shelf twice as deep as a tread, which reads as stadium
   * terracing and lurches the camera a foot per step. The shallow 26-degree
   * pitch made it look safe on paper; it was shallow because the treads were
   * enormous, not because the steps were comfortable.
   */
  const { rise, going, steps } = UFAZ_STAIR

  it('has risers a person can climb without noticing', () => {
    // 150-190 mm is the range every building code lands in.
    expect(rise).toBeGreaterThanOrEqual(0.15)
    expect(rise).toBeLessThanOrEqual(0.19)
  })

  it('has treads a foot fits on', () => {
    expect(going).toBeGreaterThanOrEqual(0.25)
    expect(going).toBeLessThanOrEqual(0.32)
  })

  it('satisfies the rule that decides whether a stair is comfortable', () => {
    // Two rises plus a going should be a pace: 580-640 mm. The old flight came
    // out at 1220, which is not a pace, it is a stride onto a bench.
    const pace = 2 * rise + going
    expect(pace).toBeGreaterThanOrEqual(0.58)
    expect(pace).toBeLessThanOrEqual(0.64)
  })

  it('is pitched like a stair rather than like a ramp or a ladder', () => {
    const pitch = (Math.atan2(rise, going) * 180) / Math.PI
    expect(pitch).toBeGreaterThan(28)
    expect(pitch).toBeLessThan(38)
  })

  it('starts with an ordinary step rather than a tall one', () => {
    // The first tread used to be 450 mm off the floor, half again as tall as
    // every step after it, which is the first thing you feel walking onto it.
    const platforms = interiorPlatforms('ufaz')
      .filter((p) => Math.abs(p.x - UFAZ_STAIR.x) < 0.01)
      .map((p) => p.top)
      .sort((a, b) => a - b)
    expect(platforms[0]).toBeCloseTo(rise, 6)
  })

  it('arrives at exactly the next floor level', () => {
    // The landing is not "somewhere near the top", it is the floor above. If
    // the risers did not divide the storey this would land part way through a
    // slab once the floors are stacked.
    expect(UFAZ_STAIR.landing.top).toBeCloseTo(STOREY_HEIGHT, 6)
    expect((steps + 1) * rise).toBeCloseTo(STOREY_HEIGHT, 6)
  })

  it('rises in equal steps the whole way, landing included', () => {
    const tops = [
      ...interiorPlatforms('ufaz')
        .filter((p) => Math.abs(p.x - UFAZ_STAIR.x) < 0.01)
        .map((p) => p.top),
    ].sort((a, b) => a - b)
    for (let i = 1; i < tops.length; i++) {
      expect(tops[i] - tops[i - 1], `step ${i} of the flight`).toBeCloseTo(rise, 6)
    }
  })
})
