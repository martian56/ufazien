import { useEffect, useState } from 'react'
import { api } from '../../lib/api/client'

/**
 * Real counts for the landing page.
 *
 * These were literals in the JSX ("200+ Active Students", "4,000+ GPA
 * Calculations"), written once and never touched again, so they drifted from
 * the truth in whichever direction the platform grew.
 *
 * The endpoint is public, because the landing page is. If it fails, the
 * numbers are left out rather than replaced with a guess: a visitor seeing no
 * figure is better served than one seeing an invented one.
 */

export interface PlatformStats {
  students: number
  gpa_calculations: number
  average_calculations: number
  average_schemas: number
  hosted_websites: number
  blog_posts: number
  study_groups: number
  /**
   * The rest of the platform. Optional so the page still renders against a
   * deployment that has not been updated yet — a missing figure is left out
   * rather than shown as a zero it never measured.
   */
  forum_posts?: number
  hosted_databases?: number
  deployments?: number
  campus_lobbies?: number
  ai_tasks?: number
  calendar_events?: number
}

/** 1,240 -> "1,240"; 0 stays "0" rather than becoming a hopeful "0+". */
export function formatCount(value: number): string {
  return value.toLocaleString('en-US')
}

export function usePlatformStats(): PlatformStats | null {
  const [stats, setStats] = useState<PlatformStats | null>(null)

  useEffect(() => {
    let active = true
    api
      .get<PlatformStats>('/stats/')
      .then((data) => {
        if (active) setStats(data)
      })
      .catch(() => {
        // Leave it null; the page renders without the figures.
      })
    return () => {
      active = false
    }
  }, [])

  return stats
}
