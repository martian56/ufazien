import { api as apiClient } from '../lib/api/client'
import { toList, type Paginated } from '../lib/api/types'

const EVENTS = '/calendar/events/'

/**
 * What the calendar endpoint actually returns.
 *
 * The serializer exposes three fields under both spellings, because the UI
 * was written in camelCase and the model is snake_case: startTime and
 * start_time are the same value, as are endTime/end_time and
 * courseCode/course_code. The previous version of this type declared neither
 * the camelCase spellings the components read, nor date, category or
 * priority, and did declare event_type and all_day, which the serializer does
 * not send at all.
 */
export interface CalendarEvent {
  id: number
  title: string
  description?: string
  date?: string
  start_time?: string
  end_time?: string
  /** Same value as start_time. */
  startTime?: string
  /** Same value as end_time. */
  endTime?: string
  location?: string
  category?: string
  priority?: string
  recurring?: string
  professor?: string
  course_code?: string
  /** Same value as course_code. */
  courseCode?: string
  participants?: unknown[]
  color?: string
  created_at?: string
  updated_at?: string
}

export interface EventRange {
  start?: string
  end?: string
}

/**
 * Every method here destructured `{ data }` from the response. The client
 * returns parsed JSON, not an axios envelope, so `data` was always undefined:
 * list() returned an empty array whatever the server sent, and create and
 * update resolved to undefined. This is the trap CLAUDE.md warns about.
 */
export const calendarApi = {
  async list({ start, end }: EventRange = {}): Promise<CalendarEvent[]> {
    const response = await apiClient.get<Paginated<CalendarEvent> | CalendarEvent[]>(EVENTS, {
      params: { start, end },
    })
    return toList(response)
  },

  create: (event: Partial<CalendarEvent>) => apiClient.post<CalendarEvent>(EVENTS, event),

  update: (id: number, changes: Partial<CalendarEvent>) =>
    apiClient.patch<CalendarEvent>(`${EVENTS}${id}/`, changes),

  async remove(id: number) {
    await apiClient.delete(`${EVENTS}${id}/`)
    return id
  },
}

export default calendarApi
