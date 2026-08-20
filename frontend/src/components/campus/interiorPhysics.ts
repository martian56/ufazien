/**
 * What is solid, what you can stand on, and where you can sit, indoors.
 *
 * Interiors had no collision at all: the only constraint was a clamp on x and z,
 * so every room was an empty square box regardless of what was drawn in it. You
 * walked through the stacks, through the benches, and — most visibly — through
 * the amphitheatre's six raised tiers, which passed through your head on the way
 * to the screen.
 *
 * Everything here is derived from the same numbers `BuildingInteriors` draws
 * with. That duplication is the risk in this file, so `interiorPhysics.test.ts`
 * checks the parts that would be silently wrong: that no seat is inside a
 * collider, that no seat is out of the room, that each tier is within stepping
 * distance of the one below, and that nothing stands between a seat and the
 * board it faces.
 */

import type { InteriorKind } from './campusLayout'
import { INTERIOR_SPECS, interiorHalfExtent } from './interiorSpecs'
import { fitProjector } from './projectorFit'
import { LECTURE_SEATING, LECTURE_ROWS } from './lectureSeating'
import { STEP_UP, isCircle, type Collider, type Platform } from './campusPhysics'
import { ARCADE_PIERS } from './verticalCirculation'
import {
  FLOORS,
  LIFT_SHAFT,
  liftShaftWalls,
  BUILDING_HEIGHT,
  LIFT_CALL_BUTTON,
  LIFT_DOOR_HEIGHT,
  SLAB_THICKNESS,
  clearHeight,
  UFAZ_STAIR,
  storeyHeight,
  coreGuards,
  coreSlabs,
  coreStairPlatforms,
  floorLevel,
} from './ufazCore'

/**
 * The stair's own dimensions live with the circulation they belong to.
 *
 * Re-exported here because this is where callers have always found them, and
 * because moving them was what broke a cycle: this module needs the slabs and
 * the flights, and those need the profile.
 */
export {
  BUILDING_HEIGHT,
  LIFT_CALL_BUTTON,
  LIFT_DOOR_HEIGHT,
  SLAB_THICKNESS,
  UFAZ_STAIR,
  clearHeight,
  storeyHeight,
}

/** Somewhere a player can sit, and which way they face once they do. */
export interface Seat {
  /** Unique across the campus: it is what the server stores to hold the seat. */
  id: string
  x: number
  z: number
  /** Floor height the seat stands on, for tiers and bleachers. */
  y: number
  /**
   * Facing, in radians, matching the avatar's heading convention: zero faces
   * +Z, so the seat looks along `(sin ry, cos ry)`. Stated here because two
   * rooms read it as zero-faces-minus-Z and sat everybody backwards.
   */
  ry: number
  /** How high the seat pan is above `y`. */
  seatHeight: number
  kind: 'chair' | 'bench' | 'sofa' | 'tiered'
  /**
   * The shape of the thing this seat is part of, filled in from `on`.
   *
   * Not written by hand — `linkCarriers` looks it up once, so it cannot drift
   * from the collider it describes. Its purpose is reach: you can sit on a
   * bench from anywhere along it, so how far away you are is measured to the
   * bench, not to the point in the middle of it where the sitter ends up.
   */
  carrier?: Collider
  /**
   * The solid object this seat is part of, when there is one.
   *
   * A chair tucked under a table has its own space on the floor, but the seat
   * of a sofa or a bench is *on* the collider — you sit on the thing you would
   * otherwise walk into. Naming it lets the checks tell "this seat is inside
   * its own sofa", which is what a seat is, from "this seat is inside a vending
   * machine", which is a mistake.
   */
  on?: string
}

interface InteriorPhysics {
  colliders: Collider[]
  platforms: Platform[]
  seats: Seat[]
}

/* ------------------------------------------------------------------ */
/* UFAZ entrance hall                                                   */
/* ------------------------------------------------------------------ */

/**
 * The staircase sits to one side.
 *
 * It used to run up the centre of the hall, directly in front of the projector
 * wall — seventeen metres of landing across the only thing anyone in the room
 * might be trying to watch. Moved right, the centre of the hall is clear from
 * the door all the way to the screen.
 */
