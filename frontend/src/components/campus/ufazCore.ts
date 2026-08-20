/**
 * The main building as one stacked space.
 *
 * Four levels, a stair you climb and a lift shaft you ride, all in a single
 * coordinate system. It replaces four separate rooms — the entrance hall and
 * three corridors — that were each built at the origin and joined by invisible
 * trigger rectangles that swapped the whole world when you walked into them.
 *
 * ## Why a floor is not a room any more
 *
 * `current_room` still exists and still names a floor, because it is what
 * scopes who you can see, who you can hear and whose projector a screen share
 * lands on — and the ids must not change, or a presenter and their audience end
 * up in different rooms. But it is now *derived from how high you are* rather
 * than set by walking into a trigger. `floorAt` is the whole of that rule.
 *
 * ## Why the flights alternate
 *
 * A straight flight climbing north from the foot of the stairwell arrives at
 * the far end of the floor above — and the next flight up has to start
 * somewhere you can actually walk to. If every flight ran north you would have
 * to cross the void over the flight you just climbed to reach the next one.
 *
 * So they turn, which is what a real stair does at every floor: north, south,
 * north. Each arrives exactly where the next one begins.
 *
 * Pure, so the whole building can be walked in a test without a canvas.
 */

import type { Collider, Platform } from './campusPhysics'

/**
 * The height of one riser, in metres.
 *
 * The one dimension the whole building is set out from. Every storey is a
 * whole number of these, so the landing arrives at exactly the next floor
 * level however tall that storey is, and a stair in the hall feels the same
 * underfoot as a stair on the third floor.
 *
 * 175 mm. It was fourteen risers of 300 mm with a 620 mm going — a
 * thirty-centimetre hop onto a sixty-two-centimetre shelf, roughly twice human
 * size in both directions. That reads as stadium terracing rather than a
 * stair, and in first person the camera lurched a foot per step.
 *
 * The pitch was the misleading part: 26 degrees sounds shallow and safe, and
 * it was shallow *because* the treads were enormous, not because the steps
 * were comfortable. At 175 by 280 the pitch comes out at 32 degrees, which is
 * an ordinary stair, and `2R + G` is 630 mm — the middle of the range a stair
 * is comfortable to walk in.
 */
export const RISER = 0.175

/**
 * Risers in each half of the dog-leg, for the storey that starts at each floor.
 *
 * The hall is taller than the floors above it, which is what the building
 * being a restored 1900s one means: an entrance storey of some ceremony, and
 * ordinary floors over it. Every storey used to be 4.55 m, and since the slab
 * is 280 mm thick that left 4.27 m of clear height everywhere — generous
 * upstairs, but low for a hall, and low against a floorplate 44 m across.
 *
 * Twenty-four risers per half make the hall 8.40 m floor to floor, so 8.12 m
 * clear. Fourteen make the floors above it 4.90 m, so 4.62 m clear. Both are
 * whole numbers of the same riser, so neither stair had to change its going or
 * its pitch to get there — there are simply more steps in the taller one.
 *
 * The hall was 5.32 m clear and still read as low, because the room is 44 m
 * across and height has to answer width. What limits it is the well rather
 * than the room: see `FOOT_Z`.
 *
 * Indexed by the floor the storey rises *from*, so the top floor has no entry:
 * nothing climbs out of it.
 */
const RISERS_PER_HALF_BY_FLOOR: readonly number[] = [24, 14, 14]

/** Risers in each half of the dog-leg leaving `floor`. */
export function risersPerHalf(floor: Floor): number {
  return RISERS_PER_HALF_BY_FLOOR[floor] ?? RISERS_PER_HALF_BY_FLOOR[1]
}

/**
 * How thick a floor slab is, in metres.
 *
 * It comes off the storey: the height you can actually see is the pitch less
 * this, which is why 4.55 m floor to floor read as a 4.27 m ceiling.
 */
export const SLAB_THICKNESS = 0.28

/** The clear height under the slab above, which is the ceiling you see. */
export function clearHeight(floor: Floor): number {
  return storeyHeight(floor) - SLAB_THICKNESS
}

