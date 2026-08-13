/**
 * Getting between the floors of the main building.
 *
 * The stair went up to a landing four and a half metres above the hall and
 * stopped against a blank wall. The lift doors were a picture of lift doors.
 * The building was one room pretending to be a landmark, and everything else
 * the university does was in six separate sheds scattered across a lawn.
 *
 * It is one building now. The ground floor is the entrance hall; the three
 * floors above it repeat the same corridor plan — which is how the real
 * building is laid out — and the rooms open off those corridors. The library is
 * on the fourth, where it actually is.
 *
 * ## Rooms keep their ids
 *
 * A room's numeric id is what travels over the wire as `current_room`, and the
 * screen-share check compares it against what other clients send. So the
 * library is still room 2 whether you reach it across a lawn or out of a lift,
 * and a presenter in it stays visible to everyone in it. Nothing here
 * renumbers anything; the rooms have moved indoors, not changed identity.
 *
 * Pure, so the whole graph can be walked in a test without a canvas.
 */

import { PLAYER_RADIUS, type InteriorKind } from './campusLayout'

/** Ground, then the three floors above it. */
export type Floor = 0 | 1 | 2 | 3

/**
 * How a player got from one room to another.
 *
 * The distinction matters for where they come out: take the stair up and you
 * arrive at the head of the flight, take the lift and you arrive at the lift
 * lobby, and walking through a classroom door puts you inside the door.
 */
export type PortalKind = 'stair-up' | 'stair-down' | 'lift' | 'door'

export interface Portal {
  /** The room this leads to. Numeric, because it is a `current_room`. */
  to: number
  kind: PortalKind
  /** The trigger, as a rectangle on the floor of the room it is in. */
  x: number
  z: number
  halfW: number
  halfD: number
  /**
   * The height a player has to be at to use it, when that matters.
   *
   * The stair up is triggered on the landing, which is four and a half metres
   * off the floor of the hall; its rectangle in plan also covers the flight
   * beneath it, so without this you would be sent upstairs by walking under
   * the landing rather than up onto it.
   */
  minY?: number
  /** Where the player is put down in the target room. */
  spawn: { x: number; z: number }
  /** What the prompt says, if anything is shown. */
  label: string
}

/**
 * The corridor plan, repeated on floors 1 to 3.
 *
 * Rooms open off the west side, which is the arcade wall, at these z offsets.
 * Every floor uses the same set, because in the real building the corridors on
 * the upper floors are the same corridor.
 */
export const CORRIDOR_DOORS = [-12, -4, 4, 12]

/**
 * The arcade piers, between the doors rather than across them.
 *
 * One list, exported, because it was written out twice — once in what is drawn
 * and once in what is solid — and the two had a pier at z -4, which is where a
 * classroom door is. A pier standing in a doorway is a door that cannot be
 * used, and nothing about either copy said the two lists had to agree.
 *
 * The run stops short of the lift core, which stands on the same line at the
 * back of the room: a pier at -16 left a 0.65 m slot against the shaft, and a
 * slot that narrow is a wedge the collision resolver cannot settle a player in.
 */
export const ARCADE_PIERS = [-8, 0, 8, 16]

/**
 * The stair, as the numbers everything else is derived from.
 *
 * ## Why it turns
 *
 * It was a straight flight of fourteen steps with a landing on the end, which
 * is not the stair in the building. The one in the photographs is stone, with a
 * black wrought-iron balustrade and a dark timber handrail, and it *winds* — it
 * climbs past the lift shaft and carries on round out of frame. A straight run
 * is also the wrong shape for this room: fourteen steps at a 0.62 m going is
 * nearly nine metres of floor spent going up one level, which is why the old
 * one had to be shoved into a corner and still crossed half the hall.
 *
 * So it is a helix: three quarters of a turn about an open core, twenty-four
 * treads, landing on the east side. It occupies a circle 8.6 m across instead
 * of a strip 7 by 12, and you can see the hall through it the whole way up.
 *
 * ## The numbers
 *
 * A 0.19 m rise and a 0.54 m going at the walking line, which is a shallow,
 * comfortable stair rather than the ladder a tight spiral usually is — that is
 * what the 2.75 m walking radius buys. Twenty-four of them is 4.56 m, which is
 * the floor-to-floor height the building already used.
 *
 * Everything downstream is computed from this: `stairTreads` gives the treads,
 * `interiorPhysics` turns them into platforms, and `BuildingInteriors` draws
 * them. There is one description of this stair and three readers of it, which
 * is the arrangement the old one did not have — it was drawn in one file and
 * made solid in another, and for a while the drawn one had no platforms under
 * it at all on the upper floors.
 */