/**
 * Where the two flags stand.
 *
 * Either side of the axis, which is where a lobby puts them. They were pushed
 * out to the east wall when the waiting benches were still over there and the
 * flags stood between them and the board; the benches have since moved west,
 * and out at 16.5 the stands were inside the colonnade at 17.
 */
export const UFAZ_FLAGS = [-3, 3]

/**
 * The reception desk, clear of the arcade beside it.
 *
 * At -11.8 its six-metre counter reached x -14.8 and the arcade pier's face is
 * -14.55: a quarter-metre overlap, which is the shallow kind the collision
 * resolver cannot settle a player out of.
 */
export const UFAZ_DESK_X = -9.4

/**
 * The waiting benches, moved down the wall.
 *
 * They were at -6, 0 and 6, and the one at 6 ran into the reception desk once
 * both were on the west side of the hall.
 */
export const UFAZ_BENCH_Z = [-10, -4, 2]

/**
 * Where the waiting benches stand, and how high their seat is.
 *
 * Shared with what draws them. They used to be stated twice — once here for
 * the collider and the seat, once in the renderer for the mesh — and when the
 * collider moved east to clear the arcade the mesh did not follow. Sitting
 * down put the player three metres from the bench, in mid-air.
 */
export const UFAZ_BENCH_X = -11
export const UFAZ_BENCH_SEAT_HEIGHT = 0.58

/**
 * The lift core.
 *
 * Two lifts side by side in a glazed shaft, at the far end of the hall with the
 * corridor running off past them — walk in, cross the hall, and turn left,
 * which is the route through the real building.
 *
 * Back and to one side rather than dead ahead, which is where the photographs
 * put them relative to the doors. Dead ahead is where the projector screen
 * hangs, and a three-metre glass shaft on that line blocks the sightline from
 * every seat in the room: `interiorPhysics.test.ts` failed on the benches, on
 * the centre line, and on the flag stand it was standing half a metre from, all
 * three at once. Screen sharing is not worth a lift lobby. Tucked into the
 * corner and shallower on the second attempt, too: at three metres out from the
 * wall it still clipped the line from the west benches to the near edge of the
 * board, which is the kind of half-blocked view nobody reports and everybody
 * quietly moves away from.
 *
 * The courtyard that was here has gone. It is a real part of the building and
 * the 2017 opening was held in it, but it is not on the route the player walks,
 * and it sat squarely where the lifts and the stair have to be.
 */
export const UFAZ_LIFTS = { x: -15, z: -19, halfW: 3.4, halfD: 1.8 }

/** The speed gates across the entrance, as the photographs show them. */
export const UFAZ_TURNSTILES = [-4.5, -1.5, 1.5, 4.5]
export const UFAZ_TURNSTILE_Z = 13

function ufazCorePhysics(): InteriorPhysics {
  const colliders: Collider[] = [...coreGuards()]
  const platforms: Platform[] = [...coreSlabs(), ...coreStairPlatforms()]
  const seats: Seat[] = []

  // The lift shaft: three walls of glass and steel, open towards the corridor.
  //
  // Three and not four. A solid block here is how the lift came to be unusable
  // in the first place — the trigger that called it sat wholly inside a
  // collider slightly larger than itself, so no reachable point was ever
  // inside it. Now that the car is somewhere you stand rather than a rectangle
  // you step on, a solid shaft would simply wall the car in.
  colliders.push(...liftShaftWalls())

  // The arcade piers, in the same place on every floor, so one footprint each.
  // The openings between them are the walkable part, which is why these are
  // separate boxes rather than one wall — the ground floor used to draw the
  // arcade with no colliders at all, and you walked through the piers.
  for (const z of ARCADE_PIERS) {
    colliders.push({ x: -15, z, halfW: 0.45, halfD: 0.55, height: floorLevel(3) + 4.2 })
  }

  // A bench in each window bay of each upper corridor, which is what they are
  // furnished with. These are the reason a collider needed a floor: they sit
  // in the same place on three different levels, and without a base they would
  // stop somebody standing in the entrance hall underneath them.
  //
  // Solid, but not registered as seats. The stairwell stands between the east
  // wall and the projector, so a seat here could not see the screen — and
  // every room that is for watching something has seats already.
  for (const floor of FLOORS) {
    if (floor === 0) continue
    const y = floorLevel(floor)
    for (const z of [-2, 4, 10]) {
      colliders.push({
        x: 19.4,
        z,
        halfW: 0.55,
        halfD: 1.6,
        base: y,
        height: y + 0.6,
      })
    }
  }

  const ground = ufazGroundFurniture()
  colliders.push(...ground.colliders)
  platforms.push(...ground.platforms)
  seats.push(...ground.seats)

  return { colliders, platforms, seats }
}

