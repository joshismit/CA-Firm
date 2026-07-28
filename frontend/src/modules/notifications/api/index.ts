// notifications API request functions, built on the shared Axios instance from src/services/axios.ts.
//
// NOT YET AVAILABLE: there is no Notification Prisma model or backend module yet. Every function
// below is a typed placeholder - wire the real apiClient call once the backend implements this
// module. No mock data, no guessed endpoint path.

import type { ApiError } from '@/services/api-error'
import type { PaginatedResponse } from '@/types/api.types'
import type { Notification, NotificationListFilters, NotificationPreference } from '../types'

function notImplemented(action: string): never {
  throw {
    status: 501,
    code: 'NOT_IMPLEMENTED',
    message: `Notifications API is not available yet (${action}).`,
  } satisfies ApiError
}

// TODO: GET /api/v1/notifications
export async function listNotifications(_filters: NotificationListFilters): Promise<PaginatedResponse<Notification>> {
  return notImplemented('listNotifications')
}

// TODO: PATCH /api/v1/notifications/:id/read
export async function markNotificationAsRead(_id: string): Promise<void> {
  return notImplemented('markNotificationAsRead')
}

// TODO: POST /api/v1/notifications/read-all
export async function markAllNotificationsAsRead(): Promise<void> {
  return notImplemented('markAllNotificationsAsRead')
}

// TODO: GET /api/v1/notifications/preferences
export async function getNotificationPreferences(): Promise<NotificationPreference[]> {
  return notImplemented('getNotificationPreferences')
}

// TODO: PATCH /api/v1/notifications/preferences
export async function updateNotificationPreference(_payload: NotificationPreference): Promise<NotificationPreference> {
  return notImplemented('updateNotificationPreference')
}