export const STAIR = {
  /** Centre of the well, in room coordinates. */
  x: 11,
  z: -15.2,
  /** The open core down the middle, and the outer edge of the treads. */
  well: 1.2,
  outer: 4.3,
  /** Where feet actually go, halfway between the two. */
  walk: 2.75,
  treads: 24,
  rise: 0.19,
  /** Radians turned per tread. Negative, so it winds clockwise seen from above. */
  turn: -(Math.PI * 1.5) / 24,
}

/** How high the flight climbs: one floor. */
export const STAIR_RISE = STAIR.treads * STAIR.rise

/** One tread of the helix. */
export interface Tread {
  /** 1 to `STAIR.treads`, counting up from the floor. */
  index: number
  /** Where it points, as a polar angle: 0 is due south, and it winds clockwise. */
  angle: number
  /** The height of the walking surface. */
  top: number
  /** The centre of the tread, on the walking line. */
  x: number
  z: number
}

/**
 * Every tread, from the bottom.
 *
 * The last one comes out due east, which is where the landing is: the flight is
 * laid out backwards from the landing rather than forwards from the foot,
 * because the landing is the thing that has to line up with something.
 */
export function stairTreads(): Tread[] {
  return Array.from({ length: STAIR.treads }, (_, i) => {
    const index = i + 1
    const angle = STAIR.turn * index
    return {
      index,
      angle,
      top: STAIR.rise * index,
      x: STAIR.x + Math.sin(angle) * STAIR.walk,
      z: STAIR.z + Math.cos(angle) * STAIR.walk,
    }
  })
}

/**
 * How wide and deep a tread is, as a box.
 *
 * The tangential half-width is measured at the *outer* edge, not at the walking
 * line: sized to the middle, the boxes tile at 2.75 m and leave a 0.3 m gap
 * between them out at 4.3, which is a hole in the stair exactly where somebody
 * holding forward round the outside of a bend would find it.
 */
export const TREAD_HALF_W = (STAIR.outer * Math.abs(STAIR.turn)) / 2
export const TREAD_HALF_D = (STAIR.outer - STAIR.well) / 2

/**
 * The landing at the top, and the two triggers.
 *
 * The landing runs due east off the last tread, out over floor nothing else
 * uses. `STAIR_HEAD` covers very nearly all of it on purpose: arriving on the
 * landing is what takes you up, so there is no moment where a player is stood
 * on a platform four and a half metres up with an unguarded edge.
 */
export const STAIR_LANDING = { x: 16, z: -15.2, halfW: 2.2, halfD: 1.3 }
export const STAIR_HEAD = { x: 16, z: -15.2, halfW: 2, halfD: 1.15 }

/**
 * Where you stand to go down: on the floor at the foot of the flight.
 *
 * Clear of the helix's own footprint rather than under it. Everything more than
 * a step above your feet is a wall, so the treads overhead are solid from down
 * here — a trigger tucked under the flight would be one you could never reach.
 */
export const STAIR_FOOT = { x: 10.5, z: -9.2, halfW: 2, halfD: 1.3 }

/** The interiors this stair stands in: the entrance hall and the corridors. */
export const STAIR_ROOMS: readonly InteriorKind[] = ['ufaz', 'ufaz-floor']

