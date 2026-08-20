/**
 * Doors that are shut until you open them.
 *
 * Walking through a doorway used to need nothing: the opening was a hole in
 * the facade and crossing it swapped the scene. That is better than the
 * proximity teleport it replaced, but a hole is not a door — there was nothing
 * to open, nothing to hear close behind you, and from inside a room the way
 * out was an invisible line on the floor.
 *
 * So a door is shut by default and fills its own opening while it is. Opening
 * one is deliberate, it swings, and it closes itself a few seconds later,
 * which is what makes walking through feel like going somewhere rather than
 * crossing a threshold that happened to be there.
 *
 * Pure, and keyed by door id rather than holding meshes, so the rules can be
 * tested without a canvas: what is in reach, what is open, what has timed out.
 */

import { CAMPUS_DOORS, type Doorway } from './campusLayout'
import type { Rect } from './campusLayout'

/** How long a door stays open before it swings shut on its own. */
export const DOOR_OPEN_MS = 4000

/**
 * How close you have to be to work the handle.
 *
 * Measured from the centre of the opening. Generous enough that standing in
 * the alcove always counts, tight enough that you cannot open a door from
 * across the quad, which was the whole complaint about the old proximity key.
 */
export const DOOR_REACH = 3.2

/** Thickness of the closed leaf, as a collider. */
export const DOOR_LEAF_DEPTH = 0.35

/** How far the leaf swings, in radians. A quarter turn reads as fully open. */
export const DOOR_SWING = Math.PI / 2

/**
 * Which doors are open, and when each was opened.
 *
 * A plain record rather than a Set so the closing time travels with the entry:
 * a door opened at different moments has to close at different moments, and
 * the renderer needs the age to animate the swing.
 */
export type DoorState = Readonly<Record<string, number>>

/** The id used for the door on the inside of a room. */
/**
 * The open-and-shut state of one interior door.
 *
 * Keyed by the door as well as the building, because a room may have more than
 * one: the amphitheatre has two, either side of its board. Keyed by building
 * alone they shared a state, so opening one swung both and walking at the shut
 * one let you through it.
 *
 * `0` by default, which is every room with a single door.
 */
export function interiorDoorId(buildingId: number | string, door = 0): string {
  return `interior:${buildingId}:${door}`
}

/** The id used for a door on the campus facade. */
export function exteriorDoorId(buildingId: number | string): string {
  return `exterior:${buildingId}`
}

/**
 * The nearest door within arm's reach, or null.
 *
 * Nearest rather than first, so standing between two doors opens the one you
 * are actually facing rather than whichever happens to come first in the list.
 */
export function doorWithinReach(
  x: number,
  z: number,
  doors: readonly Doorway[] = CAMPUS_DOORS,
  reach: number = DOOR_REACH,
): Doorway | null {
  let best: Doorway | null = null
  let bestDistance = reach * reach
  for (const door of doors) {
    const dx = x - door.x
    const dz = z - door.z
    const distance = dx * dx + dz * dz
    if (distance <= bestDistance) {
      best = door
      bestDistance = distance
    }
  }
  return best
}

/** Whether a door is open at this moment. */
export function isDoorOpen(state: DoorState, id: string, now: number): boolean {
  const openedAt = state[id]
  return openedAt !== undefined && now - openedAt < DOOR_OPEN_MS
}

/** Open a door, or restart its timer if it is already open. */
export function openDoor(state: DoorState, id: string, now: number): DoorState {
  return { ...state, [id]: now }
}

/**
 * Drop doors whose time is up.
 *
 * Returns the same object when nothing expired, so a caller holding this in
 * React state can skip the re-render rather than churning every frame.
 */
export function pruneDoors(state: DoorState, now: number): DoorState {
  const live: Record<string, number> = {}
  let changed = false
  for (const [id, openedAt] of Object.entries(state)) {
    if (now - openedAt < DOOR_OPEN_MS) live[id] = openedAt
    else changed = true
  }
  return changed ? live : state
}

/**
 * How far a door has swung, from 0 shut to 1 fully open.
 *
 * Eased at both ends: a door that starts and stops abruptly reads as a panel
 * being teleported rather than something with weight. The last fifth of the
 * open period is the swing back, so it is visibly closing before it blocks.
 */
export function doorSwing(state: DoorState, id: string, now: number): number {
  const openedAt = state[id]
  if (openedAt === undefined) return 0
  const age = now - openedAt
  if (age < 0 || age >= DOOR_OPEN_MS) return 0

  const OPENING = 420
  const CLOSING = 520
  if (age < OPENING) return ease(age / OPENING)
  if (age > DOOR_OPEN_MS - CLOSING) return ease((DOOR_OPEN_MS - age) / CLOSING)
  return 1
}

function ease(t: number): number {
  const clamped = Math.min(1, Math.max(0, t))
  return clamped * clamped * (3 - 2 * clamped)
}

/**
 * Colliders for every door that is currently shut.
 *
 * This is what makes the key matter. Without it the leaf would be scenery you
 * could walk straight through, and opening a door would be decoration.
 */
export function closedDoorColliders(
  state: DoorState,
  now: number,
  doors: readonly Doorway[] = CAMPUS_DOORS,
): Rect[] {
  const shut: Rect[] = []
  for (const door of doors) {
    if (isDoorOpen(state, exteriorDoorId(door.id), now)) continue
    shut.push({ x: door.x, z: door.z, halfW: door.halfW, halfD: DOOR_LEAF_DEPTH / 2 })
  }
  return shut
}
