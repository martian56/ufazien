import { api as apiClient } from '../lib/api/client'
import { toList, type Paginated } from '../lib/api/types'

const EVENTS = '/calendar/events/'

export interface CalendarEvent {
  id: number
  title: string
  description?: string
  start_time: string
  end_time: string
  location?: string
  event_type?: string
  color?: string
  all_day?: boolean
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