/** Floor to floor, in metres, for the storey rising from `floor`. */
export function storeyHeight(floor: Floor): number {
  return 2 * risersPerHalf(floor) * RISER
}

export const UFAZ_STAIR = {
  // Narrower and further in than the first attempt at moving it. At x 12.5
  // with a four-metre half-width its balustrade landed at 16.7, which is
  // inside the colonnade at 17 — the rail ran straight through a column.
  x: 10.5,
  z: -10,
  rise: RISER,
  going: 0.28,
  halfW: 3.5,
}

/**
 * Height of the walking surface of tread `i` above the floor it starts from.
 *
 * The first tread is one riser up, not 0.45 — the old flight began with a step
 * half again as tall as the ones after it, which is the first thing you feel
 * walking onto it.
 */
export function treadTop(i: number): number {
  return (i + 1) * UFAZ_STAIR.rise
}


/** Ground, then the three floors above it. */
export type Floor = 0 | 1 | 2 | 3

export const FLOORS: readonly Floor[] = [0, 1, 2, 3]

/** How far the player may walk from the centre, on any floor. */
export const CORE_HALF = 22

/**
 * The height of each floor's walking surface, measured up from the hall.
 *
 * A running total rather than a multiplication, because the storeys are no
 * longer all the same height — see `RISERS_PER_HALF_BY_FLOOR`.
 */
const FLOOR_LEVELS: readonly number[] = [0, 1, 2, 3].reduce<number[]>(
  (levels, floor) =>
    floor === 0 ? [0] : [...levels, levels[floor - 1] + storeyHeight((floor - 1) as Floor)],
  [],
)

/** The height of a floor's walking surface. */
export function floorLevel(floor: Floor): number {
  return FLOOR_LEVELS[floor]
}

/** Floor to roof: the top floor's level plus its own storey. */
export const BUILDING_HEIGHT = FLOOR_LEVELS[3] + storeyHeight(3)

/**
 * Which floor a given height belongs to.
 *
 * Anything from a floor's own level up to just below the next one counts as
 * that floor, so a player halfway up a flight is still on the floor they left
 * until they arrive. Below the ground and above the top clamp to the ends
 * rather than returning something out of range: a player who has fallen
 * through the world should read as being in the building, not nowhere.
 */
export function floorAt(y: number): Floor {
  if (!Number.isFinite(y)) return 0
  if (y < FLOOR_LEVELS[1] - 1e-6) return 0
  // Downwards, so the first level `y` clears is the floor it is on. A search
  // rather than a division: the storeys are not all the same height, so there
  // is no single number to divide by.
  for (let floor = 3; floor > 0; floor -= 1) {
    if (y >= FLOOR_LEVELS[floor] - 1e-6) return floor as Floor
  }
  return 0
}

/** A rectangle on the plan, as two ranges. */
export interface PlanRect {
  x0: number
  x1: number
  z0: number
  z1: number
}

/**
 * Why the stair turns back on itself.
 *
 * The first attempt ran one straight flight per storey, alternating north and
 * south so that each arrived where the next began. It does not work, and the
 * reason is worth writing down: the flight going south sits directly over the
 * flight going north, and where they cross there is 1.4 m between them. The
 * collision layer is right to stop you — that is a soffit you would walk into
 * — so the climb died at 4.02 m of a 4.55 m storey.
 *
 * Two flights cannot share a shaft unless they are side by side. So each storey
 * is a dog-leg: thirteen risers up the west run to a half-landing, turn, and
 * thirteen more back down the east run to the floor above. Every flight is a
 * full storey clear of the one below it in the same place, which is what a
 * stairwell is for.
 */
export const FLIGHT_HALF_W = 1.5
/** The two runs, west and east, either side of the well. */
export const FLIGHT_X = [8.7, 12.3] as const

/** Treads in each half of the dog-leg leaving `floor`. */
export function treadsPerHalf(floor: Floor): number {
  return risersPerHalf(floor) - 1
}

/** Horizontal distance from the first tread of a half-flight to its last. */
export function halfRun(floor: Floor): number {
  return (treadsPerHalf(floor) - 1) * UFAZ_STAIR.going
}

const HALF_LANDING_DEPTH = 1.4

