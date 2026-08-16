/**
 * What is solid, and how high the ground is under you.
 *
 * The campus used to be rigid at exactly two things: the seven buildings and
 * the street terrace. Everything else drawn on it — a hundred and fifty trees,
 * forty-six lamp posts, the fountain, and every table, chair and shelf indoors
 * — was scenery you walked straight through, and the amphitheatre's six raised
 * tiers passed through the player's head on the way to the screen.
 *
 * This module is the collision layer those things needed. It is pure and has no
 * WebGL in it, so the whole of it is testable: `campusPhysics.test.ts` covers
 * the resolver, the height field and the sightline check.
 *
 * Three shapes, because a campus is not made of axis-aligned boxes:
 *
 * - **Boxes** for walls, tables and shelves. Optionally rotated, because a
 *   bench on a circular quad and a chair pushed under a desk at an angle are
 *   both normal and neither is axis-aligned.
 * - **Circles** for tree trunks, lamp posts and the fountain. Approximating a
 *   round fountain with a square leaves you bumping into nothing at the
 *   corners, which reads as a bug rather than as a fountain.
 * - **Platforms**, which are boxes with a height. They are what you stand on
 *   rather than what stops you.
 */

import type { Rect } from './campusLayout'
import {
  BENCH_HALF,
  CAMPUS_COLLIDERS,
  FOUNTAIN_RADIUS,
  LAMP_RADIUS,
  PLAYER_RADIUS,
  QUAD_CENTRE,
  TRUNK_RADIUS,
  campusBenches,
  campusLamps,
  campusTrees,
} from './campusLayout'

/**
 * How tall a collider is, when it is not said.
 *
 * Walls and buildings, so that anything which forgets to declare a height
 * blocks the view rather than silently failing to. A sightline test that passes
 * because an obstruction was assumed to be knee-high is worse than no test.
 */
export const DEFAULT_COLLIDER_HEIGHT = 20

/** A round footprint: tree trunks, lamp posts, bins, the fountain. */
export interface Circle {
  x: number
  z: number
  radius: number
  /**
   * Top of the object, in metres above the floor of the room.
   *
   * Used for sightlines, and now for deciding whether the player is level with
   * it at all — see `collidersAt`. A building with four floors in one room
   * cannot have its furniture stop people on every one of them.
   */
  height?: number
  /**
   * Bottom of the object. Absent means it stands on the ground.
   *
   * A bench in a second-floor window bay has `base` at that floor's level, so
   * somebody in the entrance hall directly below walks past where it is.
   */
  base?: number
  /**
   * Names the object, when a seat needs to refer to it. A sofa's seat is on
   * the sofa, so "inside its own furniture" has to be distinguishable from
   * "inside a vending machine".
   */
  id?: string
}

/**
 * A box footprint that may be turned.
 *
 * `Rect` from the layout module is the un-rotated case and is assignable to
 * this, which is why the campus colliders did not have to be rewritten.
 */
export interface Box extends Rect {
  /** Rotation about Y, in radians. Absent means axis-aligned. */
  ry?: number
  /** Top of the object. See `Circle.height`. */
  height?: number
  /** Bottom of the object. See `Circle.base`. */
  base?: number
  /** Names the object, for seats that sit on it. See `Circle.id`. */
  id?: string
}

export type Collider = Box | Circle

export function isCircle(collider: Collider): collider is Circle {
  return (collider as Circle).radius !== undefined
}

/**
 * Pushes a position out of one box, resolving along whichever axis is least
 * deep so that a wall is something you slide along rather than stop dead at.
 *
 * A turned box is resolved in its own space: rotate the offset in, resolve as
 * if axis-aligned, rotate the correction back out. Doing it any other way means
 * either an axis-aligned approximation — a bench with corners sticking out of
 * its own collider — or a full SAT implementation for no gain at this scale.
 */
function pushOutOfBox(px: number, pz: number, box: Box, radius: number) {
  const dx = px - box.x
  const dz = pz - box.z
  const angle = box.ry ?? 0

  // Into the box's own frame, where it is axis-aligned again.
  let localX = dx
  let localZ = dz
  if (angle !== 0) {
    const cos = Math.cos(-angle)
    const sin = Math.sin(-angle)
    localX = dx * cos - dz * sin
    localZ = dx * sin + dz * cos
  }

  const overlapX = box.halfW + radius - Math.abs(localX)
  const overlapZ = box.halfD + radius - Math.abs(localZ)
  if (overlapX <= 0 || overlapZ <= 0) return null

  // Out along the shallower axis, which is what lets you slide along a wall.
  let correctionX = 0
  let correctionZ = 0
  if (overlapX < overlapZ) {
    correctionX = localX >= 0 ? overlapX : -overlapX
  } else {
    correctionZ = localZ >= 0 ? overlapZ : -overlapZ
  }

  // And back out to world space.
  if (angle !== 0) {
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    return {
      x: px + correctionX * cos - correctionZ * sin,
      z: pz + correctionX * sin + correctionZ * cos,
    }
  }
  return { x: px + correctionX, z: pz + correctionZ }
}

