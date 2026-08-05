import { describe, expect, it } from 'vitest'
import { tabFor, toAverageRows } from './loadCalculation'

describe('toAverageRows', () => {
  it('restores each period as a calculator row', () => {
    const rows = toAverageRows({
      id: 1,
      name: 'Auto-saved Semester GPA',
      calculation_type: 'semester',
      course_grades: [
        { course_name: 'Semester 1', ufaz_grade: 15.5, grade_type: 'ufaz' },
        { course_name: 'Semester 2', ufaz_grade: 17, grade_type: 'ufaz' },
      ],
    })

    expect(rows).toEqual([
      { id: 1, period: 'Semester 1', average: '15.5', gradeType: 'ufaz' },
      { id: 2, period: 'Semester 2', average: '17', gradeType: 'ufaz' },
    ])
  })

  it('gives back one empty row when there is nothing to restore', () => {
    // The calculator always needs a row to type into.
    expect(toAverageRows({ id: 1, name: 'x', calculation_type: 'semester', course_grades: [] })).toEqual([
      { id: 1, period: '', average: '', gradeType: 'ufaz' },
    ])
    expect(toAverageRows({ id: 1, name: 'x', calculation_type: 'semester' })).toHaveLength(1)
  })

  it('skips periods with no grade rather than restoring a blank row', () => {
    const rows = toAverageRows({
      id: 1,
      name: 'x',
      calculation_type: 'semester',
      course_grades: [
        { course_name: 'Semester 1', ufaz_grade: 15 },
        { course_name: 'Semester 2', ufaz_grade: null },
      ],
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].period).toBe('Semester 1')
  })

  it('renumbers ids from one so the calculator keys stay unique', () => {
    const rows = toAverageRows({
      id: 1,
      name: 'x',
      calculation_type: 'yearly',
      course_grades: [
        { course_name: 'Year 1', ufaz_grade: 14 },
        { course_name: 'Year 2', ufaz_grade: 16 },
        { course_name: 'Year 3', ufaz_grade: 18 },
      ],
    })
    expect(rows.map((r) => r.id)).toEqual([1, 2, 3])
  })

  it('keeps a zero grade, which is a real mark and not a missing one', () => {
    const rows = toAverageRows({
      id: 1,
      name: 'x',
      calculation_type: 'semester',
      course_grades: [{ course_name: 'Semester 1', ufaz_grade: 0 }],
    })
    expect(rows[0].average).toBe('0')
  })
})

describe('tabFor', () => {
  it('sends a yearly calculation to the yearly tab', () => {
    expect(tabFor({ id: 1, name: 'x', calculation_type: 'yearly' })).toBe('yearly')
  })

  it('defaults to the semester tab', () => {
    expect(tabFor({ id: 1, name: 'x', calculation_type: 'semester' })).toBe('semester')
    expect(tabFor({ id: 1, name: 'x', calculation_type: 'something-else' })).toBe('semester')
  })
})
