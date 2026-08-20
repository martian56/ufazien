import { describe, it, expect } from 'vitest'

import {
  CORE_HALF,
  FLIGHT_X,
  FLOORS,
  HALF_FLIGHTS,
  halfRun,
  risersPerHalf,
  storeyHeight,
  LIFT_SHAFT,
  BUILDING_HEIGHT,
  SLAB_THICKNESS,
  clearHeight,
  STAIRWELL,
  arrivalLandingPlatform,
  coreGuards,
  coreSlabs,
  coreStairPlatforms,
  floorAt,
  floorLevel,
  LIFT_CAR,
  LIFT_SPEED,
  liftShaftWalls,
  halfLandingLevel,
  halfLandingPlatform,
  insideLiftCar,
  liftFloorNames,
  liftHeightAt,
  liftJourneySeconds,
  slabPieces,
  type Floor,
} from './ufazCore'
import { UFAZ_STAIR } from './interiorPhysics'
import {
  HEADROOM,
  STEP_UP,
  blockingPlatforms,
  groundHeight,
  insideCollider,
  resolveColliders,
} from './campusPhysics'
import { PLAYER_RADIUS } from './campusLayout'

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
  const topOfUp = up.startZ + up.direction * halfRun(floor)
  const topOfBack = back.startZ + back.direction * halfRun(floor)
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

describe('how tall the storeys are', () => {
  it('gives the hall more height than the floors above it', () => {
    // It is a restored 1900s building: an entrance storey of some ceremony,
    // and ordinary floors over it. Every storey used to be the same 4.55 m,
    // which left 4.27 m of clear height in a hall 44 m across.
    for (const floor of [1, 2, 3] as Floor[]) {
      expect(storeyHeight(0)).toBeGreaterThan(storeyHeight(floor))
    }
    expect(clearHeight(0), 'the hall is not a hall').toBeGreaterThan(5.2)
    expect(clearHeight(1), 'the floors above lost height').toBeGreaterThan(4.27)
    expect(clearHeight(0)).toBeCloseTo(storeyHeight(0) - SLAB_THICKNESS, 9)
  })

it('is the geometry this building was actually set out to', () => {
    // The relational tests above would all still pass if every storey shrank
    // together, so the numbers themselves are pinned here. Change them
    // deliberately; do not let them drift.
    expect(risersPerHalf(0), 'hall').toBe(16)
    for (const floor of [1, 2] as Floor[]) {
      expect(risersPerHalf(floor), `floor ${floor}`).toBe(14)
    }

    expect(storeyHeight(0)).toBeCloseTo(5.6, 9)
    expect(clearHeight(0)).toBeCloseTo(5.32, 9)
    expect(storeyHeight(1)).toBeCloseTo(4.9, 9)
    expect(clearHeight(1)).toBeCloseTo(4.62, 9)

    expect(FLOORS.map(floorLevel)).toEqual(
      [0, 5.6, 10.5, 15.4].map((level) => expect.closeTo(level, 9)),
    )
    expect(BUILDING_HEIGHT).toBeCloseTo(20.3, 9)
  })

  it('makes every storey a whole number of the same riser', () => {
    // Which is why the stair did not have to change its going or its pitch to
    // make the hall taller: a taller storey is more steps, not bigger ones.
    for (const floor of FLOORS) {
      const risers = storeyHeight(floor) / UFAZ_STAIR.rise
      expect(Math.abs(risers - Math.round(risers))).toBeLessThan(1e-9)
      expect(Math.round(risers) % 2, 'a dog-leg splits its risers in half').toBe(0)
    }
  })

  it('still fits inside the building it is drawn in', () => {
    // The exterior is 25 m to the eaves. Stack the floors past that and the
    // top one is above the roof it is supposed to be under.
    expect(BUILDING_HEIGHT).toBeLessThan(25)
  })

  it('leaves every floor level exactly a storey above the one below', () => {
    for (const floor of [0, 1, 2] as Floor[]) {
      expect(floorLevel((floor + 1) as Floor) - floorLevel(floor)).toBeCloseTo(
        storeyHeight(floor),
        9,
      )
    }
  })
})

