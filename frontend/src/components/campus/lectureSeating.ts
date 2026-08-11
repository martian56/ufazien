import { INTERIOR_SPECS } from './interiorSpecs'

/**
 * The amphitheatre's raked seating, as numbers.
 *
 * In its own module because where the seating ends decides where it is safe to
 * put the player, and the page needs that before it renders anything. The entry
 * point used to be at z 17, which is inside the fourth tier: back faces are
 * culled, so from in there you see straight out and the room looks perfectly
 * normal in a screenshot — but you have walked in embedded in a concrete step.
 */
export const LECTURE_SEATING = {
  frontZ: -4,
  rowDepth: 4.6,
  riser: 0.75,
  rowCount: 6,
}

export const LECTURE_ROWS = [0, 1, 2, 3, 4, 5]

/**
 * The box the tiers occupy, which nothing may spawn inside.
 *
 * The rake is nearly as wide as the room, so checking the depth alone is not
 * enough — a spawn off to one side is still inside a step.
 */
export function lectureSeatingExtent(halfExtent = INTERIOR_SPECS.lecture.halfExtent) {
  const { frontZ, rowDepth, rowCount } = LECTURE_SEATING
  return {
    minZ: frontZ - rowDepth / 2,
    maxZ: frontZ + (rowCount - 1) * rowDepth + rowDepth / 2,
    halfWidth: (halfExtent * 1.85) / 2,
  }
}
