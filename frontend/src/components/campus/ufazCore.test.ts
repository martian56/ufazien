import { describe, it, expect } from 'vitest'

import {
  CORE_HALF,
  FLIGHT_X,
  FLOORS,
  HALF_FLIGHTS,
  HALF_RUN,
  LIFT_SHAFT,
  STAIRWELL,
  arrivalLandingPlatform,
  coreGuards,
  coreSlabs,
  coreStairPlatforms,
  floorAt,
  floorLevel,
  halfLandingLevel,
  halfLandingPlatform,
  slabPieces,
  type Floor,
} from './ufazCore'
import { STOREY_HEIGHT, UFAZ_STAIR } from './interiorPhysics'
import { HEADROOM, STEP_UP, blockingPlatforms, groundHeight, resolveColliders } from './campusPhysics'

/**
 * The building as one stacked space, walked rather than measured.
 *
 * Everything here runs the player controller's own loop — move, apply gravity,
 * *then* read the height of the feet, block, resolve the floor — because that
 * order is what decides whether a stair can be climbed, and a gravity-free
 * walk has already once strolled up one the game would not let you climb.
 */

const EYE = 1.5
const GRAVITY = 20
const SPEED = 5.5
const DT = 1 / 60

interface Spot {
  x: number
  z: number
}

function world() {
  return { platforms: [...coreSlabs(), ...coreStairPlatforms()], colliders: coreGuards() }
}

/**
 * Walks a player through a list of waypoints and reports where they ended up.
 *
 * Returns the highest floor reached as well as the final one, so a walk that
 * climbs and then falls back down is distinguishable from one that never left.
 */
function walk(from: Spot, waypoints: Spot[], secondsEach = 12) {
  const { platforms, colliders } = world()
  let x = from.x
  let z = from.z
  let camY = EYE
  let vy = 0
  let highest = 0

  for (const target of waypoints) {
    for (let frame = 0; frame < Math.round(secondsEach / DT); frame++) {
      const dx = target.x - x
      const dz = target.z - z
      const gap = Math.hypot(dx, dz)
      if (gap < 0.08) break
      x += (dx / gap) * SPEED * DT
      z += (dz / gap) * SPEED * DT

      vy -= GRAVITY * DT
      camY += vy * DT

      const feet = camY - EYE
      const solid = [...colliders, ...blockingPlatforms(platforms, feet)]
      const settled = resolveColliders(x, z, solid)
      x = settled.x
      z = settled.z
      x = Math.max(-CORE_HALF, Math.min(CORE_HALF, x))
      z = Math.max(-CORE_HALF, Math.min(CORE_HALF, z))

      const floor = groundHeight(x, z, platforms, feet)
      if (camY <= floor + EYE && vy <= 0) {
        vy = 0
        camY = floor + EYE
      }
      highest = Math.max(highest, camY - EYE)
    }
  }

  const feet = camY - EYE
  return { x, z, feet, floor: floorAt(feet), highest, highestFloor: floorAt(highest) }
}

/** The waypoints that carry a player up one storey of the dog-leg. */
function storeyRoute(floor: Floor): Spot[] {
  const up = HALF_FLIGHTS.find((f) => f.from === floor && f.half === 0)!
  const back = HALF_FLIGHTS.find((f) => f.from === floor && f.half === 1)!
  const topOfUp = up.startZ + up.direction * HALF_RUN
  const topOfBack = back.startZ + back.direction * HALF_RUN
  return [
    // Stand at the foot of the west run.
    { x: up.x, z: up.startZ + 1.0 },
    // Climb it to the half-landing.
    { x: up.x, z: topOfUp - 0.9 },
    // Turn across the landing to the east run.
    { x: back.x, z: back.startZ - 0.3 },
    // And climb back to the floor above, out onto the slab.
    { x: back.x, z: topOfBack + 1.6 },
  ]
}

describe('which floor you are on', () => {
  it('is read off how high you are, not off a trigger you walked into', () => {
    for (const floor of FLOORS) {
      expect(floorAt(floorLevel(floor))).toBe(floor)
      expect(floorAt(floorLevel(floor) + STOREY_HEIGHT - 0.01)).toBe(floor)
    }
  })

  it('keeps you on the floor you left until you arrive at the next', () => {
    // Halfway up a flight is still the floor below: the room you are in is not
    // supposed to flicker with every tread.
    expect(floorAt(STOREY_HEIGHT / 2)).toBe(0)
    expect(floorAt(STOREY_HEIGHT - 0.001)).toBe(0)
    expect(floorAt(STOREY_HEIGHT)).toBe(1)
  })

  it('is exact at a floor level, not a hair under it', () => {
    // The camera sits a frame of gravity below the surface the player is
    // standing on — five millimetres at 60fps, twenty centimetres at ten — so
    // this must be read from the ground, not from the eye. Asserted here as
    // well so the rule is written down where the function is.
    for (const floor of FLOORS) {
      expect(floorAt(floorLevel(floor))).toBe(floor)
    }
    // And a hair under a floor level really is the floor below: that is the
    // correct answer for someone on the last tread, and the reason the caller
    // must pass the surface rather than the camera.
    expect(floorAt(STOREY_HEIGHT - 0.005)).toBe(0)
  })

  it('never reports a floor that does not exist', () => {
    for (const y of [-50, -0.001, 0, 13.65, 100, NaN, Infinity]) {
      const floor = floorAt(y)
      expect(FLOORS).toContain(floor)
    }
  })
})