describe('the well the stair turns in', () => {
  it('stops clear of the lift shaft rather than leaving a ribbon of slab', () => {
    // A taller hall means a longer flight, and a longer flight turns further
    // north. Far enough and the hole meets the lift shaft's, with a strip of
    // floor between them too narrow to stand on. This is what limits how tall
    // the hall can be, so it is asserted rather than left as a comment.
    const gap = LIFT_SHAFT.z1 - STAIRWELL.z0
    expect(gap, 'the well has run into the lift shaft').toBeLessThan(0)
    expect(Math.abs(gap), 'slab between the two holes is too narrow to stand on')
      .toBeGreaterThan(PLAYER_RADIUS * 2)
  })

  it('starts every flight somewhere you can step onto it from', () => {
    // The foot of a flight is not on the slab — it is over the hole, on the
    // arrival landing of the flight below. Move it past that landing and it
    // hangs in the void: the climb reaches the first floor and stops. That is
    // a real failure this arrangement produced once, so it is pinned here.
    for (const floor of [1, 2] as Floor[]) {
      const foot = HALF_FLIGHTS.find((f) => f.from === floor && f.half === 0)!
      const below = arrivalLandingPlatform((floor - 1) as Floor)
      expect(foot.startZ, `floor ${floor} starts north of its landing`)
        .toBeGreaterThanOrEqual(below.z - below.halfD - UFAZ_STAIR.going / 2 - 1e-9)
      expect(foot.startZ, `floor ${floor} starts south of its landing`)
        .toBeLessThanOrEqual(below.z + below.halfD + 1e-9)
      expect(below.top).toBeCloseTo(floorLevel(floor), 9)
    }
  })
})