function ufazGroundFurniture(): InteriorPhysics {
  const half = INTERIOR_SPECS['ufaz-core'].halfExtent
  const colliders: Collider[] = []
  const platforms: Platform[] = []
  const seats: Seat[] = []

  // The colonnade used to be here, ten round colliders down the sides. The
  // photographs of the building show no columns anywhere, so it has gone from
  // what is drawn — and it has to go from here too, or the hall keeps ten
  // invisible pillars that a player walks into and cannot see.

  // The speed gates. Waist height and narrow, with a person's width between
  // them, so you walk through the line rather than round it.
  for (const x of UFAZ_TURNSTILES) {
    colliders.push({ x, z: UFAZ_TURNSTILE_Z, halfW: 0.24, halfD: 0.62, height: 1.05 })
  }

  // Reception desk. Pulled in off the colonnade: at -13 its corner clipped
  // the column at -17, and a five-centimetre intersection is a seam the
  // collision resolver cannot settle a player on.
  colliders.push({ x: UFAZ_DESK_X, z: 8, halfW: 3, halfD: 0.9, height: 1.25 })

  // Flag stands, moved out towards the walls. On the centre line they stood
  // between the waiting benches and one corner of the board.
  for (const x of UFAZ_FLAGS) {
    colliders.push({ x, z: -half + 15, radius: 0.45, height: 3.4 })
  }

  // Waiting benches down the west side. They were opposite, which put the
  // staircase balustrade between everyone sitting on them and the board.
  for (const z of UFAZ_BENCH_Z) {
    const id = `ufaz-bench-${z}`
    // Clear of the arcade. At -half + 8 the bench and the pier at z -8 overlapped
    // by a quarter of a metre, which is a wedge rather than a wall.
    colliders.push({ id, x: UFAZ_BENCH_X, z, halfW: 0.8, halfD: 2.2, height: 0.6 })
    seats.push({
      id,
      x: UFAZ_BENCH_X,
      z,
      y: 0,
      // Facing back into the hall, away from the wall behind them.
      ry: Math.PI / 2,
      seatHeight: UFAZ_BENCH_SEAT_HEIGHT,
      kind: 'bench',
      on: id,
    })
  }

  return { colliders, platforms, seats }
}

/* ------------------------------------------------------------------ */
/* Library                                                              */
/* ------------------------------------------------------------------ */

/** Where the stacks stand. */
export const STACK_ROWS = [-15, -9, -3, 3]

/**
 * Where the calculator terminal stands.
 *
 * Against the west wall, clear of the reading tables and well off the line
 * between any of them and the projector — a desk with a screen on it is a
 * metre and a half of solid, which is exactly the height that blocks a seated
 * sightline.
 */
export const LIBRARY_TERMINAL: [number, number] = [-13.5, 12]

/**
 * The two runs of the issue desk, either side of the doorway.
 *
 * Between the door and the reading tables at ±9: the tables reach in to 6.5,
 * and the doorway needs a person's width of clearance either side of centre.
 */
export const LIBRARY_DESK_X = [-4, 4]
export const LIBRARY_DESK_HALF = 1.3

/** Where the reading tables stand, and how the chairs sit around them. */
export const LIBRARY_TABLE_X = [-9, 9]
export const LIBRARY_TABLE_Z = [10, 15, 20]
const LIBRARY_SEAT_DX = [-1.3, 1.3]
const LIBRARY_SEAT_DZ = [-1.5, 1.5]

/** Breathing room either side of the sightline, so it is a gap not a slot. */
const LIBRARY_AISLE_MARGIN = 0.7