describe('the slabs', () => {
  it('leaves a hole for the stair and one for the lift in every upper floor', () => {
    for (const floor of FLOORS) {
      if (floor === 0) continue
      const slab = coreSlabs().filter((p) => Math.abs(p.top - floorLevel(floor)) < 1e-6)
      expect(slab.length, `floor ${floor} has no slab`).toBeGreaterThan(0)

      // Nothing sits over the lift shaft.
      const overLift = slab.some(
        (p) =>
          p.x - p.halfW < LIFT_SHAFT.x1 - 0.01 &&
          p.x + p.halfW > LIFT_SHAFT.x0 + 0.01 &&
          p.z - p.halfD < LIFT_SHAFT.z1 - 0.01 &&
          p.z + p.halfD > LIFT_SHAFT.z0 + 0.01,
      )
      expect(overLift, `floor ${floor} paves over the lift shaft`).toBe(false)

      // Nor over the stairwell.
      const hole = STAIRWELL
      const overStair = slab.some(
        (p) =>
          p.x - p.halfW < hole.x1 - 0.01 &&
          p.x + p.halfW > hole.x0 + 0.01 &&
          p.z - p.halfD < hole.z1 - 0.01 &&
          p.z + p.halfD > hole.z0 + 0.01,
      )
      expect(overStair, `floor ${floor} paves over its own stairwell`).toBe(false)
    }
  })

  it('paves everything that is not a hole', () => {
    // Sampled across the plan: anywhere outside a void should have exactly one
    // slab under it, or the player walks into a gap that is not a stairwell.
    for (const floor of FLOORS) {
      if (floor === 0) continue
      const slab = coreSlabs().filter((p) => Math.abs(p.top - floorLevel(floor)) < 1e-6)
      const holes = [LIFT_SHAFT, STAIRWELL]
      for (let x = -CORE_HALF + 1; x < CORE_HALF; x += 2.5) {
        for (let z = -CORE_HALF + 1; z < CORE_HALF; z += 2.5) {
          const inHole = holes.some((h) => x > h.x0 && x < h.x1 && z > h.z0 && z < h.z1)
          if (inHole) continue
          const covered = slab.some(
            (p) => Math.abs(x - p.x) <= p.halfW && Math.abs(z - p.z) <= p.halfD,
          )
          expect(covered, `floor ${floor} has a gap at (${x}, ${z})`).toBe(true)
        }
      }
    }
  })

  it('cuts a slab into pieces without overlapping them', () => {
    const pieces = slabPieces(10, [{ x0: -2, x1: 2, z0: -2, z1: 2 }], 4)
    for (let i = 0; i < pieces.length; i++) {
      for (let j = i + 1; j < pieces.length; j++) {
        const a = pieces[i]
        const b = pieces[j]
        const apart =
          Math.abs(a.x - b.x) >= a.halfW + b.halfW - 1e-9 ||
          Math.abs(a.z - b.z) >= a.halfD + b.halfD - 1e-9
        expect(apart, 'two slab pieces overlap').toBe(true)
      }
    }
  })
})

describe('walking the building', () => {
  it('climbs from the entrance hall to the top floor', () => {
    // The whole point: no trigger, no scene swap, no spawn. Just walking.
    const route = ([0, 1, 2] as Floor[]).flatMap(storeyRoute)
    const end = walk({ x: 0, z: 15 }, route)
    expect(end.floor, `ended at ${end.feet.toFixed(2)} m`).toBe(3)
    expect(end.feet).toBeCloseTo(floorLevel(3), 1)
  })

  it('climbs one floor at a time, reaching each on the way', () => {
    for (const floor of [1, 2, 3] as Floor[]) {
      const route: Spot[] = []
      for (let n = 0; n < floor; n++) route.push(...storeyRoute(n as Floor))
      const end = walk({ x: 0, z: 15 }, route)
      expect(end.floor, `could not reach floor ${floor}`).toBe(floor)
    }
  })

  it('comes back down the way it went up', () => {
    const up = ([0, 1, 2] as Floor[]).flatMap(storeyRoute)
    const down = [...up].reverse()
    const end = walk({ x: 0, z: 15 }, [...up, ...down])
    expect(end.floor, `stranded at ${end.feet.toFixed(2)} m`).toBe(0)
  })

  it('does not let a floor above you stop you walking about', () => {
    // The bug that made all of this impossible: a slab a storey up became a
    // wall across the whole plan and the resolver ejected the player out of
    // the building through its own ceiling.
    const end = walk({ x: 0, z: 15 }, [{ x: 0, z: -15 }, { x: -15, z: -15 }, { x: 15, z: 10 }])
    expect(end.floor).toBe(0)
    expect(Math.hypot(end.x - 15, end.z - 10)).toBeLessThan(1.5)
  })
})