describe('which floor you are on', () => {
  it('is read off how high you are, not off a trigger you walked into', () => {
    for (const floor of FLOORS) {
      expect(floorAt(floorLevel(floor))).toBe(floor)
      expect(floorAt(floorLevel(floor) + storeyHeight(floor) - 0.01)).toBe(floor)
    }
  })

  it('keeps you on the floor you left until you arrive at the next', () => {
    // Halfway up a flight is still the floor below: the room you are in is not
    // supposed to flicker with every tread.
    expect(floorAt(storeyHeight(0) / 2)).toBe(0)
    expect(floorAt(storeyHeight(0) - 0.001)).toBe(0)
    expect(floorAt(storeyHeight(0))).toBe(1)
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
    expect(floorAt(storeyHeight(0) - 0.005)).toBe(0)
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
  it('rails both sides of every floor and walls the head of every turn', () => {
    // Two rails on each floor above the ground, and a wall at each half-landing.
    // Each carries the level it belongs to, so a rail on the third floor no
    // longer rails the entrance hall as well.
    const guards = coreGuards() as { base?: number; height?: number }[]
    expect(guards.length).toBe(3 + 3 * 2)
    for (const guard of guards) {
      expect(guard.base, 'a guard that does not know its floor').toBeDefined()
      expect(guard.height).toBeGreaterThan(guard.base as number)
    }
  })

  it('never puts two guards at the same height in the same place', () => {
    // The reason the head of the well was open before: a wall there met the
    // rails down either side, and a seam is what the resolver cannot settle on.
    const guards = coreGuards() as {
      x: number; z: number; halfW: number; halfD: number; base?: number; height?: number
    }[]
    for (let i = 0; i < guards.length; i++) {
      for (let j = i + 1; j < guards.length; j++) {
        const a = guards[i]
        const b = guards[j]
        const level =
          (a.height as number) > (b.base as number) && (b.height as number) > (a.base as number)
        if (!level) continue
        const apart =
          Math.abs(a.x - b.x) > a.halfW + b.halfW + 0.5 ||
          Math.abs(a.z - b.z) > a.halfD + b.halfD + 0.5
        expect(apart, 'two guards are level and adjacent').toBe(true)
      }
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

  it('stops you walking off the head of the well', () => {
    // It used to drop you a half storey. There is a wall at the turn now, at
    // the turn's own level, which is what let it exist at all: it is never at
    // the same height as the rails down either side, so it cannot seam with
    // them.
    const up = HALF_FLIGHTS.find((f) => f.from === 0 && f.half === 0)!
    const end = walk({ x: up.x, z: up.startZ + 1 }, [
      { x: up.x, z: up.startZ + up.direction * halfRun(0) - 0.9 },
      // Straight on past the turn, off the north end.
      { x: up.x, z: STAIRWELL.z0 - 4 },
    ])
    expect(end.highest, 'never reached the turn').toBeGreaterThan(2)
    expect(end.feet, 'walked off the turn instead of being stopped on it').toBeGreaterThan(2)
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


describe('the lift', () => {
  /**
   * It used to be a picture of one: two door panels on a glazed shaft and a
   * rectangle on the floor in front of them that swapped the world. Two stops,
   * both hardcoded — from the first or second floor it went to the library and
   * nowhere else — and no way to say where you wanted to go.
   */

  it('serves every floor the building has', () => {
    const names = liftFloorNames()
    expect(names.map((n) => n.floor)).toEqual([...FLOORS])
    for (const { label } of names) expect(label.length).toBeGreaterThan(0)
  })

  it('starts and finishes at floor level, exactly', () => {
    // Anything else parks the car a few centimetres off and leaves a step in
    // or out of it.
    for (const from of FLOORS) {
      for (const to of FLOORS) {
        expect(liftHeightAt(from, to, 0)).toBeCloseTo(floorLevel(from), 6)
        expect(liftHeightAt(from, to, 999)).toBeCloseTo(floorLevel(to), 6)
      }
    }
  })

  it('travels in the right direction and does not overshoot', () => {
    const half = Math.abs(floorLevel(3) - floorLevel(0)) / LIFT_SPEED / 2
    const midway = liftHeightAt(0, 3, half)
    expect(midway).toBeGreaterThan(floorLevel(0))
    expect(midway).toBeLessThan(floorLevel(3))
    // And the same journey downwards.
    const down = liftHeightAt(3, 0, half)
    expect(down).toBeLessThan(floorLevel(3))
    expect(down).toBeGreaterThan(floorLevel(0))
  })

  it('clamps rather than drifting past the floor it was called to', () => {
    // A client that joins mid-ride, or misses a frame, must land on the floor
    // rather than sail through the roof.
    for (const elapsed of [-5, 0, 1e6, Number.MAX_SAFE_INTEGER]) {
      const y = liftHeightAt(0, 2, elapsed)
      expect(y).toBeGreaterThanOrEqual(floorLevel(0) - 1e-9)
      expect(y).toBeLessThanOrEqual(floorLevel(2) + 1e-9)
    }
  })

  it('takes longer the further it goes, and no time at all to stay put', () => {
    expect(liftJourneySeconds(0, 0)).toBe(0)
    expect(liftJourneySeconds(0, 3)).toBeGreaterThan(liftJourneySeconds(0, 1))
    expect(liftJourneySeconds(0, 1)).toBeCloseTo(liftJourneySeconds(1, 0), 6)
  })

  it('knows when somebody is standing in the car', () => {
    const y = floorLevel(1)
    expect(insideLiftCar(LIFT_CAR.x, LIFT_CAR.z, y, y)).toBe(true)
    // Beside it on the same floor is not inside it.
    expect(insideLiftCar(LIFT_CAR.x + LIFT_CAR.halfW + 1, LIFT_CAR.z, y, y)).toBe(false)
    // And standing in the shaft on a different floor is not either, which is
    // what stops the panel appearing for somebody watching it go past.
    expect(insideLiftCar(LIFT_CAR.x, LIFT_CAR.z, floorLevel(0), y)).toBe(false)
  })

  it('can be walked into from the corridor', () => {
    // The failure this exists to catch: a solid shaft with the car inside it.
    // That is how the lift was unusable before — the thing you had to stand in
    // sat wholly within a collider slightly larger than itself, and every
    // graph test passed because none of them asked whether a player could
    // stand anywhere.
    const walls = liftShaftWalls()
    const standable = (x: number, z: number) =>
      !walls.some((w) => insideCollider(x, z, w, PLAYER_RADIUS))
    expect(standable(LIFT_CAR.x, LIFT_CAR.z), 'the car is walled in').toBe(true)
    // And the way in is open: a straight line from the corridor to the car.
    for (let z = LIFT_SHAFT.z1 + 1; z >= LIFT_CAR.z; z -= 0.2) {
      expect(standable(LIFT_CAR.x, z), `blocked at z ${z.toFixed(1)}`).toBe(true)
    }
  })

  it('fits inside its own shaft', () => {
    expect(LIFT_CAR.x - LIFT_CAR.halfW).toBeGreaterThan(LIFT_SHAFT.x0)
    expect(LIFT_CAR.x + LIFT_CAR.halfW).toBeLessThan(LIFT_SHAFT.x1)
    expect(LIFT_CAR.z - LIFT_CAR.halfD).toBeGreaterThan(LIFT_SHAFT.z0)
    expect(LIFT_CAR.z + LIFT_CAR.halfD).toBeLessThan(LIFT_SHAFT.z1)
  })

  it('has a shaft that is open at every floor', () => {
    // The car has to be reachable from all four, which means no slab over it.
    for (const floor of FLOORS) {
      if (floor === 0) continue
      const overCar = coreSlabs()
        .filter((p) => Math.abs(p.top - floorLevel(floor)) < 1e-6)
        .some(
          (p) =>
            Math.abs(p.x - LIFT_CAR.x) < p.halfW + LIFT_CAR.halfW &&
            Math.abs(p.z - LIFT_CAR.z) < p.halfD + LIFT_CAR.halfD,
        )
      expect(overCar, `floor ${floor} paves over the car`).toBe(false)
    }
  })
})
