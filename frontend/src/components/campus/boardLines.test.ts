import { describe, it, expect } from 'vitest'

import {
  BOARD_LINES,
  emptyBoard,
  eventTime,
  isOnDay,
  noticeLines,
  scheduleLines,
  siteLines,
  shortDate,
  todayKey,
} from './boardLines'
import type { CalendarEvent } from '../../services/calendarApi'

/**
 * The boards read real platform data, which arrives in more shapes than the
 * types suggest: the calendar serializer sends the same value under both
 * `startTime` and `start_time`, and either as a clock time or a full timestamp.
 */

const DAY = '2026-08-11'

describe('eventTime', () => {
  it('reads the camelCase spelling the components use', () => {
    expect(eventTime({ startTime: '09:30' } as CalendarEvent)).toBe('09:30')
  })

  it('reads the snake_case spelling the model uses', () => {
    // Both are sent, and reading only one silently blanks half the timetable.
    expect(eventTime({ start_time: '14:05' } as CalendarEvent)).toBe('14:05')
  })

  it('reads a full timestamp as a time', () => {
    expect(eventTime({ startTime: '2026-08-11T08:15:00Z' } as CalendarEvent)).toBe('08:15')
  })

  it('pads a single-digit hour so the column lines up', () => {
    expect(eventTime({ startTime: '9:05' } as CalendarEvent)).toBe('09:05')
  })

  it('gives nothing rather than "Invalid" for junk', () => {
    // Whatever else happens, a wall in a lecture theatre must not read
    // "Invalid Date" to a room full of people.
    expect(eventTime({ startTime: 'soon' } as CalendarEvent)).toBeUndefined()
    expect(eventTime({} as CalendarEvent)).toBeUndefined()
  })
})

describe('isOnDay', () => {
  it('matches on the date field', () => {
    expect(isOnDay({ date: DAY } as CalendarEvent, DAY)).toBe(true)
    expect(isOnDay({ date: '2026-08-12' } as CalendarEvent, DAY)).toBe(false)
  })

  it('falls back to the start timestamp', () => {
    expect(isOnDay({ startTime: `${DAY}T09:00:00Z` } as CalendarEvent, DAY)).toBe(true)
  })

  it('tolerates a date carrying a time on it', () => {
    expect(isOnDay({ date: `${DAY}T00:00:00Z` } as CalendarEvent, DAY)).toBe(true)
  })

  it('is false for an event with no date at all', () => {
    expect(isOnDay({ title: 'Someday' } as CalendarEvent, DAY)).toBe(false)
  })
})

describe('scheduleLines', () => {
  const events = [
    { title: 'Late', courseCode: 'PHY201', startTime: '16:00', date: DAY },
    { title: 'Early', courseCode: 'MAT101', startTime: '09:00', date: DAY, location: 'A1' },
    { title: 'Tomorrow', startTime: '10:00', date: '2026-08-12' },
  ] as CalendarEvent[]

  it('shows only today', () => {
    const lines = scheduleLines(events, DAY)
    expect(lines).toHaveLength(2)
    expect(lines.map((l) => l.primary)).not.toContain('Tomorrow')
  })

  it('puts the day in order', () => {
    expect(scheduleLines(events, DAY).map((l) => l.trailing)).toEqual(['09:00', '16:00'])
  })

  it('sorts untimed entries last', () => {
    // An all-day item at the top pushes the nine o'clock lecture off the board.
    const withAllDay = [...events, { title: 'Reading week', date: DAY } as CalendarEvent]
    const lines = scheduleLines(withAllDay, DAY)
    expect(lines[lines.length - 1].primary).toBe('Reading week')
  })

  it('prefers the course code, which is what is on a timetable', () => {
    expect(scheduleLines(events, DAY)[0].primary).toBe('MAT101')
  })

  it('falls back to the title when there is no course code', () => {
    expect(scheduleLines([{ title: 'Open day', date: DAY } as CalendarEvent], DAY)[0].primary).toBe(
      'Open day',
    )
  })

  it('never overflows the board', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      title: `Event ${i}`,
      date: DAY,
      startTime: `0${i % 9}:00`,
    })) as CalendarEvent[]
    expect(scheduleLines(many, DAY).length).toBeLessThanOrEqual(BOARD_LINES)
  })

  it('is empty rather than throwing on no events', () => {
    expect(scheduleLines([], DAY)).toEqual([])
  })
})