/**
 * Every flight starts in the same place; the turn is what moves.
 *
 * The hall's flight is longer than the ones above it and that length has to go
 * somewhere. It cannot go south: the foot of a flight is not on the slab, it
 * is on the arrival landing of the flight below, and moving it out past that
 * landing leaves it hanging over the hole with nothing to step onto it from.
 * The walking test caught exactly that — the climb reached the first floor and
 * stopped, because the next flight began over the well.
 *
 * So the foot stays where it has always been and a longer flight turns further
 * north. That is what bounds how tall the hall can be: the well cannot reach
 * the lift shaft at z −17.2, and it has to stop a clear player's width short
 * of it rather than leaving a ribbon of slab too narrow to stand on.
 *
 * Which is why this moved south. At −10 the hall could not exceed sixteen
 * risers per half without the well running into the shaft; at −7.8 it takes
 * twenty-four, and the stair simply starts a couple of metres further into the
 * room — a room that is 44 m deep and had the space to give.
 */
const FOOT_Z = -7.8

/** The edge of the half-landing you arrive at, and leave from. */
export function turnEdge(floor: Floor): number {
  return FOOT_Z - halfRun(floor) - UFAZ_STAIR.going / 2
}

/** The north edge of the well: the deepest turn of any storey, the hall's. */
const DEEPEST_LANDING_Z0 = Math.min(
  ...([0, 1, 2] as Floor[]).map((floor) => turnEdge(floor) - HALF_LANDING_DEPTH),
)

/**
 * The head of the well, which is now closed.
 *
 * It was open, because a rail across it met the rails down either side and
 * this campus forbids two solids closer than a player is wide — flush ones
 * included, since a seam is what the resolver cannot settle on. Walking north
 * off the turn dropped you a half storey.
 *
 * A collider knows which floor it is on now, so the rail can be a wall at the
 * head of the well instead: one shape rising the full height of the building,
 * a long way from either side rail, and the thing a stairwell has anyway.
 */

/**
 * The return flight starts at the edge of the landing, not inside it.
 *
 * Started 0.4 m in and it climbs back out *over* the landing: by its fifth
 * tread there is 0.875 m between the two, which is a soffit you walk into
 * rather than a ceiling you walk under. Beginning at the edge means every
 * tread is clear of it, and you still step onto the first one from the landing
 * because a tread straddles that edge by half a going.
 *
 * The same mistake one level up: the next storey's first flight rises over the
 * arrival landing, so that landing has to stop where the flight begins.
 */


/**
 * The well the whole dog-leg sits in, and the hole it needs in every slab.
 *
 * One rectangle rather than one per flight: both runs, the half-landing and the
 * turn are inside it, so a player anywhere on the stair is wholly within the
 * hole and never meets the edge of a slab at the wrong height. That was the
 * other thing the straight-flight version got wrong — the hole ended flush with
 * the last tread, and a player is a circle, not a point.
 */
export const STAIRWELL: PlanRect = {
  x0: FLIGHT_X[0] - FLIGHT_HALF_W - 0.6,
  x1: FLIGHT_X[1] + FLIGHT_HALF_W + 0.6,
  // The longest flight decides, because one hole serves every storey: cut it
  // to the short flights and the hall's would turn inside the slab beside it.
  z0: DEEPEST_LANDING_Z0 - 0.4,
  z1: FOOT_Z + 0.9,
}

/** The lift shaft, which runs the full height and needs a hole in every slab. */
export const LIFT_SHAFT: PlanRect = { x0: -18.4, x1: -11.6, z0: -20.8, z1: -17.2 }

/**
 * The car, and how it travels.
 *
 * It used to be a picture of a lift: two door panels on a glazed shaft, and a
 * rectangle on the floor in front of them that swapped the world for another
 * scene. Two stops, both hardcoded, and no way to say where you wanted to go.
 *
 * Now it is a platform in the shaft that carries whoever is standing on it.
 * The floor it is at is the server's — see `LiftCar` — so everybody agrees
 * where it is parked and pressing the call button genuinely fetches it; the
 * travel between floors is played out by each client from the change, because
 * a ride is short and a position ticking over the wire is far more to keep in
 * step than "it is at three now".
 */
