import { api } from '../client'

/**
 * A user's own preferences.
 *
 * These used to live in localStorage under keys like
 * "ufaz_notification_settings", which made them per-browser: signing in on a
 * phone, or clearing site data, silently reset every one of them.
 *
 * There is deliberately no two-factor field. There is no two-factor
 * authentication, and storing the flag would be a claim the login flow does
 * not keep.
 */
export type ProfileVisibility = 'everyone' | 'followers' | 'nobody'

export interface UserSettings {
  // Academic
  grade_system: string
  default_credits: number
  semester_goal: number
  show_gpa: boolean
  study_goal_hours: number

  // Notifications
  email_notifications: boolean
  assignment_reminders: boolean
  grade_updates: boolean
  community_messages: boolean
  event_reminders: boolean
  weekly_reports: boolean

  // Privacy
  profile_visibility: ProfileVisibility
  show_schedule: boolean
  allow_messages: boolean
  show_online_status: boolean

  // Appearance
  theme: string
  language: string
  date_format: string
  time_format: string

  updated_at: string
}

export const settingsApi = {
  get: () => api.get<UserSettings>('/auth/settings/'),

  update: (data: Partial<UserSettings>) => api.patch<UserSettings>('/auth/settings/', data),
}