/**
 * Pushes a position out of one circle, along the line from its centre.
 *
 * A player standing exactly on the centre has no direction to be pushed in, and
 * normalising a zero-length vector gives NaN, which propagates into the camera
 * and ends the session. Pushed north arbitrarily instead.
 */
function pushOutOfCircle(px: number, pz: number, circle: Circle, radius: number) {
  const dx = px - circle.x
  const dz = pz - circle.z
  const reach = circle.radius + radius
  const distanceSq = dx * dx + dz * dz
  if (distanceSq >= reach * reach) return null

  const distance = Math.sqrt(distanceSq)
  if (distance < 1e-6) return { x: circle.x, z: circle.z - reach }

  const scale = reach / distance
  return { x: circle.x + dx * scale, z: circle.z + dz * scale }
}

/**
 * Pushes a position out of everything solid it has ended up inside.
 *
 * Several passes, because one is not enough: pushing clear of a table can land
 * you inside the chair tucked under it, and a single pass would leave you
 * standing in the chair. Each pass resolves what the last one created, and the
 * cap means a position wedged somewhere genuinely impossible returns rather
 * than looping forever.
 */
export function resolveColliders(
  x: number,
  z: number,
  colliders: Collider[],
  radius = PLAYER_RADIUS,
  passes = 4,
): { x: number; z: number } {
  let px = x
  let pz = z

  for (let pass = 0; pass < passes; pass++) {
    let moved = false

    for (const collider of colliders) {
      const resolved = isCircle(collider)
        ? pushOutOfCircle(px, pz, collider, radius)
        : pushOutOfBox(px, pz, collider, radius)
      if (!resolved) continue
      px = resolved.x
      pz = resolved.z
      moved = true
    }

    if (!moved) break
  }

  return { x: px, z: pz }
}

/** Whether a point is inside a collider, with an optional margin around it. */
/**
 * One step towards a point, stopping short of it.
 *
 * Used for following somebody. Returns null when there is nothing to do, which
 * is either already being close enough or being exactly on top of the target —
 * the second matters because the direction is undefined there, and normalising
 * a zero vector produces NaN and sends the follower off the campus.
 */
export function approachStep(
  from: { x: number; z: number },
  to: { x: number; z: number },
  stride: number,
  stopAt: number,
): { x: number; z: number } | null {
  const dx = to.x - from.x
  const dz = to.z - from.z
  const gap = Math.hypot(dx, dz)
  if (gap <= stopAt || gap === 0) return null

  // Capped at the remaining gap, so arriving is standing next to somebody
  // rather than overshooting and turning round to come back.
  const step = Math.min(stride, gap - stopAt)
  return { x: (dx / gap) * step, z: (dz / gap) * step }
}

/**
 * How far behind a player a wall may be and still be leanable.
 *
 * Measured from the centre of the player, so it has to clear the player's own
 * radius before it reaches anything: `PLAYER_RADIUS` is 0.45, and this leaves
 * about half a metre of gap you can still lean across. Any further and you
 * lean on thin air a pace from the wall.
 */
export const LEAN_REACH = 0.95

/**
 * Whether there is something to lean against behind this player.
 *
 * `heading` is the avatar convention: zero faces +Z, and the wall wanted is the
 * one at the player's back, so the sample goes the other way.
 *
 * `roomLimit` is the half-extent of the interior the player is standing in, if
 * any. Interior walls are a clamp on the camera rather than colliders, so a
 * check that only consulted the collider list would refuse to let anybody lean
 * on the actual walls of a room — the one surface every room is guaranteed to
 * have.
 */
export function leanSurface(
  x: number,
  z: number,
  heading: number,
  colliders: readonly Collider[],
  roomLimit?: number,
): boolean {
  const behindX = x - Math.sin(heading) * LEAN_REACH
  const behindZ = z - Math.cos(heading) * LEAN_REACH

  if (roomLimit !== undefined) {
    if (Math.abs(behindX) >= roomLimit || Math.abs(behindZ) >= roomLimit) return true
  }

  return colliders.some((collider) => insideCollider(behindX, behindZ, collider))
}

