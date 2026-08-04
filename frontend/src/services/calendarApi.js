import apiClient from "../utils/api"

const EVENTS = "/calendar/events/"

function unwrap(data) {
  return Array.isArray(data) ? data : (data?.results ?? [])
}

export const calendarApi = {
  async list({ start, end } = {}) {
    const params = {}
    if (start) params.start = start
    if (end) params.end = end
    const { data } = await apiClient.get(EVENTS, { params })
    return unwrap(data)
  },

  async create(event) {
    const { data } = await apiClient.post(EVENTS, event)
    return data
  },

  async update(id, changes) {
    const { data } = await apiClient.patch(`${EVENTS}${id}/`, changes)
    return data
  },

  async remove(id) {
    await apiClient.delete(`${EVENTS}${id}/`)
    return id
  },
}

export default calendarApi