export const LIFT_CAR = {
  x: (LIFT_SHAFT.x0 + LIFT_SHAFT.x1) / 2,
  z: (LIFT_SHAFT.z0 + LIFT_SHAFT.z1) / 2,
  halfW: (LIFT_SHAFT.x1 - LIFT_SHAFT.x0) / 2 - 0.25,
  halfD: (LIFT_SHAFT.z1 - LIFT_SHAFT.z0) / 2 - 0.25,
}

/** How fast the car travels, in metres per second. */
export const LIFT_SPEED = 2.2

/** How long the doors take to open or close, in seconds. */
export const LIFT_DOOR_SECONDS = 1.1

/** The floor of the car, as a platform, at a given height. */
export function liftFloorPlatform(y: number): Platform {
  return {
    x: LIFT_CAR.x,
    z: LIFT_CAR.z,
    halfW: LIFT_CAR.halfW,
    halfD: LIFT_CAR.halfD,
    top: y,
    // You ride on top of it and walk under it when it is above you.
    walkUnder: true,
  }
}

/** Whether a player standing here is inside the car. */
export function insideLiftCar(x: number, z: number, feet: number, carY: number): boolean {
  if (Math.abs(feet - carY) > 0.35) return false
  return Math.abs(x - LIFT_CAR.x) <= LIFT_CAR.halfW && Math.abs(z - LIFT_CAR.z) <= LIFT_CAR.halfD
}

/**
 * Where the car is at a moment in a journey.
 *
 * Linear, and clamped at both ends, so a client that joins mid-ride or misses
 * a frame lands on the right floor rather than drifting past it. `elapsed` is
 * seconds since the call.
 */
export function liftHeightAt(from: Floor, to: Floor, elapsed: number): number {
  const start = floorLevel(from)
  const end = floorLevel(to)
  if (elapsed <= 0) return start
  const travel = Math.abs(end - start) / LIFT_SPEED
  if (elapsed >= travel) return end
  return start + (end - start) * (elapsed / travel)
}

/** How long a journey between two floors takes, doors included. */
export function liftJourneySeconds(from: Floor, to: Floor): number {
  if (from === to) return 0
  return (
    LIFT_DOOR_SECONDS + Math.abs(floorLevel(to) - floorLevel(from)) / LIFT_SPEED + LIFT_DOOR_SECONDS
  )
}

/** One half of a dog-leg: twelve treads and a riser onto a landing. */
export interface HalfFlight {
  from: Floor
  /** 0 climbs away from the hall, 1 turns and climbs back. */
  half: 0 | 1
  x: number
  halfW: number
  /** Centre of the first tread. */
  startZ: number
  /** -1 runs north, +1 runs south. */
  direction: -1 | 1
  /** Height of the floor or landing it leaves. */
  baseY: number
  /** How many treads this half has, which depends on how tall its storey is. */
  treads: number
}

/** Height of the half-landing partway up a storey. */
export function halfLandingLevel(floor: Floor): number {
  return floorLevel(floor) + risersPerHalf(floor) * UFAZ_STAIR.rise
}

export const HALF_FLIGHTS: HalfFlight[] = ([0, 1, 2] as Floor[]).flatMap((floor) => [
  {
    from: floor,
    half: 0 as const,
    x: FLIGHT_X[0],
    halfW: FLIGHT_HALF_W,
    startZ: FOOT_Z,
    direction: -1 as const,
    baseY: floorLevel(floor),
    treads: treadsPerHalf(floor),
  },
  {
    from: floor,
    half: 1 as const,
    x: FLIGHT_X[1],
    halfW: FLIGHT_HALF_W,
    startZ: turnEdge(floor),
    direction: 1 as const,
    baseY: halfLandingLevel(floor),
    treads: treadsPerHalf(floor),
  },
])

/** The treads of one half-flight. */
export function halfFlightPlatforms(flight: HalfFlight): Platform[] {
  return Array.from({ length: flight.treads }, (_, i) => ({
    x: flight.x,
    z: flight.startZ + flight.direction * i * UFAZ_STAIR.going,
    halfW: flight.halfW,
    halfD: UFAZ_STAIR.going / 2,
    top: flight.baseY + (i + 1) * UFAZ_STAIR.rise,
    walkUnder: true,
  }))
}