export function insideCollider(x: number, z: number, collider: Collider, margin = 0): boolean {
  if (isCircle(collider)) {
    const reach = collider.radius + margin
    return (x - collider.x) ** 2 + (z - collider.z) ** 2 <= reach * reach
  }

  let dx = x - collider.x
  let dz = z - collider.z
  const angle = collider.ry ?? 0
  if (angle !== 0) {
    const cos = Math.cos(-angle)
    const sin = Math.sin(-angle)
    const rx = dx * cos - dz * sin
    const rz = dx * sin + dz * cos
    dx = rx
    dz = rz
  }
  return Math.abs(dx) <= collider.halfW + margin && Math.abs(dz) <= collider.halfD + margin
}

/**
 * The props, as colliders.
 *
 * Built from the same lists the scenery draws from, so a tree cannot be solid
 * in one place and drawn in another. Computed once at module load: the scatter
 * is seeded and the lamps and benches are fixed, so none of it can change.
 *
 * Tree canopies are deliberately not included. You walk under a canopy; the
 * trunk is the part you walk into.
 */
export const PROP_COLLIDERS: Collider[] = [
  ...campusTrees().map((tree) => ({ x: tree.x, z: tree.z, radius: TRUNK_RADIUS * tree.scale })),
  ...campusLamps().map((lamp) => ({ x: lamp.x, z: lamp.z, radius: LAMP_RADIUS })),
  ...campusBenches().map((bench) => ({
    x: bench.x,
    z: bench.z,
    ry: bench.ry,
    ...BENCH_HALF,
  })),
  // The fountain, as the round thing it is. Squared off, you bumped into
  // nothing at its corners and walked through the water at its edges.
  { x: QUAD_CENTRE[0], z: QUAD_CENTRE[1], radius: FOUNTAIN_RADIUS },
]

/**
 * Everything solid outdoors: the buildings, the street, and now the props.
 */
export const SOLID_CAMPUS: Collider[] = [...CAMPUS_COLLIDERS, ...PROP_COLLIDERS]

/**
 * A surface you can stand on: a lecture tier, a stage, a step.
 *
 * `top` is the height of the walking surface, not of the object. A 0.45 m step
 * has `top: 0.45`.
 */
export interface Platform extends Box {
  top: number
  /**
   * Whether there is open space beneath this surface.
   *
   * A tier in the amphitheatre is a solid block of concrete: from the floor in
   * front of it, its edge stops you however high it is, and that is right.
   * A staircase landing is not — you walk under it — and neither is the floor
   * of the storey above you, which is the whole difficulty in ever putting two
   * of them in one room.
   *
   * Defaults to solid, because everything that existed before this was.
   */
  walkUnder?: boolean
}

/**
 * How much clear air a player needs above their feet to walk under something.
 *
 * Two metres, which is a door. Below it a surface is something you duck into
 * rather than pass beneath, so the bottom few treads of a flight still stop
 * you — there genuinely is no room under them — while the upper flight and the
 * landing four and a half metres up open out.
 */
export const HEADROOM = 2

/**
 * How high you can rise onto a surface without jumping.
 *
 * Generous enough for the amphitheatre's 0.75 m risers, which are steep for a
 * step but are what makes the rake read from the back row. Below this you walk
 * up; above it the platform's own footprint stops you, so a stage edge is a
 * wall rather than a ramp.
 */
export const STEP_UP = 0.8

/**
 * The height of the floor under a position.
 *
 * Only surfaces within stepping distance of where the player's feet already are
 * count. Without that check, walking under a balcony would snap you up onto it,
 * and standing beside a stage would put you on top of it.
 */
export function groundHeight(
  x: number,
  z: number,
  platforms: Platform[],
  feet = 0,
  stepUp = STEP_UP,
): number {
  let height = 0

  for (const platform of platforms) {
    if (platform.top <= height) continue
    if (platform.top > feet + stepUp) continue
    if (!insideCollider(x, z, platform)) continue
    height = platform.top
  }

  return height
}

/**
 * The platforms a player cannot step onto from where they are, as walls.
 *
 * A stage is not a ramp: from the floor its edge should stop you, and from on
 * top of it you should be able to walk about freely. So the same box is solid
 * or not depending on where your feet are, which is why this is a function of
 * the player rather than a fixed list.
 *
 * ## Why height alone is not enough
 *
 * This used to be the whole rule, and it has no notion of how *far* above you
 * a surface is. The staircase in the entrance hall is fifteen platforms, and
 * from the floor thirteen of them are walls — including a landing four and a
 * half metres up, under a nine-metre ceiling, on a flight drawn with iron
 * balusters you can see straight through. Eighty-four square metres of a
 * 44 x 44 m room were fenced off behind nothing.
 *
 * It is also what stopped the campus ever having two floors in one room: put a
 * slab 4.55 m above another one and the upper slab becomes a wall across the
 * entire plan, and the resolver ejects the player out of the building through
 * its own ceiling.
 *
 * So a surface that says there is space beneath it stops blocking once it is
 * clear of the player's head. Everything else keeps the old rule, because a
 * tier really is a solid block and its edge really should stop you.
 */