describe('noticeLines', () => {
  it('shows the title and who wrote it', () => {
    const lines = noticeLines([
      { title: 'Exam timetable is out', author: { full_name: 'Aysel M' }, created_at: `${DAY}T09:00:00Z` },
    ])
    expect(lines[0].primary).toBe('Exam timetable is out')
    expect(lines[0].secondary).toBe('Aysel M')
    expect(lines[0].trailing).toBe('11 Aug')
  })

  it('handles an author sent as a bare string', () => {
    expect(noticeLines([{ title: 'x', author: 'nigar' }])[0].secondary).toBe('nigar')
  })

  it('falls back to the username', () => {
    expect(noticeLines([{ title: 'x', author: { username: 'nigar' } }])[0].secondary).toBe('nigar')
  })

  it('survives a post with no author or date', () => {
    const lines = noticeLines([{ title: 'Anonymous' }])
    expect(lines[0].primary).toBe('Anonymous')
    expect(lines[0].secondary).toBeUndefined()
    expect(lines[0].trailing).toBeUndefined()
  })

  it('names an untitled post rather than showing a blank row', () => {
    expect(noticeLines([{ title: '   ' }])[0].primary).toBe('Untitled post')
  })

  it('never overflows the board', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ title: `Post ${i}` }))
    expect(noticeLines(many).length).toBeLessThanOrEqual(BOARD_LINES)
  })
})

describe('shortDate', () => {
  it('formats a timestamp', () => {
    expect(shortDate('2026-01-05T00:00:00Z')).toBe('5 Jan')
  })

  it('gives nothing for junk rather than "Invalid Date"', () => {
    expect(shortDate('whenever')).toBeUndefined()
    expect(shortDate(undefined)).toBeUndefined()
  })
})

describe('board fallbacks', () => {
  it('says something rather than nothing when there is no data', () => {
    expect(emptyBoard('schedule')[0].primary).toBeTruthy()
    expect(emptyBoard('notices')[0].primary).toBeTruthy()
  })

  it('keys today in the format the filter compares against', () => {
    expect(todayKey(new Date('2026-08-11T22:00:00Z'))).toBe(DAY)
    expect(todayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('siteLines', () => {
  const sites = [
    { name: 'portfolio', url: 'https://portfolio.ufazien.com', creator: 'Aysel Mammadova', total_visits: 2400 },
    { name: 'notes', url: 'https://notes.ufazien.com/', creator: '  ', total_visits: 12 },
    { name: 'quiet', domain: 'quiet.example.com', creator: 'Rashad', total_visits: 0 },
  ]

  it('leads with the address, because that is what you would type', () => {
    expect(siteLines(sites)[0].primary).toBe('portfolio.ufazien.com')
  })

  it('drops the scheme and a trailing slash', () => {
    // A board is not a link, and four characters of "https://" is a chunk of a
    // line that has to fit a domain name.
    expect(siteLines(sites)[1].primary).toBe('notes.ufazien.com')
  })

  it('falls back to the domain when there is no url', () => {
    expect(siteLines(sites)[2].primary).toBe('quiet.example.com')
  })

  it('credits somebody, even when the listing has no name', () => {
    expect(siteLines(sites)[0].secondary).toBe('Aysel Mammadova')
    expect(siteLines(sites)[1].secondary).toBe('a student')
  })

  it('abbreviates a large visit count and hides an empty one', () => {
    expect(siteLines(sites)[0].trailing).toBe('2.4k')
    expect(siteLines(sites)[1].trailing).toBe('12')
    expect(siteLines(sites)[2].trailing).toBeUndefined()
  })

  it('fits the board', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ name: `s${i}`, url: `https://s${i}.test` }))
    expect(siteLines(many)).toHaveLength(BOARD_LINES)
  })

  it('ignores a row with no name at all', () => {
    expect(siteLines([{ url: 'https://ghost.test' }, ...sites])).toHaveLength(3)
  })

  it('says something useful when nobody has published anything', () => {
    expect(siteLines([])).toHaveLength(0)
    expect(emptyBoard('sites')[0].primary).toContain('No student sites')
  })
})
