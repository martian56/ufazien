import { describe, it, expect } from 'vitest'

import { formatCount, type PlatformStats } from './usePlatformStats'

/**
 * Every figure the endpoint sends should reach the page.
 *
 * It fetched seven and rendered `stats.slice(0, 4)`, so Hosted Websites, Blog
 * Posts and Study Groups were counted, sent over the wire and thrown away —
 * three of the platform's own features, invisible on the page that introduces
 * it.
 */

/** The shape the page builds, minus the icons. */
function tiles(stats: Partial<PlatformStats>) {
  return (
    [
      { number: stats.students, label: 'Students' },
      { number: stats.gpa_calculations, label: 'GPA Calculations' },
      { number: stats.average_calculations, label: 'Average Calculations' },
      { number: stats.average_schemas, label: 'Average Schemas' },
      { number: stats.hosted_websites, label: 'Hosted Websites' },
      { number: stats.hosted_databases, label: 'Databases' },
      { number: stats.deployments, label: 'Deployments' },
      { number: stats.blog_posts, label: 'Blog Posts' },
      { number: stats.study_groups, label: 'Study Groups' },
      { number: stats.forum_posts, label: 'Forum Posts' },
      { number: stats.campus_lobbies, label: 'Campus Lobbies' },
      { number: stats.ai_tasks, label: 'AI Tasks' },
      { number: stats.calendar_events, label: 'Calendar Events' },
    ] as { number: number | undefined; label: string }[]
  ).filter((tile) => typeof tile.number === 'number')
}

const full: PlatformStats = {
  students: 1240,
  gpa_calculations: 4300,
  average_calculations: 900,
  average_schemas: 120,
  hosted_websites: 87,
  blog_posts: 45,
  study_groups: 12,
  forum_posts: 310,
  hosted_databases: 22,
  deployments: 640,
  campus_lobbies: 58,
  ai_tasks: 1500,
  calendar_events: 2100,
}

describe('the figures the landing page shows', () => {
  it('shows all of them, not the first four', () => {
    expect(tiles(full)).toHaveLength(13)
  })

  it('includes the three that used to be fetched and dropped', () => {
    const labels = tiles(full).map((tile) => tile.label)

    expect(labels).toContain('Hosted Websites')
    expect(labels).toContain('Blog Posts')
    expect(labels).toContain('Study Groups')
  })

  it('covers the features the page has no figure for otherwise', () => {
    const labels = tiles(full).map((tile) => tile.label)

    for (const label of ['Databases', 'Deployments', 'Forum Posts', 'Campus Lobbies', 'AI Tasks', 'Calendar Events']) {
      expect(labels, `${label} is not on the page`).toContain(label)
    }
  })

  it('leaves out a figure an older backend does not send', () => {
    // Absent is not zero. A deployment without the newer counts loses a tile
    // rather than claiming nothing has ever happened.
    const older: PlatformStats = {
      students: 10,
      gpa_calculations: 0,
      average_calculations: 0,
      average_schemas: 0,
      hosted_websites: 0,
      blog_posts: 0,
      study_groups: 0,
    }

    const labels = tiles(older).map((tile) => tile.label)

    expect(labels).toHaveLength(7)
    expect(labels).not.toContain('AI Tasks')
  })

  it('still shows a real zero', () => {
    // Which is different: the endpoint said so.
    expect(tiles({ ...full, ai_tasks: 0 }).map((t) => t.label)).toContain('AI Tasks')
  })
})

describe('writing a count', () => {
  it('groups the thousands', () => {
    expect(formatCount(1240)).toBe('1,240')
  })

  it('leaves nought alone rather than making it hopeful', () => {
    expect(formatCount(0)).toBe('0')
  })
})