/**
 * Half-width of the aisle through the stacks at a given row.
 *
 * The stacks used to run the full width of the room, five point eight metres of
 * shelving between every reading table and the board. Nobody sitting down could
 * see the screen at all — and a fixed central aisle does not fix it either,
 * because a reader at the edge of the room is looking diagonally and their line
 * crosses the shelves further out the closer the row is to them.
 *
 * So the aisle is a wedge, opening towards the reading floor along exactly the
 * lines the readers are looking down. Derived from the seat positions rather
 * than guessed, so moving a table cannot quietly wall the screen off again.
 *
 * Aimed at the *far edge* of the screen rather than its centre. Clearing the
 * centre is what a first version did, and it is not the requirement: it leaves
 * a reader at the end of a row able to see the middle of the picture and none
 * of one side of it, which is worse than useless for a slide.
 */
export function libraryAisleHalf(rowZ: number): number {
  const spec = INTERIOR_SPECS.library
  const screenZ = spec.projector[2]
  const halfScreen = fitProjector(16 / 9, spec.projector[1], spec.ceiling).width / 2
  let required = 0

  for (const tableX of LIBRARY_TABLE_X) {
    for (const dx of LIBRARY_SEAT_DX) {
      for (const tableZ of LIBRARY_TABLE_Z) {
        for (const dz of LIBRARY_SEAT_DZ) {
          const seatX = tableX + dx
          const seatZ = tableZ + dz
          if (seatZ <= rowZ) continue
          const t = (rowZ - screenZ) / (seatZ - screenZ)
          // Both edges of the screen: a reader to the left of centre is worst
          // served by the left edge, and vice versa.
          for (const edge of [-halfScreen, halfScreen]) {
            required = Math.max(required, Math.abs(edge + (seatX - edge) * t))
          }
        }
      }
    }
  }

  return required + LIBRARY_AISLE_MARGIN
}

function libraryPhysics(): InteriorPhysics {
  const half = INTERIOR_SPECS.library.halfExtent
  const colliders: Collider[] = []
  const seats: Seat[] = []

  // Stacks, in two runs per row with the sightline wedge between them.
  const stackOuter = half - 4
  for (const z of STACK_ROWS) {
    const aisle = libraryAisleHalf(z)
    const runHalf = (stackOuter - aisle) / 2
    if (runHalf <= 0.5) continue
    for (const side of [-1, 1]) {
      colliders.push({
        x: side * (aisle + runHalf),
        z,
        halfW: runHalf,
        halfD: 0.35,
        height: 5.8,
      })
    }
  }

  // Reading tables, and the chairs round them.
  for (const z of LIBRARY_TABLE_Z) {
    for (const x of LIBRARY_TABLE_X) {
      colliders.push({ x, z, halfW: 2.5, halfD: 1, height: 0.8 })
      for (const seatX of LIBRARY_SEAT_DX) {
        for (const seatZ of LIBRARY_SEAT_DZ) {
          seats.push({
            id: `library-${x}-${z}-${seatX}-${seatZ}`,
            x: x + seatX,
            z: z + seatZ,
            y: 0,
            // Turned to the table, which is also roughly towards the screen.
            ry: seatZ > 0 ? Math.PI : 0,
            seatHeight: 0.5,
            kind: 'chair',
          })
        }
      }
    }
  }

  // Issue desk by the door, in two runs either side of it.
  //
  // It used to be one seven-metre counter on the centre line, which is where
  // the door is: the way out of the library ran straight through the desk.
  // `doorways.test.ts` holds the approach clear now.
  for (const x of LIBRARY_DESK_X) {
    colliders.push({ x, z: half - 4, halfW: LIBRARY_DESK_HALF, halfD: 0.95, height: 1.35 })
  }

  // The calculator terminal, against the west wall clear of the reading
  // tables. Turned to face into the room, so its footprint is deep rather
  // than wide.
  colliders.push({
    x: LIBRARY_TERMINAL[0],
    z: LIBRARY_TERMINAL[1],
    halfW: 0.45,
    halfD: 0.9,
    height: 1.5,
  })

  return { colliders, platforms: [], seats }
}

/* ------------------------------------------------------------------ */
/* Laboratory                                                           */
/* ------------------------------------------------------------------ */

/**
 * Fume cupboards along the back wall, moved out to leave the centre clear.
 *
 * They were at -13, -4.5, 4 and 12.5, and being 7.6 metres wide and 3.8 tall
 * that put a near-continuous wall of cabinet across the projector.
 */