/** The half-landing you turn on, spanning both runs. */
export function halfLandingPlatform(floor: Floor): Platform {
  const z1 = turnEdge(floor)
  const z0 = STAIRWELL.z0
  return {
    x: (STAIRWELL.x0 + STAIRWELL.x1) / 2,
    z: (z0 + z1) / 2,
    halfW: (STAIRWELL.x1 - STAIRWELL.x0) / 2,
    halfD: (z1 - z0) / 2,
    top: halfLandingLevel(floor),
    walkUnder: true,
  }
}

/**
 * Where you step off onto the floor above.
 *
 * At floor level and inside the well, running out past the edge of the hole so
 * that stepping from it onto the slab is one surface to another at the same
 * height rather than across a gap the width of a rounding error.
 */
export function arrivalLandingPlatform(floor: Floor): Platform {
  const topTreadZ = turnEdge(floor) + (treadsPerHalf(floor) - 1) * UFAZ_STAIR.going
  const z0 = topTreadZ + UFAZ_STAIR.going / 2
  const z1 = STAIRWELL.z1 + 0.6
  return {
    x: (STAIRWELL.x0 + STAIRWELL.x1) / 2,
    z: (z0 + z1) / 2,
    halfW: (STAIRWELL.x1 - STAIRWELL.x0) / 2,
    halfD: (z1 - z0) / 2,
    top: floorLevel((floor + 1) as Floor),
    walkUnder: true,
  }
}

/**
 * A floor slab with rectangular holes cut in it.
 *
 * Boxes cannot have holes, so the slab is cut into pieces along every void
 * boundary and the pieces that fall inside a void are dropped. A grid rather
 * than a hand-written decomposition, because the voids move whenever the stair
 * or the lift does.
 */
export function slabPieces(half: number, voids: PlanRect[], top: number): Platform[] {
  const xs = [...new Set([-half, half, ...voids.flatMap((v) => [v.x0, v.x1])])]
    .filter((x) => x >= -half && x <= half)
    .sort((a, b) => a - b)
  const zs = [...new Set([-half, half, ...voids.flatMap((v) => [v.z0, v.z1])])]
    .filter((z) => z >= -half && z <= half)
    .sort((a, b) => a - b)

  const pieces: Platform[] = []
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < zs.length - 1; j++) {
      const x0 = xs[i]
      const x1 = xs[i + 1]
      const z0 = zs[j]
      const z1 = zs[j + 1]
      if (x1 - x0 < 1e-6 || z1 - z0 < 1e-6) continue
      const cx = (x0 + x1) / 2
      const cz = (z0 + z1) / 2
      if (voids.some((v) => cx > v.x0 && cx < v.x1 && cz > v.z0 && cz < v.z1)) continue
      pieces.push({
        x: cx,
        z: cz,
        halfW: (x1 - x0) / 2,
        halfD: (z1 - z0) / 2,
        top,
        // You stand on the one above and walk about underneath it, which is
        // what having four of them in one room means.
        walkUnder: true,
      })
    }
  }
  return pieces
}

/** Every slab in the building, holes included. The ground is solid. */
export function coreSlabs(): Platform[] {
  const slabs: Platform[] = [{ x: 0, z: 0, halfW: CORE_HALF, halfD: CORE_HALF, top: 0 }]
  for (const floor of FLOORS) {
    if (floor === 0) continue
    slabs.push(...slabPieces(CORE_HALF, [LIFT_SHAFT, STAIRWELL], floorLevel(floor)))
  }
  return slabs
}

/** Every tread and landing of the stair. */
export function coreStairPlatforms(): Platform[] {
  const parts: Platform[] = []
  for (const floor of [0, 1, 2] as Floor[]) {
    parts.push(halfLandingPlatform(floor), arrivalLandingPlatform(floor))
  }
  parts.push(...HALF_FLIGHTS.flatMap(halfFlightPlatforms))
  return parts
}

