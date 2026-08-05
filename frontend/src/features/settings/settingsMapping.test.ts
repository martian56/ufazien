import { describe, expect, it } from 'vitest'
import type { UserSettings } from '../../lib/api/endpoints/settings'
import { DEFAULT_SETTINGS, fromApi, toApi } from './settingsMapping'

const row: UserSettings = {
  grade_system: 'ects',
  default_credits: 6,
  semester_goal: 90,
  show_gpa: false,
  study_goal_hours: 40,

  email_notifications: false,
  assignment_reminders: false,
  grade_updates: true,
  community_messages: false,
  event_reminders: true,
  weekly_reports: true,

  profile_visibility: 'followers',
  show_schedule: false,
  allow_messages: false,
  show_online_status: false,

  theme: 'dark',
  language: 'az',
  date_format: 'YYYY-MM-DD',
  time_format: '12h',

  updated_at: '2026-01-01T00:00:00Z',
}

describe('settings mapping', () => {
  it('reads every field back out of an API row', () => {
    const groups = fromApi(row)
    expect(groups.academic.gradeSystem).toBe('ects')
    expect(groups.academic.showGPA).toBe(false)
    expect(groups.notifications.weeklyReports).toBe(true)
    expect(groups.privacy.profileVisibility).toBe('followers')
    expect(groups.appearance.theme).toBe('dark')
  })

  it('survives a round trip without losing anything', () => {
    // A key dropped in either direction is a setting that silently reverts on
    // the user's next visit, which is exactly the bug this replaced.
    const { updated_at: _ignored, ...sent } = row
    expect(toApi(fromApi(row))).toEqual(sent)
  })

  it('sends every key the server knows about', () => {
    const sent = Object.keys(toApi(DEFAULT_SETTINGS)).sort()
    const known = Object.keys(row).filter((key) => key !== 'updated_at').sort()
    expect(sent).toEqual(known)
  })

  it('sends numbers as numbers, not the strings a select gives back', () => {
    const groups = structuredClone(DEFAULT_SETTINGS)
    // A <select> hands back strings, and the serializer rejects "6" for an
    // integer field on some inputs.
    groups.academic.defaultCredits = '6' as unknown as number
    groups.academic.semesterGoal = '90' as unknown as number

    const sent = toApi(groups)
    expect(sent.default_credits).toBe(6)
    expect(sent.semester_goal).toBe(90)
  })

  it('keeps false apart from missing', () => {
    const groups = structuredClone(DEFAULT_SETTINGS)
    groups.notifications.emailNotifications = false
    expect(toApi(groups).email_notifications).toBe(false)
  })
})
