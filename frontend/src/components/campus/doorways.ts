/**
 * Doors you walk through.
 *
 * Entering a building used to be a proximity teleport: stand anywhere within
 * nine metres of a fifty-metre facade, press E, and the world was replaced.
 * You never went through anything, and the building had no door — pressing the
 * key with your back to the wall worked exactly as well as standing at the
 * entrance.
 *
 * What makes a door a door is that the wall has a hole in it and the hole is
 * the only way in. So the building's collider is no longer one box: it is two
 * piers and a back wall, leaving an alcove you can physically walk into. The
 * scene swaps when you cross the face of the building, which you can only
 * reach from inside the opening.
 *
 * Pure, so both halves of the transition can be tested without a canvas.
 */

import {
  ALCOVE_DEPTH,
  CAMPUS_DOORS,
  DOOR_HALF_WIDTH,
  buildingCollidersWithDoor,
  doorwayFor,
  type Doorway,
} from './campusLayout'
import type { InteriorKind } from './campusLayout'
import { INTERIOR_SPECS, interiorHalfExtent } from './interiorSpecs'
import { LECTURE_BOARD_REACH } from './lectureSeating'

/**
 * The facade geometry lives in `campusLayout`, which is the root of this
 * module graph and imports nothing — the collider list is built there at load
 * time, so the decomposition has to be reachable without depending on the
 * rooms. Re-exported here so that everything about doors can still be read in
 * one place.
 */
export {
  ALCOVE_DEPTH,
  CAMPUS_DOORS,
  DOOR_HALF_WIDTH,
  buildingCollidersWithDoor,
  doorwayFor,
  type Doorway,
}

/** How far outside the door a player is put when they walk back out. */
export const DOORSTEP_CLEARANCE = 1.6

/**
 * Whether this step took the player through a door, and which one.
 *
 * Compares the step against the face of the building rather than testing the
 * end position, so a frame long enough to cross the whole alcove still counts
 * as going inside instead of stopping against the back wall.
 */
export function doorCrossed(
  from: { x: number; z: number },
  to: { x: number; z: number },
  doors: readonly Doorway[] = CAMPUS_DOORS,
): Doorway | null {
  for (const door of doors) {
    // Moving inwards is moving to smaller z: the doors are on the +Z face.
    if (from.z < door.z || to.z >= door.z) continue
    // Where the path crosses the plane, which is the point that has to be
    // inside the opening — not where the step happened to end.
    const t = (from.z - door.z) / (from.z - to.z)
    const crossingX = from.x + (to.x - from.x) * t
    if (Math.abs(crossingX - door.x) <= door.halfW) return door
  }
  return null
}

/** Where a player stands when they come back out of a door. */
export function doorstep(door: Doorway): { x: number; z: number } {
  return { x: door.x, z: door.z + DOORSTEP_CLEARANCE }
}

export interface InteriorDoor {
  /** Centre of the opening in room space. */
  x: number
  /** The wall it is in, as a z coordinate. */
  z: number
  halfW: number
  /**
   * Which way you walk to leave: `1` out through the +Z wall, `-1` the −Z one.
   *
   * Every room but the amphitheatre puts its door on +Z, so this was implicit
   * for a long time. It is not any more — see `interiorDoors`.
   */
  facing: 1 | -1
}

/**
 * The doors on the inside, in room coordinates.
 *
 * On the +Z wall of most rooms, opposite the projector — which is where the
 * spawn already put the player, so walking in and turning round has always led
 * back this way.
 *
 * **The amphitheatre is the exception, and has to be.** Its seating is raked,
 * rising towards +Z, so a door in that wall comes out behind and under the top
 * tier: from the floor you cannot see it, and getting to it means climbing the
 * seating. It has two instead, either side of the board on the −Z wall, which
 * is where a lecture theatre's doors are and is the only part of that room with
 * clear floor in front of it.
 *
 * In the wall itself, not at the clamp. The clamp stands a metre and a half
 * short of the wall so that nobody presses their eye against it, and putting a
 * door there left a pair of leaves standing free in the middle of the room with
 * a blank wall behind them — attached to nothing, opening onto nothing, and in
 * the library growing out of the issue desk.
 *
 * All of a room's doors share one wall. Nothing needs them not to, and the
 * wall-building and the clamp are both simpler for being able to assume it.
 */
export function interiorDoors(kind: InteriorKind | undefined): InteriorDoor[] {
  const spec = kind ? INTERIOR_SPECS[kind] : INTERIOR_SPECS.lecture

  if (kind === 'lecture') {
    // Hard against the corners, because the middle of that wall is boards: a
    // whiteboard one side, the timetable the other, and the projection band
    // between them. Placed from how far those reach rather than from a
    // fraction of the room, so moving a board moves the door.
    const clear = LECTURE_BOARD_REACH + DOOR_HALF_WIDTH + 0.7
    return [-1, 1].map((side) => ({
      x: side * clear,
      z: -spec.halfExtent,
      halfW: DOOR_HALF_WIDTH,
      facing: -1 as const,
    }))
  }

  return [{ x: 0, z: spec.halfExtent, halfW: DOOR_HALF_WIDTH, facing: 1 as const }]
}

/**
 * The door a room is entered and left by when only one will do — aiming the
 * camera on the way in, and naming the door for the open-and-shut state.
 */
export function interiorDoorFor(kind: InteriorKind | undefined): InteriorDoor {
  return interiorDoors(kind)[0]
}

/** Which wall the doors are in: `1` for +Z, `-1` for −Z. */
export function interiorDoorFacing(kind: InteriorKind | undefined): 1 | -1 {
  return interiorDoors(kind)[0].facing
}

/**
 * How far the player may walk in z at a given x.
 *
 * The room's boundary, except in a doorway — where the clamp opens out to the
 * wall itself so the player can walk into the opening rather than being stopped
 * in front of it by an invisible line.
 *
 * Both ends, because the doors are not always at the +Z end. Returning one
 * number worked while every room's door was on the same wall and cost a
 * silently unreachable door the moment one was not.
 */
export function interiorBounds(
  kind: InteriorKind | undefined,
  x: number,
): { minZ: number; maxZ: number } {
  const half = interiorHalfExtent(kind)
  let minZ = -half
  let maxZ = half

  for (const door of interiorDoors(kind)) {
    if (Math.abs(x - door.x) > door.halfW) continue
    if (door.facing === 1) maxZ = Math.max(maxZ, door.z)
    else minZ = Math.min(minZ, door.z)
  }

  return { minZ, maxZ }
}

/**
 * Whether a player standing here is walking out of the room.
 *
 * The interior boundary is a clamp rather than geometry, so this has to be
 * asked *before* the clamp is applied: afterwards the position has already
 * been pulled back inside and there is nothing left to detect.
 */
export function leavingThroughDoor(x: number, z: number, door: InteriorDoor): boolean {
  const past = door.facing === 1 ? z >= door.z : z <= door.z
  return past && Math.abs(x - door.x) <= door.halfW
}

/** The door a player at this point is walking out through, if any. */
export function leavingThroughAny(
  kind: InteriorKind | undefined,
  x: number,
  z: number,
): InteriorDoor | null {
  return interiorDoors(kind).find((door) => leavingThroughDoor(x, z, door)) ?? null
}
