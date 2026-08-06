import { api } from '../client'
import type { Paginated } from '../types'

/**
 * GPA calculations.
 *
 * The page talked to the API through its own axios helper built on
 * import.meta.env.VITE_API_URL, so it missed the shared client's
 * refresh-on-401 and error handling entirely.
 */

export interface CourseGrade {
  id?: number
  course_name: string
  credits: number
  grade_type: string
  ufaz_grade?: number | null
  gpa_points?: number | null
  letter_grade?: string | null
}

export interface SavedCalculation {
  id: number
  name: string
  calculation_type: 'semester' | 'yearly'
  overall_gpa?: number | null
  total_credits?: number
  course_grades?: CourseGrade[]
  course_count?: number
  created_at?: string
  updated_at?: string
}

export interface PeriodAverage {
  name: string
  average: number
  credits?: number
}

/** One row of the calculator: a period name and the mark typed against it. */
export interface AverageRow {
  id: number
  period: string
  average: string
  gradeType: string
}

/** What /gpa/input-state/ stores, so a half-typed calculation survives a reload. */
export interface InputState {
  active_tab?: string
  semester_data?: AverageRow[]
  yearly_data?: AverageRow[]
  updated_at?: string | null
}

export interface GpaStatistics {
  /** Present instead of `statistics` when the user has no records yet. */
  message?: string
  statistics?: {
    highest_gpa?: number
    lowest_gpa?: number
    average_gpa?: number
    total_calculations?: number
    total_credits?: number
  }
  recent_calculations?: SavedCalculation[]
  semester_progress?: { name: string; gpa: number; credits: number; date: string }[]
}

export interface UpdateGpaResult {
  success: boolean
  overall_gpa: number
  total_credits: number
  user_gpa_id: number
  message: string
}

export const gpaApi = {
  list: () => api.get<Paginated<SavedCalculation> | SavedCalculation[]>('/gpa/calculations/'),

  /**
   * Keep a named copy of what is in the calculator.
   *
   * update-user-gpa autosaves under one fixed name per type and overwrites it
   * every time, which is right for an autosave and useless as a history. This
   * is the deliberate save, and the endpoint has always supported it.
   */
  save: (name: string, calculationType: string, courseGrades: CourseGrade[]) =>
    api.post<SavedCalculation>('/gpa/calculations/', {
      name,
      calculation_type: calculationType,
      course_grades: courseGrades,
    }),

  remove: (id: number) => api.delete(`/gpa/calculations/${id}/`),

  statistics: () => api.get<GpaStatistics>('/gpa/statistics/'),

  /** Autosave: one record per type, overwritten each time. */
  updateUserGpa: (periodType: string, periodAverages: PeriodAverage[]) =>
    api.post<UpdateGpaResult>('/gpa/update-user-gpa/', {
      period_type: periodType,
      period_averages: periodAverages,
    }),

  getInputState: () => api.get<InputState>('/gpa/input-state/'),

  saveInputState: (activeTab: string, semesterData: AverageRow[], yearlyData: AverageRow[]) =>
    api.post('/gpa/input-state/', {
      active_tab: activeTab,
      semester_data: semesterData,
      yearly_data: yearlyData,
    }),
}

export default gpaApi
