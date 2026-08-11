/**
 * What the boards around the campus actually say.
 *
 * The campus was an island. Next door sat a platform with a real timetable, a
 * blog people write in, and grade calculators students use every week — and
 * inside the simulator every board was a blank rectangle. This turns the
 * lecture board into today's schedule and the noticeboard into the latest
 * posts, so walking into a room tells you something true.
 *
 * The formatting is pure and lives here; the fetching is a hook and the drawing
 * is a component, both in `CampusBoards.tsx`. That split is the only way the
 * awkward part — turning a mixed bag of server date shapes into three lines
 * that fit on a board — can be tested at all.
 */

import type { CalendarEvent } from '../../services/calendarApi'

/** One line on a board. */
export interface BoardLine {
  primary: string
  secondary?: string
  /** Right-aligned, for a time or a date. */
  trailing?: string
}

/** How many lines fit before a board starts scrolling text off the bottom. */
export const BOARD_LINES = 6

/**
 * The clock face of an event.
 *
 * The serializer sends three fields under two spellings each — `startTime` and
 * `start_time` are the same value — so reading only one of them silently blanks
 * half the timetable.
 */
export function eventTime(event: CalendarEvent): string | undefined {
  const start = event.startTime ?? event.start_time
  if (!start) return undefined
  // Either "14:30" or a full ISO timestamp, depending on which endpoint filled
  // it in. Both have to render as a time and neither may render as "Invalid".
  const short = /^\d{1,2}:\d{2}/.exec(start)
  if (short) return short[0].padStart(5, '0')

  const parsed = Date.parse(start)
  if (!Number.isFinite(parsed)) return undefined
  const date = new Date(parsed)
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`
}

/** Whether an event belongs to a given day, in YYYY-MM-DD. */
export function isOnDay(event: CalendarEvent, day: string): boolean {
  if (event.date) return event.date.slice(0, 10) === day
  const start = event.startTime ?? event.start_time
  return Boolean(start && start.slice(0, 10) === day)
}

/**
 * Today's timetable, as board lines.
 *
 * Sorted by time with the untimed entries last, because an all-day item at the
 * top pushes the nine o'clock lecture off a six-line board.
 */
export function scheduleLines(events: readonly CalendarEvent[], day: string): BoardLine[] {
  const today = events.filter((event) => isOnDay(event, day))

  const sorted = [...today].sort((a, b) => {
    const at = eventTime(a)
    const bt = eventTime(b)
    if (at && bt) return at.localeCompare(bt)
    if (at) return -1
    if (bt) return 1
    return (a.title ?? '').localeCompare(b.title ?? '')
  })

  return sorted.slice(0, BOARD_LINES).map((event) => ({
    primary: event.courseCode ?? event.course_code ?? event.title ?? 'Untitled',
    secondary: [event.location, event.professor].filter(Boolean).join(' · ') || undefined,
    trailing: eventTime(event),
  }))
}

export interface PostLike {
  id?: number | string
  title?: string
  author?: { username?: string; full_name?: string } | string | null
  created_at?: string
  published_at?: string
}

/** Recent blog posts, as board lines. */
export function noticeLines(posts: readonly PostLike[]): BoardLine[] {
  return posts.slice(0, BOARD_LINES).map((post) => ({
    primary: post.title?.trim() || 'Untitled post',
    secondary: authorName(post.author),
    trailing: shortDate(post.published_at ?? post.created_at),
  }))
}

function authorName(author: PostLike['author']): string | undefined {
  if (!author) return undefined
  if (typeof author === 'string') return author || undefined
  return author.full_name || author.username || undefined
}

/** "11 Aug", or nothing at all rather than "Invalid Date" on a wall. */
export function shortDate(value?: string): string | undefined {
  if (!value) return undefined
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return undefined
  const date = new Date(parsed)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${date.getUTCDate()} ${months[date.getUTCMonth()]}`
}

/** Today, as the boards want it. */
export function todayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/** What a board says when it has nothing to show. */
export function emptyBoard(kind: 'schedule' | 'notices' | 'sites'): BoardLine[] {
  const EMPTY = {
    schedule: { primary: 'Nothing timetabled today', secondary: 'Enjoy it' },
    notices: { primary: 'No posts yet', secondary: 'Be the first' },
    sites: { primary: 'No student sites live yet', secondary: 'Publish one from Hosting' },
  }
  return [EMPTY[kind] ?? EMPTY.notices]
}


/** A hosted student site, as the public listing describes it. */
export interface SiteLike {
  name?: string
  url?: string
  domain?: string | null
  creator?: string | null
  description?: string | null
  total_visits?: number | null
}

/**
 * Student sites, as board lines.
 *
 * The address is the useful part — a screen naming a site nobody can find is a
 * screen saying nothing — so it is the primary line, with who made it beneath.
 * The visit count goes in the trailing column, which is what makes the board
 * worth looking at twice.
 */
export function siteLines(sites: readonly SiteLike[]): BoardLine[] {
  return sites
    .filter((site) => Boolean(site?.name))
    .slice(0, BOARD_LINES)
    .map((site) => ({
      primary: hostOf(site),
      // Credited to a person, never to an address: the listing hands back a
      // display name and this must not start reaching for anything else.
      secondary: site.creator?.trim() || 'a student',
      trailing: visitCount(site.total_visits),
    }))
}

/**
 * The address to type in, without the scheme.
 *
 * `url` is a full https:// address; a board is not a link and the scheme is
 * four wasted characters on a line that has to fit a domain name.
 */
function hostOf(site: SiteLike): string {
  const address = site.url || (site.domain ? `https://${site.domain}` : '')
  if (address) return address.replace(/^https?:\/\//, '').replace(/\/$/, '')
  return String(site.name)
}

function visitCount(visits: number | null | undefined): string | undefined {
  if (typeof visits !== 'number' || !Number.isFinite(visits) || visits <= 0) return undefined
  // Thousands abbreviated: a five-figure count pushes the name off the line.
  return visits >= 1000 ? `${(visits / 1000).toFixed(1)}k` : String(Math.round(visits))
}