export const FUME_CUPBOARDS = [-15.5, -7.6, 7.6, 15.5]

/** The island benches, and the walkway left down the middle of them. */
export const LAB_BENCH_ROWS = [-9, -2, 5]
export const LAB_AISLE = 2.6
export const LAB_BENCH_HALF = 4.3

/** The two runs of cabinets, as the collision layer sees them. */
export const FUME_RUN_HALF = 7.75
export const FUME_RUN_CENTRE = 11.55

function labPhysics(): InteriorPhysics {
  const half = INTERIOR_SPECS.lab.halfExtent
  const colliders: Collider[] = []

  // Island benches, in two runs with a walkway between them. They used to run
  // the full twenty-two metres, and being taller than eye level once the
  // reagent shelf is counted, anyone standing behind one could see neither the
  // rest of the room nor the board.
  for (const z of LAB_BENCH_ROWS) {
    for (const side of [-1, 1]) {
      colliders.push({
        x: side * (LAB_AISLE + LAB_BENCH_HALF),
        z,
        halfW: LAB_BENCH_HALF,
        halfD: 1.25,
        height: 1.9,
      })
    }
  }

  // One collider per run rather than one per cabinet. They stand shoulder to
  // shoulder with a three-centimetre reveal between them, and two colliders
  // that close are a slot the player can be pushed into and not get out of.
  for (const side of [-1, 1]) {
    colliders.push({
      x: side * FUME_RUN_CENTRE,
      z: -half + 1.4,
      halfW: FUME_RUN_HALF,
      halfD: 1.1,
      height: 3.8,
    })
  }

  // Safety shower in the corner.
  colliders.push({ x: half - 2.5, z: half - 3, radius: 0.6, height: 4.4 })

  return { colliders, platforms: [], seats: [] }
}

/* ------------------------------------------------------------------ */
/* Amphitheatre                                                         */
/* ------------------------------------------------------------------ */

const LECTURE_SEATS_PER_ROW = 9

function lecturePhysics(): InteriorPhysics {
  const half = INTERIOR_SPECS.lecture.halfExtent
  const colliders: Collider[] = []
  const platforms: Platform[] = []
  const seats: Seat[] = []

  for (const row of LECTURE_ROWS) {
    const z = LECTURE_SEATING.frontZ + row * LECTURE_SEATING.rowDepth
    const top = row * LECTURE_SEATING.riser

    // The tier, which is a floor at that height rather than a solid block.
    platforms.push({ x: 0, z, halfW: half * 0.925, halfD: LECTURE_SEATING.rowDepth / 2, top })

    // The desk along the front of it.
    colliders.push({ x: 0, z: z - 1.5, halfW: half * 0.85, halfD: 0.65, height: top + 0.85 })

    for (let i = 0; i < LECTURE_SEATS_PER_ROW; i++) {
      const x = -half * 0.78 + i * ((half * 1.56) / (LECTURE_SEATS_PER_ROW - 1))
      seats.push({
        id: `lecture-${row}-${i}`,
        x,
        z: z + 0.4,
        y: top,
        // Facing the board, which is at -Z. `ry` is the avatar convention, in
        // which zero faces *+Z* — so zero here turned all fifty-four seats to
        // face the back wall, and a lecture was delivered to the backs of
        // everybody's heads.
        ry: Math.PI,
        seatHeight: 0.5,
        kind: 'tiered',
      })
    }
  }

  // Lectern, off to one side of the screen rather than in front of it.
  colliders.push({ x: -7, z: -half + 6, halfW: 0.75, halfD: 0.45, height: 1.3 })

  return { colliders, platforms, seats }
}

/* ------------------------------------------------------------------ */
/* Student centre                                                       */
/* ------------------------------------------------------------------ */

/** How far each sofa sits from the low table between the pair. */
export const LOUNGE_SOFA_OFFSET = 2.4

export const LOUNGE_CLUSTERS: [number, number][] = [
  [-12, 10],
  [12, 10],
  [-12, -4],
  [12, -4],
  [0, 4],
]

/** Moved off the centre of the back wall, which is where the screen is. */
export const VENDING_MACHINES = [-17, -14]

/** Pushed into the corner: on the centre it stood across one side of the screen. */
export const TABLE_FOOTBALL: [number, number] = [17, 8]

