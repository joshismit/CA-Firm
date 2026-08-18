// TypeScript types and interfaces scoped to notifications.
// Field shapes mirror backend/src/modules/notifications/dto/notification.res.dto.ts exactly.
// NotificationPreference remains provisional - no backend counterpart exists (per-channel
// notification preferences were explicitly out of scope for the Notifications backend module).

export type NotificationChannel = 'WHATSAPP' | 'EMAIL' | 'SMS' | 'IN_APP'

export type NotificationStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED'

export interface Notification {
  id: string
  channel: NotificationChannel
  status: NotificationStatus
  title: string
  message: string
  isRead: boolean
  createdAt: string
}

export interface NotificationListFilters {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  search?: string
  channel?: NotificationChannel
  status?: NotificationStatus
  unreadOnly?: boolean
}

export interface NotificationPreference {
  channel: NotificationChannel
  enabled: boolean
}
