/**
 * Turning a saved calculation back into calculator inputs.
 *
 * The saved-calculation rows used to call a `loadCalculation` that was never
 * written, so clicking one threw a ReferenceError; the rows were then made
 * non-clickable, on the belief that UserGPA stored only a summary.
 *
 * It does not. update_user_gpa writes one CourseGrade per period, carrying the
 * period's name in course_name and its average in ufaz_grade, and the list
 * endpoint serializes them. Everything needed to restore the inputs is already
 * in the response.
 */

export interface SavedCourseGrade {
  course_name?: string | null
  ufaz_grade?: number | string | null
  grade_type?: string | null
}

export interface SavedCalculation {
  id: number
  name: string
  calculation_type: string
  overall_gpa?: number | null
  course_grades?: SavedCourseGrade[] | null
}

export interface AverageRow {
  id: number
  period: string
  average: string
  gradeType: string
}

/** A calculator row is only restorable if it has both a name and a grade. */
export function toAverageRows(calculation: SavedCalculation): AverageRow[] {
  const rows = (calculation.course_grades ?? [])
    .filter((grade) => grade.course_name && grade.ufaz_grade !== null && grade.ufaz_grade !== undefined)
    .map((grade, index) => ({
      id: index + 1,
      period: String(grade.course_name),
      average: String(grade.ufaz_grade),
      gradeType: grade.grade_type || 'ufaz',
    }))

  // The calculator always shows at least one row to type into.
  if (rows.length === 0) {
    return [{ id: 1, period: '', average: '', gradeType: 'ufaz' }]
  }
  return rows
}

/** Which tab a saved calculation belongs in. */
export function tabFor(calculation: SavedCalculation): 'semester' | 'yearly' {
  return calculation.calculation_type === 'yearly' ? 'yearly' : 'semester'
}