function studentCentrePhysics(): InteriorPhysics {
  const half = INTERIOR_SPECS['student-center'].halfExtent
  const colliders: Collider[] = []
  const seats: Seat[] = []

  LOUNGE_CLUSTERS.forEach(([x, z], i) => {
    // Two sofas facing each other across a low table. Pushed out from it: at
    // two metres the gap between sofa and table was 0.8, which is a slot a
    // player can be shoved into and not walk out of.
    for (const offset of [LOUNGE_SOFA_OFFSET, -LOUNGE_SOFA_OFFSET]) {
      const id = `centre-sofa-${i}-${offset}`
      colliders.push({ id, x, z: z + offset, halfW: 1.6, halfD: 0.65, height: 1.45 })
      seats.push({
        id,
        x,
        z: z + offset,
        y: 0,
        ry: offset > 0 ? Math.PI : 0,
        seatHeight: 0.55,
        kind: 'sofa',
        on: id,
      })
    }
    colliders.push({ x, z, halfW: 1.1, halfD: 0.55, height: 0.5 })
  })

  colliders.push({ x: TABLE_FOOTBALL[0], z: TABLE_FOOTBALL[1], halfW: 2.1, halfD: 1.2, height: 1.3 })

  // The pair as one collider: they stand shoulder to shoulder, and the
  // six-hundred-millimetre reveal between them is a slot, not a route.
  colliders.push({
    x: (VENDING_MACHINES[0] + VENDING_MACHINES[1]) / 2,
    z: -half + 1.2,
    halfW: Math.abs(VENDING_MACHINES[1] - VENDING_MACHINES[0]) / 2 + 1.2,
    halfD: 0.55,
    height: 3,
  })

  // Coffee bar, turned against the west wall.
  colliders.push({ x: -half + 2.6, z: -12, halfW: 5, halfD: 0.8, ry: Math.PI / 2, height: 2.2 })

  colliders.push({ x: -9, z: 16, halfW: 2.3, halfD: 1.3, height: 1.05 })

  // Booths in the corner. Bench, table, bench as one solid unit rather than
  // three: the gaps between them are the width of a pair of knees, which is
  // right for a booth and wrong for anything the player might be pushed into.
  for (const z of [-16, -10.5]) {
    const booth = `centre-booth-${z}`
    colliders.push({ id: booth, x: 15, z, halfW: 1.3, halfD: 1.3, height: 1.4 })
    for (const side of [-1, 1]) {
      seats.push({
        id: `${booth}-${side}`,
        x: 15,
        z: z + side * 1.1,
        y: 0,
        ry: side > 0 ? Math.PI : 0,
        seatHeight: 0.5,
        kind: 'bench',
        on: booth,
      })
    }
  }

  return { colliders, platforms: [], seats }
}

/* ------------------------------------------------------------------ */
/* Cafeteria                                                            */
/* ------------------------------------------------------------------ */

/**
 * The bins by the cafeteria door, either side of the way out.
 *
 * There were three, at -3, 0 and 3. The one on the centre line stood in the
 * doorway itself: leaving the cafeteria meant walking round a bin placed in
 * the only way out.
 */
export const CAFE_BINS = [-5.2, -3, 3]

export const CAFE_TABLE_X = [-11, -3.5, 4, 11.5]
export const CAFE_TABLE_Z = [-8, -1, 6, 13]
/**
 * The heat lamps over the servery, lowered.
 *
 * They hung at 2.7 with the bottom of the projector screen at 2.3, so from any
 * table the lamps cut across the picture. Dropped below the screen, and the
 * screen itself raised, the whole board clears the servery.
 */
export const CAFE_HEAT_LAMP_Y = 2.5