/**
 * Keeps a player on the stair instead of off the side of it.
 *
 * A helix is walked tangentially: you hold forward and the stair curves away
 * from under you. The treads themselves stop you cutting across the flight —
 * anything more than a step up is a wall — but they do nothing about the
 * outside of the bend, which is a 4.5 m drop by the top.
 *
 * A balustrade would be the obvious answer and it cannot be one here: as
 * colliders it is twenty-odd boxes half a metre apart, and half a metre apart
 * is the exact thing `interiorPhysics.test.ts` forbids, because a slot narrower
 * than a player is somewhere they get wedged. So it is a clamp, like the room's
 * own walls are a clamp — a radius rather than geometry.
 *
 * Only above the third tread, so that walking past the stair at floor level is
 * unaffected, and never on the landing, or stepping off the top would drag the
 * player back onto the flight they just climbed.
 *
 * Returns null when there is nothing to do, which is almost always.
 */
export function stairwellClamp(
  kind: InteriorKind,
  x: number,
  z: number,
  feet: number,
  radius = PLAYER_RADIUS,
): { x: number; z: number } | null {
  // Only the rooms this stair is actually in. Every interior is drawn at the
  // same origin, so without this the amphitheatre's back row and the sports
  // hall's bleachers — the two other places in the campus where a player stands
  // several metres off the floor — sit inside a stairwell that is not there.
  if (!STAIR_ROOMS.includes(kind)) return null
  if (feet <= STAIR.rise * 3) return null
  if (
    Math.abs(x - STAIR_LANDING.x) <= STAIR_LANDING.halfW &&
    Math.abs(z - STAIR_LANDING.z) <= STAIR_LANDING.halfD
  ) {
    return null
  }

  const dx = x - STAIR.x
  const dz = z - STAIR.z
  const distance = Math.hypot(dx, dz)
  const limit = STAIR.outer - radius
  if (distance <= limit) return null
  // Beyond the stair altogether — on a landing edge or another floor's
  // furniture — is not something to be pulled towards the stair.
  if (distance > STAIR.outer + 2) return null

  const scale = limit / distance
  return { x: STAIR.x + dx * scale, z: STAIR.z + dz * scale }
}

/**
 * Where you stand to call the lift: in front of the doors, not inside the car.
 *
 * This was the shaft's own footprint, which is solid — the trigger sat wholly
 * inside a collider that is slightly larger than it, so no reachable point was
 * ever inside the trigger and the lift could not be used at all. The graph
 * tests all passed: they checked that the portals joined up, never that a
 * player could stand in one.
 */
export const LIFT_CAR = { x: -15, z: -15.6, halfW: 2.6, halfD: 1.2 }

/**
 * Which rooms are on which floor.
 *
 * The ground floor is the entrance hall you arrive in. The three above it are
 * corridors, each with rooms off it. Ids are the ones those rooms already had
 * when they were separate buildings on the campus.
 */
export interface FloorPlan {
  floor: Floor
  /** The corridor (or hall) itself, as a room id. */
  corridor: number
  /** Rooms opening off it, in corridor order. */
  rooms: { id: number; name: string }[]
}

export const FLOOR_PLANS: FloorPlan[] = [
  // The entrance hall. The conference room is through the door on the right as
  // you come in, which is where the photographs put it.
  { floor: 0, corridor: 1, rooms: [{ id: 4, name: 'Conference Hall' }] },
  { floor: 1, corridor: 8, rooms: [{ id: 3, name: 'Laboratories' }, { id: 6, name: 'Cafeteria' }] },
  { floor: 2, corridor: 9, rooms: [{ id: 5, name: 'Student Centre' }, { id: 7, name: 'Sports Hall' }] },
  // The library is on the fourth floor, in the roof.
  { floor: 3, corridor: 10, rooms: [{ id: 2, name: 'Library' }] },
]

/** The corridor room id for a floor, and the reverse. */
export const CORRIDOR_OF: Record<Floor, number> = { 0: 1, 1: 8, 2: 9, 3: 10 }

export function floorOfCorridor(roomId: number): Floor | null {
  const found = FLOOR_PLANS.find((plan) => plan.corridor === roomId)
  return found ? found.floor : null
}

/** Whether a room is one of the circulation levels rather than a room off one. */
export function isCorridor(roomId: number): boolean {
  return FLOOR_PLANS.some((plan) => plan.corridor === roomId)
}

/** The corridor a given room opens off, if it is inside the building. */
export function corridorFor(roomId: number): number | null {
  const found = FLOOR_PLANS.find((plan) => plan.rooms.some((room) => room.id === roomId))
  return found ? found.corridor : null
}