/**
 * The colliders a player at this height can actually walk into.
 *
 * A `Collider` used to be a plan shape and nothing else: whatever its declared
 * height, it stopped you at every height. That was harmless while a room had
 * one floor, and became the reason a room could not have four — a bench in a
 * second-floor window bay stops somebody standing in the entrance hall
 * directly below it, and a rail round a stairwell on the top floor rails the
 * ground floor too.
 *
 * So a collider now has a vertical extent, and blocks only when it overlaps
 * the player's own. Anything that does not say otherwise stands on the ground
 * and is twenty metres tall, which is what everything outdoors and every wall
 * already assumed — so nothing that existed before this changes.
 */
export function collidersAt(
  colliders: readonly Collider[],
  feet: number,
  bodyHeight = HEADROOM,
): Collider[] {
  return colliders.filter((collider) => {
    const base = collider.base ?? 0
    const top = collider.height ?? DEFAULT_COLLIDER_HEIGHT
    // Touching at exactly the feet does not count: that is a floor, not a wall,
    // and a kerb you are standing on top of should not also stop you.
    return top > feet + 1e-6 && base < feet + bodyHeight
  })
}

export function blockingPlatforms(
  platforms: Platform[],
  feet: number,
  stepUp = STEP_UP,
  headroom = HEADROOM,
): Box[] {
  return platforms.filter((platform) => {
    if (platform.top <= feet + stepUp) return false
    return !platform.walkUnder || platform.top < feet + headroom
  })
}

/**
 * How close to the board a sightline stops caring.
 *
 * The screen hangs off a wall with a casing above it and a backing board
 * behind, all of which sit within touching distance of the picture. Counting
 * them as obstructions would mean no screen in any room could ever be visible.
 */
export const SCREEN_MOUNT_MARGIN = 0.8

/** A point in the room: where an eye is, or the middle of a screen. */
export interface Point3 {
  x: number
  y: number
  z: number
}

/**
 * Whether anything stands between a viewer and the board they are watching.
 *
 * A projector screen half the room cannot see is worse than no projector, and
 * it is not something a screenshot taken from the front of the room will ever
 * show. Five of the seven interiors had one: the entrance hall's staircase ran
 * up the middle of the screen wall, the library's stacks were five point eight
 * metres of shelving between every reading table and the board, the laboratory
 * parked four fume cupboards across it, the student centre two vending
 * machines, and the sports hall hung its scoreboard over the top of the picture.
 *
 * Height matters, which is the whole reason colliders carry one. A dining table
 * stands between a seat and the screen on the floor plan and obscures nothing;
 * a bookcase at the same spot hides it completely. So this walks the line in
 * three dimensions and only counts an obstruction that is actually tall enough
 * to reach it.
 *
 * Sampled rather than solved: the colliders are a mix of turned boxes and
 * circles, and a sample every quarter metre is finer than the narrowest thing
 * on the campus.
 */
export function sightlineBlocker(
  from: Point3,
  to: Point3,
  colliders: Collider[],
  step = 0.25,
  endMargin = SCREEN_MOUNT_MARGIN,
): Collider | null {
  const dx = to.x - from.x
  const dz = to.z - from.z
  const distance = Math.hypot(dx, dz)
  if (distance < 1e-6) return null

  // Stop short of the board. The last half-metre in front of a screen is its
  // own frame, casing and backing panel, and reporting those as obstructions
  // would mean no screen anywhere could ever be visible.
  const reach = Math.max(0, distance - endMargin)
  if (reach < 1e-6) return null

  const steps = Math.ceil(reach / step)
  for (let i = 1; i <= steps; i++) {
    const t = (i / steps) * (reach / distance)
    const x = from.x + dx * t
    const z = from.z + dz * t
    // How high the line of sight is at this point along it.
    const sightY = from.y + (to.y - from.y) * t

    for (const collider of colliders) {
      const top = collider.height ?? DEFAULT_COLLIDER_HEIGHT
      if (top <= sightY) continue
      if (insideCollider(x, z, collider)) return collider
    }
  }

  return null
}
