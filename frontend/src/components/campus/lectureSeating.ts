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

/** Derived, so the tiers drawn and the extent asserted can never disagree. */
export const LECTURE_ROWS = Array.from({ length: LECTURE_SEATING.rowCount }, (_, i) => i)

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

/**
 * How far the boards on the amphitheatre's front wall reach from its centre.
 *
 * The whiteboard is 7.5 wide at x −13 and the schedule board 7 wide at +13, so
 * between them they occupy the wall out to ±16.75. The doors in that wall have
 * to start beyond this, and they are placed from it rather than from a number
 * that happens to look right — a door cut through a whiteboard is what happens
 * when those two are stated separately.
 */
export const LECTURE_BOARD_REACH = 16.75