/**
 * Every way out of a room.
 *
 * For a corridor: the stair up, the stair down, the lift, and a door per room
 * on that floor. For a room: nothing — you leave a room the way you came in,
 * through its own doorway, which the existing door machinery already handles.
 */
export function portalsFrom(roomId: number): Portal[] {
  const floor = floorOfCorridor(roomId)
  if (floor === null) return []

  const plan = FLOOR_PLANS[floor]
  const portals: Portal[] = []

  if (floor < 3) {
    portals.push({
      to: CORRIDOR_OF[(floor + 1) as Floor],
      kind: 'stair-up',
      ...STAIR_HEAD,
      // Only from the top of the flight. The landing stands over the last few
      // treads and over open floor, so without a height the player is sent
      // upstairs for walking underneath a stair they have not climbed.
      minY: STAIR_RISE - STAIR.rise * 4,
      // Clear of the flight, not on it. Landing on the foot of the stair puts
      // the player straight into the trigger that goes back down, and they
      // bounce between two floors with no way to walk out of it.
      spawn: { x: STAIR_FOOT.x, z: STAIR_FOOT.z + 4 },
      label: 'Up',
    })
  }
  if (floor > 0) {
    portals.push({
      to: CORRIDOR_OF[(floor - 1) as Floor],
      kind: 'stair-down',
      ...STAIR_FOOT,
      spawn: { x: STAIR_HEAD.x, z: STAIR_HEAD.z + 3 },
      label: 'Down',
    })
  }

  // The lift, which runs to the library on the top floor and back to the hall.
  // Two stops rather than four: a full floor selector is a menu, and the stair
  // is right there for anyone going one floor.
  const liftTarget = floor === 3 ? CORRIDOR_OF[0] : CORRIDOR_OF[3]
  portals.push({
    to: liftTarget,
    kind: 'lift',
    ...LIFT_CAR,
    spawn: { x: LIFT_CAR.x, z: LIFT_CAR.z + 3.2 },
    label: floor === 3 ? 'Lift to the entrance hall' : 'Lift to the library',
  })

  plan.rooms.forEach((room, i) => {
    portals.push({
      to: room.id,
      kind: 'door',
      x: -14.6,
      z: CORRIDOR_DOORS[i] ?? 0,
      halfW: 1.2,
      halfD: 1.6,
      spawn: { x: 0, z: 0 },
      label: room.name,
    })
  })

  return portals
}

/**
 * The portal a player standing here would use, if any.
 *
 * `y` is the height of their feet, which only the stair cares about.
 */
export function portalAt(roomId: number, x: number, z: number, y = 0): Portal | null {
  for (const portal of portalsFrom(roomId)) {
    if (portal.minY !== undefined && y < portal.minY) continue
    if (Math.abs(x - portal.x) > portal.halfW) continue
    if (Math.abs(z - portal.z) > portal.halfD) continue
    return portal
  }
  return null
}

/**
 * Where a player leaving a room comes out.
 *
 * A room off a corridor puts you back in that corridor, at its door. Only the
 * ground floor opens to the street — walking out of the library on the fourth
 * floor and finding yourself on Nizami Street is the sort of thing that makes
 * a building feel like a menu.
 */
export function exitOf(roomId: number): { room: number; spawn: { x: number; z: number } } | null {
  const corridor = corridorFor(roomId)
  if (corridor === null) return null

  const plan = FLOOR_PLANS.find((p) => p.corridor === corridor)!
  const index = plan.rooms.findIndex((room) => room.id === roomId)
  return {
    room: corridor,
    // Just inside the corridor from that room's door, not on top of it.
    spawn: { x: -12.4, z: CORRIDOR_DOORS[index] ?? 0 },
  }
}

/** Every room the building contains, corridors included. */
export function allRoomIds(): number[] {
  return FLOOR_PLANS.flatMap((plan) => [plan.corridor, ...plan.rooms.map((room) => room.id)])
}

/** The interior design a corridor floor uses. Floors 1-3 share one. */
export function corridorKind(roomId: number): InteriorKind {
  return roomId === 1 ? 'ufaz' : 'ufaz-floor'
}
