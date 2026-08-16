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

import type { InteriorKind } from './campusLayout'

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

  // No stair portals. The stair is a stair: four levels in one space, with
  // flights you climb and slabs you walk out onto. Which floor you are on is
  // read off how high you are — see `floorAt` in `ufazCore` — rather than set
  // by walking into a rectangle, so there is nothing here to get wrong.
  //
  // That retires the two ways it used to go wrong. The trigger to go down
  // covered the foot of the flight, so approaching the stair to climb it sent
  // you down instead; and coming down put you inside the flight, at floor
  // level, wedged in three tread colliders.

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

/**
 * The interior a corridor floor uses.
 *
 * All four of them, now: the entrance hall and the corridors above it are one
 * stacked space rather than four scenes built at the origin. The room ids stay
 * distinct because they are `current_room` values, and that is what scopes who
 * you can see and whose projector a screen share lands on.
 */
export function corridorKind(_roomId: number): InteriorKind {
  return 'ufaz-core'
}
