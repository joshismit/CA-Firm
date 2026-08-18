// notifications API request functions, built on the shared Axios instance from src/services/axios.ts.
// Hits the real backend at ${env.apiBaseUrl}/notifications (backend/src/modules/notifications/
// routes/notification.routes.ts) - mirrors modules/compliance/api/index.ts now that the
// Notifications backend module exists.
//
// getNotificationPreferences/updateNotificationPreference remain NOT_IMPLEMENTED deliberately -
// the backend module was scoped to only the read/mark-read/mark-all-read/delete operations the
// rest of this module actually consumes (list/detail/mark-read/mark-all-read/delete); per-channel
// notification preferences were explicitly out of scope for that module and have no backend
// counterpart yet.
import { apiClient } from '@/services/axios'
import type { ApiError } from '@/services/api-error'
import type { ApiResponse, PaginatedResponse } from '@/types/api.types'
import type { Notification, NotificationListFilters, NotificationPreference } from '../types'

function notImplemented(action: string): never {
  throw {
    status: 501,
    code: 'NOT_IMPLEMENTED',
    message: `Notifications API is not available yet (${action}).`,
  } satisfies ApiError
}

export async function listNotifications(filters: NotificationListFilters): Promise<PaginatedResponse<Notification>> {
  const { data } = await apiClient.get<PaginatedResponse<Notification>>('/notifications', { params: filters })
  return data
}

export async function getNotification(id: string): Promise<Notification> {
  const { data } = await apiClient.get<ApiResponse<Notification>>(`/notifications/${id}`)
  return data.data
}

export async function deleteNotification(id: string): Promise<void> {
  await apiClient.delete(`/notifications/${id}`)
}

export async function markNotificationAsRead(id: string): Promise<void> {
  await apiClient.patch(`/notifications/${id}/read`)
}

export async function markAllNotificationsAsRead(): Promise<void> {
  await apiClient.post('/notifications/read-all')
}

// TODO: GET /api/v1/notifications/preferences
export async function getNotificationPreferences(): Promise<NotificationPreference[]> {
  return notImplemented('getNotificationPreferences')
}

// TODO: PATCH /api/v1/notifications/preferences
export async function updateNotificationPreference(_payload: NotificationPreference): Promise<NotificationPreference> {
  return notImplemented('updateNotificationPreference')
}
