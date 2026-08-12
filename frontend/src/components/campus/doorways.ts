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
  /** The wall it is in, as a +Z boundary. */
  z: number
  halfW: number
}

/**
 * The door on the inside, in room coordinates.
 *
 * On the +Z wall of every room, opposite the projector — which is where the
 * spawn already put the player, so walking in and turning round has always led
 * back this way.
 *
 * In the wall itself, not at the clamp. The clamp stands a metre and a half
 * short of the wall so that nobody presses their eye against it, and putting
 * the door there left a pair of leaves standing free in the middle of the
 * room with a blank wall behind them — attached to nothing, opening onto
 * nothing, and in the library growing out of the issue desk.
 */
export function interiorDoorFor(kind: InteriorKind | undefined): InteriorDoor {
  const spec = kind ? INTERIOR_SPECS[kind] : INTERIOR_SPECS.lecture
  return { x: 0, z: spec.halfExtent, halfW: DOOR_HALF_WIDTH }
}

/**
 * How far the player may walk towards the wall at a given point.
 *
 * The room's boundary, except in the doorway — where the clamp opens out to
 * the wall itself so the player can walk into the opening rather than being
 * stopped in front of it by an invisible line.
 */
export function interiorLimit(
  kind: InteriorKind | undefined,
  x: number,
  z: number,
): number {
  const door = interiorDoorFor(kind)
  const inDoorway = z > 0 && Math.abs(x - door.x) <= door.halfW
  return inDoorway ? door.z : interiorHalfExtent(kind)
}

/**
 * Whether a player standing here is walking out of the room.
 *
 * The interior boundary is a clamp rather than geometry, so this has to be
 * asked *before* the clamp is applied: afterwards the position has already
 * been pulled back inside and there is nothing left to detect.
 */
export function leavingThroughDoor(x: number, z: number, door: InteriorDoor): boolean {
  return z >= door.z && Math.abs(x - door.x) <= door.halfW
}