function cafeteriaPhysics(): InteriorPhysics {
  const half = INTERIOR_SPECS.cafeteria.halfExtent
  const colliders: Collider[] = []
  const seats: Seat[] = []

  // Servery and tray rail as one counter. The rail runs along the front of the
  // servery with a five-centimetre reveal behind it — part of the same piece of
  // furniture, and far too tight to be a place a player should end up.
  const serveryBack = -half + 3 - 1.3
  const serveryFront = -half + 4.6 + 0.25
  colliders.push({
    x: 0,
    z: (serveryBack + serveryFront) / 2,
    halfW: 13,
    halfD: (serveryFront - serveryBack) / 2,
    // The counter, not the sneeze guard above it. The guard is glass and you
    // see the board straight through it; measuring to the top of it meant
    // anyone at the counter was recorded as unable to see a screen they can
    // see perfectly well.
    height: 1.3,
  })

  for (const z of CAFE_TABLE_Z) {
    for (const x of CAFE_TABLE_X) {
      colliders.push({ x, z, halfW: 1.5, halfD: 0.75, height: 0.85 })
      for (const seatX of [-0.8, 0.8]) {
        for (const seatZ of [-1.4, 1.4]) {
          seats.push({
            id: `cafe-${x}-${z}-${seatX}-${seatZ}`,
            x: x + seatX,
            z: z + seatZ,
            y: 0,
            ry: seatZ > 0 ? Math.PI : 0,
            seatHeight: 0.5,
            kind: 'chair',
          })
        }
      }
    }
  }

  // Bins and a water station by the door — beside it, not across it. The
  // middle one stood in the doorway, so leaving the cafeteria meant walking
  // round a bin placed in the only way out.
  for (const x of CAFE_BINS) {
    colliders.push({ x, z: half - 2.5, halfW: 0.5, halfD: 0.5, height: 1.2 })
  }

  return { colliders, platforms: [], seats }
}

/* ------------------------------------------------------------------ */
/* Sports hall                                                          */
/* ------------------------------------------------------------------ */

export const BLEACHER_TIERS = 4
/** Raised clear of the projector screen, which reaches 11.2 metres. */
export const SCOREBOARD_Y = 13.5

function sportsPhysics(): InteriorPhysics {
  const half = INTERIOR_SPECS.sports.halfExtent
  const colliders: Collider[] = []
  const platforms: Platform[] = []
  const seats: Seat[] = []

  for (let tier = 0; tier < BLEACHER_TIERS; tier++) {
    // Started at 1.2 from the wall, which put the bottom tier outside the
    // limit the player is clamped to: a seat nobody could ever reach.
    const x = -half + 2.6 + tier * 1.4
    platforms.push({ x, z: 0, halfW: 0.7, halfD: half * 0.75, top: tier * 0.7 + 0.7 })

    // Somewhere to sit on each tier, spaced down its length.
    for (const z of [-12, -4, 4, 12]) {
      seats.push({
        id: `sports-${tier}-${z}`,
        x,
        z,
        y: tier * 0.7 + 0.7,
        // Facing out across the court, away from the wall behind. The bleachers
        // stand against the west wall, so that is +X, and in the avatar
        // convention a forward of (1, 0) is +PI/2. The sign was the other way
        // round and every seat faced the wall it is bolted to.
        ry: Math.PI / 2,
        seatHeight: 0,
        kind: 'tiered',
      })
    }
  }

  // Wall bars, flat against the east wall.
  colliders.push({ x: half - 0.7, z: 6, halfW: 0.15, halfD: 2.5, height: 6.1 })

  return { colliders, platforms, seats }
}

/* ------------------------------------------------------------------ */

/**
 * Gives every seat the shape of the thing it sits on.
 *
 * A seat names its carrier by id; this is where that name is resolved, once,
 * against the colliders of the same room. Done here rather than at each of the
 * hundred-odd places a seat is declared, so the two cannot disagree — which is
 * exactly how the entrance hall's benches came to be drawn three metres from
 * the seats that belonged to them.
 */
function linkCarriers(physics: InteriorPhysics): InteriorPhysics {
  const byId = new Map<string, Collider>()
  for (const collider of physics.colliders) {
    if (collider.id) byId.set(collider.id, collider)
  }
  return {
    ...physics,
    seats: physics.seats.map((seat) =>
      seat.on && byId.has(seat.on) ? { ...seat, carrier: byId.get(seat.on) } : seat,
    ),
  }
}

const PHYSICS: Record<InteriorKind, InteriorPhysics> = {
  'ufaz-core': linkCarriers(ufazCorePhysics()),
  library: linkCarriers(libraryPhysics()),
  lab: linkCarriers(labPhysics()),
  lecture: linkCarriers(lecturePhysics()),
  'student-center': linkCarriers(studentCentrePhysics()),
  cafeteria: linkCarriers(cafeteriaPhysics()),
  sports: linkCarriers(sportsPhysics()),
}

