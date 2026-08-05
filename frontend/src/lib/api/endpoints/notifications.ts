import { api } from '../client'
import type { Paginated } from '../types'

export interface Notification {
  id: number
  notification_type: string
  title: string
  message: string
  is_read: boolean
  created_at: string
  link?: string | null
  actor?: { id: number; username: string; avatar?: string | null } | null
}

export interface NotificationPreferences {
  email_notifications?: boolean
  push_notifications?: boolean
  [key: string]: unknown
}

const BASE = '/notifications'

export const notificationsApi = {
  getNotifications: (page = 1, pageSize = 20) =>
    api.get<Paginated<Notification>>(`${BASE}/`, { params: { page, page_size: pageSize } }),

  getUnreadCount: () => api.get<{ count: number }>(`${BASE}/count/`),

  /** An empty list marks everything read, which is what the server expects. */
  markAsRead: (notificationIds: number[] = []) =>
    api.post<{ marked: number }>(`${BASE}/mark-read/`, { notification_ids: notificationIds }),

  markAllAsRead: () => notificationsApi.markAsRead([]),

  getPreferences: () => api.get<NotificationPreferences>(`${BASE}/preferences/`),

  updatePreferences: (preferences: NotificationPreferences) =>
    api.put<NotificationPreferences>(`${BASE}/preferences/`, preferences),

  /** The endpoint returns camelCase, unlike the rest of the API. */
  getVapidKey: () => api.get<{ publicKey: string }>(`${BASE}/vapid-key/`),

  subscribePush: (subscription: PushSubscriptionJSON | PushSubscription) =>
    api.post(`${BASE}/push/subscribe/`, subscription),

  unsubscribePush: (endpoint: string) => api.post(`${BASE}/push/unsubscribe/`, { endpoint }),
}

export default notificationsApi
