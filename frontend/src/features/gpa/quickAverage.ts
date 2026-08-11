/**
 * The arithmetic behind the library terminal.
 *
 * A pared-down version of what the full calculator page does: credit-weighted
 * average of some 20-point marks, and the UFAZ conversion from that mark to a
 * grade point. Pure and separate so the terminal in the campus can be checked
 * without a canvas, and so the conversion table exists once as data rather
 * than as a table inside an eight-hundred-line page component.
 *
 * This is deliberately not the whole calculator. Somebody who wants to plan a
 * semester should use the real tool; this answers "where am I" while standing
 * in the library.
 */

export interface GradeRow {
  /** Mark out of twenty, as UFAZ awards them. */
  mark: number
  /** Credits the course carries. Zero-credit rows are ignored, not counted. */
  credits: number
}

export interface Band {
  /** Inclusive lower bound of the 20-point mark. */
  min: number
  /** Exclusive upper bound, except for the top band. */
  max: number
  gpa: number
  letter: string
  status: string
}

/**
 * The UFAZ conversion, highest band first.
 *
 * Bands are half-open — `min <= mark < max` — except the top one, which has to
 * include twenty itself or a perfect score falls off the end of the table.
 */
export const UFAZ_BANDS: readonly Band[] = [
  { min: 16, max: 20, gpa: 4.0, letter: 'A+', status: 'Perfect' },
  { min: 13.5, max: 16, gpa: 4.0, letter: 'A', status: 'Excellent' },
  { min: 11.5, max: 13.5, gpa: 3.0, letter: 'B', status: 'Good' },
  { min: 10, max: 11.5, gpa: 2.0, letter: 'C', status: 'Enough' },
  { min: 0, max: 10, gpa: 0.0, letter: 'F', status: 'Fail' },
]

/**
 * The band a 20-point mark falls in.
 *
 * Out-of-range marks are clamped rather than refused: the terminal is a
 * numeric input somebody can type 25 into, and refusing to answer is worse
 * than answering about the top band.
 */
export function bandFor(mark: number): Band {
  if (!Number.isFinite(mark)) return UFAZ_BANDS[UFAZ_BANDS.length - 1]
  const clamped = Math.min(20, Math.max(0, mark))
  // Top band inclusive at both ends, the rest half-open.
  for (const band of UFAZ_BANDS) {
    if (clamped >= band.min && (clamped < band.max || band.max === 20)) return band
  }
  return UFAZ_BANDS[UFAZ_BANDS.length - 1]
}

/**
 * The credit-weighted average of some marks, or null if there are none.
 *
 * Null rather than zero: no courses is not a mark of zero, and showing 0.00
 * to somebody who has typed nothing in reads as a failing grade.
 */
export function weightedAverage(rows: readonly GradeRow[]): number | null {
  let points = 0
  let credits = 0

  for (const row of rows) {
    // A row with no credits carries no weight, and one with a negative or
    // non-finite mark is a half-typed input rather than a grade.
    if (!Number.isFinite(row.mark) || !Number.isFinite(row.credits)) continue
    if (row.credits <= 0) continue
    points += Math.min(20, Math.max(0, row.mark)) * row.credits
    credits += row.credits
  }

  if (credits === 0) return null
  return points / credits
}

/** The grade point for a set of marks, or null when there are none. */
export function gradePointFor(rows: readonly GradeRow[]): number | null {
  const average = weightedAverage(rows)
  return average === null ? null : bandFor(average).gpa
}