export function interiorColliders(kind: InteriorKind | undefined): Collider[] {
  return PHYSICS[kind ?? 'lecture'].colliders
}

export function interiorPlatforms(kind: InteriorKind | undefined): Platform[] {
  return PHYSICS[kind ?? 'lecture'].platforms
}

export function interiorSeats(kind: InteriorKind | undefined): Seat[] {
  return PHYSICS[kind ?? 'lecture'].seats
}

/** Every seat on the campus, indoors, keyed by the interior it is in. */
export const ALL_INTERIOR_SEATS: { kind: InteriorKind; seat: Seat }[] = (
  Object.keys(PHYSICS) as InteriorKind[]
).flatMap((kind) => PHYSICS[kind].seats.map((seat) => ({ kind, seat })))

/**
 * How far a player can be from a seat and still be offered it.
 *
 * Measured to the piece of furniture, not to the point on it where the sitter
 * ends up — see `reachDistance`. Wide enough to catch the seat you are
 * obviously standing at, tight enough that a row of chairs does not all offer
 * themselves at once.
 */
export const SEAT_REACH = 1.6

/**
 * How far a player is from being able to sit down.
 *
 * To the edge of the thing the seat is part of, when it is part of something.
 * Measuring to the seat point meant a bench 4.4 m long could only be taken
 * from a narrow spot beside its middle: stand at either end — squarely against
 * the bench, plainly at it — and you were 2.5 m from a point 1.6 m away, so
 * nothing was offered. A bench is somewhere you sit along, not a spot.
 *
 * Loose seats keep their point. A chair *is* its own footprint, and a chair
 * that offered itself from a metre past its back would be worse.
 */
export function reachDistance(x: number, z: number, seat: Seat): number {
  const carrier = seat.carrier
  if (!carrier) return Math.hypot(x - seat.x, z - seat.z)

  if (isCircle(carrier)) {
    return Math.max(0, Math.hypot(x - carrier.x, z - carrier.z) - carrier.radius)
  }

  // Nearest point on the box, in the box's own frame so a turned bench is
  // measured to its actual edge rather than to a bounding rectangle.
  const angle = carrier.ry ?? 0
  const dx = x - carrier.x
  const dz = z - carrier.z
  const localX = angle ? dx * Math.cos(-angle) - dz * Math.sin(-angle) : dx
  const localZ = angle ? dx * Math.sin(-angle) + dz * Math.cos(-angle) : dz
  const outX = Math.max(0, Math.abs(localX) - carrier.halfW)
  const outZ = Math.max(0, Math.abs(localZ) - carrier.halfD)
  return Math.hypot(outX, outZ)
}

/** The seat nearest a position, if one is within reach. */
export function nearestSeat(
  x: number,
  z: number,
  seats: Seat[],
  reach = SEAT_REACH,
  taken: ReadonlySet<string> = new Set(),
  feet?: number,
): Seat | null {
  let best: Seat | null = null
  let bestDistance = reach
  // Two seats on one sofa are both nought from the sofa, so how far away the
  // sitter would be decides between them.
  let bestOnSeat = Infinity

  for (const seat of seats) {
    if (taken.has(seat.id)) continue
    // A seat on another tier is not the seat you are standing at. The sports
    // hall's bleachers are 1.4 apart in x and 0.7 in y, and the reach is 1.6,
    // so without this a player on one tier is offered the row above and below
    // and sitting teleports them to a different height.
    if (feet !== undefined && Math.abs(seat.y - feet) > STEP_UP) continue
    const distance = reachDistance(x, z, seat)
    if (distance > bestDistance) continue
    const onSeat = Math.hypot(x - seat.x, z - seat.z)
    if (distance < bestDistance || onSeat < bestOnSeat) {
      best = seat
      bestDistance = distance
      bestOnSeat = onSeat
    }
  }

  return best
}

/** Keeps a seat inside the room, which is what the page clamps the player to. */
export function seatWithinRoom(kind: InteriorKind, seat: Seat): boolean {
  const limit = interiorHalfExtent(kind)
  return Math.abs(seat.x) <= limit && Math.abs(seat.z) <= limit
}
