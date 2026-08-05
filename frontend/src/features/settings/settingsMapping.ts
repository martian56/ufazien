import type { ProfileVisibility, UserSettings } from '../../lib/api/endpoints/settings'

/**
 * Translation between the settings page's grouped camelCase state and the
 * flat snake_case row the API stores.
 *
 * Kept as pure functions so the mapping can be tested without a page: a
 * silently dropped key here means a setting the user changes, sees saved, and
 * finds reverted on the next visit.
 */

export interface AcademicSettings {
  gradeSystem: string
  defaultCredits: number
  semesterGoal: number
  showGPA: boolean
  studyGoalHours: number
}

export interface NotificationSettings {
  emailNotifications: boolean
  assignmentReminders: boolean
  gradeUpdates: boolean
  communityMessages: boolean
  eventReminders: boolean
  weeklyReports: boolean
}

export interface PrivacySettings {
  profileVisibility: ProfileVisibility
  showSchedule: boolean
  allowMessages: boolean
  showOnlineStatus: boolean
}

export interface AppearanceSettings {
  theme: string
  language: string
  dateFormat: string
  timeFormat: string
}

export interface SettingsGroups {
  academic: AcademicSettings
  notifications: NotificationSettings
  privacy: PrivacySettings
  appearance: AppearanceSettings
}

export const DEFAULT_SETTINGS: SettingsGroups = {
  academic: {
    gradeSystem: 'ufaz',
    defaultCredits: 3,
    semesterGoal: 85,
    showGPA: true,
    studyGoalHours: 25,
  },
  notifications: {
    emailNotifications: true,
    assignmentReminders: true,
    gradeUpdates: true,
    communityMessages: true,
    eventReminders: true,
    weeklyReports: false,
  },
  privacy: {
    profileVisibility: 'everyone',
    showSchedule: true,
    allowMessages: true,
    showOnlineStatus: true,
  },
  appearance: {
    theme: 'light',
    language: 'en',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h',
  },
}

export function fromApi(row: UserSettings): SettingsGroups {
  return {
    academic: {
      gradeSystem: row.grade_system,
      defaultCredits: row.default_credits,
      semesterGoal: row.semester_goal,
      showGPA: row.show_gpa,
      studyGoalHours: row.study_goal_hours,
    },
    notifications: {
      emailNotifications: row.email_notifications,
      assignmentReminders: row.assignment_reminders,
      gradeUpdates: row.grade_updates,
      communityMessages: row.community_messages,
      eventReminders: row.event_reminders,
      weeklyReports: row.weekly_reports,
    },
    privacy: {
      profileVisibility: row.profile_visibility,
      showSchedule: row.show_schedule,
      allowMessages: row.allow_messages,
      showOnlineStatus: row.show_online_status,
    },
    appearance: {
      theme: row.theme,
      language: row.language,
      dateFormat: row.date_format,
      timeFormat: row.time_format,
    },
  }
}

export function toApi(groups: SettingsGroups): Partial<UserSettings> {
  return {
    grade_system: groups.academic.gradeSystem,
    default_credits: Number(groups.academic.defaultCredits),
    semester_goal: Number(groups.academic.semesterGoal),
    show_gpa: groups.academic.showGPA,
    study_goal_hours: Number(groups.academic.studyGoalHours),

    email_notifications: groups.notifications.emailNotifications,
    assignment_reminders: groups.notifications.assignmentReminders,
    grade_updates: groups.notifications.gradeUpdates,
    community_messages: groups.notifications.communityMessages,
    event_reminders: groups.notifications.eventReminders,
    weekly_reports: groups.notifications.weeklyReports,

    profile_visibility: groups.privacy.profileVisibility,
    show_schedule: groups.privacy.showSchedule,
    allow_messages: groups.privacy.allowMessages,
    show_online_status: groups.privacy.showOnlineStatus,

    theme: groups.appearance.theme,
    language: groups.appearance.language,
    date_format: groups.appearance.dateFormat,
    time_format: groups.appearance.timeFormat,
  }
}
