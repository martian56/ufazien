/**
 * The loose objects on the campus, and what happens when you throw one.
 *
 * Everything else in the world is scenery or furniture: fixed where the layout
 * puts it. These are the things that move because somebody moved them, which
 * makes them the only part of the campus that carries a history.
 *
 * Pure and data-only, so the arc can be tested without a canvas and the
 * positions without a socket.
 */

import type { InteriorKind } from './campusLayout'

export interface PropSpec {
  /** Stable id. The server stores this, so it must not change between builds. */
  id: string
  /** What it is, which is all the renderer needs to pick a mesh. */
  kind: 'ball' | 'book' | 'cup' | 'frisbee'
  label: string
  /** Where it starts, in world coordinates, before anybody has touched it. */
  home: [number, number]
  /**
   * The room it belongs to, or null for the open campus.
   *
   * A prop cannot leave its room: the throw is bounded on the server, and the
   * client only ever draws the props whose room matches the one you are in.
   */
  room: InteriorKind | null
  /** Radius, for the collider and the mesh. */
  radius: number
}

/**
 * How high above the floor a carried object rides.
 *
 * At the height of a held hand rather than the head: an object at eye level
 * hides the thing the player is walking towards.
 */
export const CARRY_HEIGHT = 1.05

/** How far a player can reach to pick something up. */
export const REACH = 1.8

/** The furthest a throw travels, in world units. Mirrors the server's clamp. */
export const MAX_THROW = 25

/** How long a thrown object is in the air, in seconds. */
export const THROW_SECONDS = 0.9

/** Peak height of the arc above the launch point, in world units. */
export const THROW_ARC = 2.2

export const CAMPUS_PROPS: readonly PropSpec[] = [
  // Outdoors.
  { id: 'ball-court', kind: 'ball', label: 'basketball', home: [26, -34], room: null, radius: 0.24 },
  { id: 'frisbee-quad', kind: 'frisbee', label: 'frisbee', home: [-6, 12], room: null, radius: 0.28 },
  // Indoors, one per room that has somewhere sensible to leave it.
  { id: 'ball-sports', kind: 'ball', label: 'basketball', home: [6, 14], room: 'sports', radius: 0.24 },
  { id: 'book-library', kind: 'book', label: 'library book', home: [-4, 6], room: 'library', radius: 0.2 },
  { id: 'cup-cafeteria', kind: 'cup', label: 'coffee cup', home: [4, 8], room: 'cafeteria', radius: 0.16 },
  { id: 'cup-centre', kind: 'cup', label: 'paper cup', home: [-5, 9], room: 'student-center', radius: 0.16 },
]

const BY_ID = new Map(CAMPUS_PROPS.map((prop) => [prop.id, prop]))

export function propById(id: string | null | undefined): PropSpec | null {
  if (!id) return null
  // A Map rather than an object literal, so an id of `constructor` is a miss
  // rather than a function.
  return BY_ID.get(id) ?? null
}

/** The props that belong in a given room, or outdoors when the kind is null. */
export function propsIn(room: InteriorKind | null): PropSpec[] {
  return CAMPUS_PROPS.filter((prop) => prop.room === room)
}

/**
 * The nearest object within reach, if any.
 *
 * `held` is every prop already in somebody's hands, which are not lying
 * anywhere to be picked up.
 */
export function nearestProp(
  x: number,
  z: number,
  props: readonly PropSpec[],
  positions: ReadonlyMap<string, { x: number; z: number }>,
  held: ReadonlySet<string> = new Set(),
  reach = REACH,
): PropSpec | null {
  let best: PropSpec | null = null
  let bestDistance = reach

  for (const prop of props) {
    if (held.has(prop.id)) continue
    const at = positions.get(prop.id) ?? { x: prop.home[0], z: prop.home[1] }
    const distance = Math.hypot(x - at.x, z - at.z)
    if (distance <= bestDistance) {
      best = prop
      bestDistance = distance
    }
  }

  return best
}

/**
 * Where a throw lands.
 *
 * Clamped to `MAX_THROW`, which the server also enforces — doing it here as
 * well is not redundant, it is what stops the client drawing an arc to a place
 * the server will refuse and then snapping the object back.
 */
export function throwTarget(
  x: number,
  z: number,
  heading: number,
  power: number,
): { x: number; z: number } {
  const distance = MAX_THROW * Math.min(1, Math.max(0, power))
  return {
    x: x + Math.sin(heading) * distance,
    z: z + Math.cos(heading) * distance,
  }
}

/**
 * A point on the flight path, for drawing the object while it is in the air.
 *
 * `t` runs 0 to 1. The height is a parabola that starts and ends at the launch
 * and landing heights, so the object neither pops to the floor on release nor
 * hangs above it on arrival.
 */
export function throwArc(
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
  t: number,
): { x: number; y: number; z: number } {
  const clamped = Math.min(1, Math.max(0, t))
  const lift = 4 * THROW_ARC * clamped * (1 - clamped)
  return {
    x: from.x + (to.x - from.x) * clamped,
    y: from.y + (to.y - from.y) * clamped + lift,
    z: from.z + (to.z - from.z) * clamped,
  }
}