describe('the dog-leg', () => {
  it('rails both sides of the well, once', () => {
    // One footprint per side rather than one per floor. A collider is a plan
    // shape that stops you at every height, so a rail repeated up the building
    // is the same wall three times — and the campus rule against two solids
    // closer than a player is wide catches it as a seam with itself.
    expect(coreGuards().length).toBe(2)
    const [west, east] = coreGuards() as { x: number }[]
    expect(west.x).toBeCloseTo(STAIRWELL.x0, 6)
    expect(east.x).toBeCloseTo(STAIRWELL.x1, 6)
  })

  it('rails the whole depth of the well', () => {
    for (const rail of coreGuards() as { z: number; halfD: number }[]) {
      expect(rail.z - rail.halfD).toBeLessThanOrEqual(STAIRWELL.z0 + 1e-9)
      expect(rail.z + rail.halfD).toBeGreaterThanOrEqual(STAIRWELL.z1 - 1e-9)
    }
  })

  it('keeps the two runs apart in plan so neither passes over the other', () => {
    // The straight-flight version failed here: the flight coming back sat
    // directly over the one going up, with 1.4 m between them, and the
    // collision layer stopped the climb at 4.02 m of a 4.55 m storey.
    const [west, east] = FLIGHT_X
    expect(Math.abs(east - west)).toBeGreaterThan(2 * 1.5)
  })

  it('gives every flight a clear storey above it', () => {
    // Each run repeats in the same place one floor up, so the headroom over any
    // tread is a full storey rather than half of one. Surfaces within a single
    // step are excluded: the next tread and the landing you step onto are
    // things you walk up, not things you walk into.
    const treads = coreStairPlatforms()
    for (const a of treads) {
      const above = treads
        .filter(
          (b) =>
            b.top > a.top + STEP_UP &&
            Math.abs(b.x - a.x) < a.halfW + b.halfW - 1e-9 &&
            Math.abs(b.z - a.z) < a.halfD + b.halfD - 1e-9,
        )
        .map((b) => b.top - a.top)
      if (!above.length) continue
      const clearance = Math.min(...above)
      expect(clearance, `only ${clearance.toFixed(2)} m of headroom over a tread`).toBeGreaterThan(
        HEADROOM,
      )
    }
  })

  it('runs the turn right out to the edge of the well', () => {
    // Otherwise there is a strip of nothing between the landing and the edge,
    // and walking north off the turn steps into it before it falls.
    for (const floor of [0, 1, 2] as Floor[]) {
      const turn = halfLandingPlatform(floor)
      expect(turn.z - turn.halfD).toBeCloseTo(STAIRWELL.z0, 6)
    }
  })

  it('drops you back where you started if you walk off the head of the well', () => {
    // The head is open — a rail there would meet the ones down either side,
    // which the campus forbids. So the fall has to be harmless: onto the floor
    // the flight left from, not out of the world.
    const up = HALF_FLIGHTS.find((f) => f.from === 0 && f.half === 0)!
    const end = walk({ x: up.x, z: up.startZ + 1 }, [
      { x: up.x, z: up.startZ + up.direction * HALF_RUN - 0.9 },
      // Straight on past the turn, off the north end.
      { x: up.x, z: STAIRWELL.z0 - 4 },
    ])
    expect(end.highest, 'never reached the turn').toBeGreaterThan(2)
    expect(end.floor, 'ended somewhere other than the floor below').toBe(0)
    expect(end.feet).toBeCloseTo(0, 2)
  })

  it('turns halfway up, at half a storey', () => {
    for (const floor of [0, 1, 2] as Floor[]) {
      const turn = halfLandingLevel(floor) - floorLevel(floor)
      const storey = floorLevel((floor + 1) as Floor) - floorLevel(floor)
      expect(turn / storey).toBeCloseTo(0.5, 1)
    }
  })

  it('lands you on the floor, level with the slab you step onto', () => {
    for (const floor of [0, 1, 2] as Floor[]) {
      expect(arrivalLandingPlatform(floor).top).toBeCloseTo(floorLevel((floor + 1) as Floor), 6)
    }
  })

  it('runs the arrival landing out past the edge of the hole', () => {
    // Otherwise stepping off is a gap the width of a rounding error.
    for (const floor of [0, 1, 2] as Floor[]) {
      const landing = arrivalLandingPlatform(floor)
      expect(landing.z + landing.halfD).toBeGreaterThan(STAIRWELL.z1)
    }
  })
})