/**
 * A rail down each long side of the well, on every floor that has a hole in it.
 *
 * Two rails and no more. A third across the end would meet these at a corner,
 * and this campus has a standing rule — `interiorPhysics.test.ts` enforces it —
 * that no two solid objects may be closer than a player is wide, flush ones
 * included, because a seam is something a least-penetration resolver cannot
 * settle on. A rail crossing a rail is exactly that.
 *
 * Leaving the north end open costs nothing: the half-landing is directly below
 * it, so stepping off there is a stride down onto the stair you were going to
 * walk anyway, not a fall to the ground floor.
 */
const RAIL_HALF_W = 0.12

export function coreGuards(): Collider[] {
  // A wall across the head of the well, at the level of the turn it protects.
  //
  // One per storey rather than one for the building, because it belongs to the
  // half-landing: it is there to stop you walking off the turn, and the turn is
  // half a storey up. That also keeps it clear of the rails down either side —
  // they sit at floor levels and this sits between them, so the two never exist
  // at the same height and cannot form a seam.
  const heads = ([0, 1, 2] as Floor[]).map((floor) => ({
    x: (STAIRWELL.x0 + STAIRWELL.x1) / 2,
    z: STAIRWELL.z0 - 0.15,
    halfW: (STAIRWELL.x1 - STAIRWELL.x0) / 2,
    halfD: 0.15,
    base: halfLandingLevel(floor),
    height: halfLandingLevel(floor) + 1.1,
  }))

  // One rail per side per floor, each knowing which floor it belongs to, so a
  // rail on the third floor no longer rails the entrance hall as well.
  const rails = FLOORS.filter((floor) => floor > 0).flatMap((floor) =>
    [STAIRWELL.x0, STAIRWELL.x1].map((x) => ({
      x,
      z: (STAIRWELL.z0 + STAIRWELL.z1) / 2,
      halfW: RAIL_HALF_W,
      halfD: (STAIRWELL.z1 - STAIRWELL.z0) / 2,
      base: floorLevel(floor),
      height: floorLevel(floor) + 1.1,
    })),
  )

  return [...heads, ...rails]
}


/**
 * The shaft, as three walls with the fourth side open.
 *
 * The open side faces the corridor, which is where you walk in from. A closed
 * shaft is a car nobody can reach, and that is not hypothetical: the lift was
 * unusable for exactly that reason before it was a lift at all, when the thing
 * you had to stand in was a trigger inside the shaft's own footprint.
 */
export function liftShaftWalls(): Collider[] {
  const thickness = 0.25
  // One `id` across all three, because they are one enclosure. Walls meeting
  // at a corner touch, and the campus rule against two solids closer than a
  // player is wide would otherwise read a corner as a slot — `id` is the
  // vocabulary this codebase already uses for "these are the same object",
  // the way a sofa's seat names the sofa it sits on.
  const id = 'lift-shaft'
  const top = BUILDING_HEIGHT
  const midX = (LIFT_SHAFT.x0 + LIFT_SHAFT.x1) / 2
  const midZ = (LIFT_SHAFT.z0 + LIFT_SHAFT.z1) / 2
  return [
    // Back.
    {
      id,
      x: midX,
      z: LIFT_SHAFT.z0 + thickness / 2,
      halfW: (LIFT_SHAFT.x1 - LIFT_SHAFT.x0) / 2,
      halfD: thickness / 2,
      height: top,
    },
    // And the two sides, stopping short of the back so they cannot seam with it.
    ...[LIFT_SHAFT.x0, LIFT_SHAFT.x1].map((x) => ({
      id,
      x: x + (x === LIFT_SHAFT.x0 ? thickness / 2 : -thickness / 2),
      z: midZ + thickness,
      halfW: thickness / 2,
      halfD: (LIFT_SHAFT.z1 - LIFT_SHAFT.z0) / 2 - thickness,
      height: top,
    })),
  ]
}

/** What the panel inside the car calls each floor. */
export function liftFloorNames(): { floor: Floor; label: string }[] {
  return [
    { floor: 0, label: 'Entrance hall' },
    { floor: 1, label: 'Second floor' },
    { floor: 2, label: 'Third floor' },
    { floor: 3, label: 'Fourth floor — library' },
  ]
}
