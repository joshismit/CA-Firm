// TypeScript types and interfaces scoped to notifications.
// PROVISIONAL: no Notification Prisma model or backend module exists yet - shapes follow the
// PRD's provider-based WhatsApp/Email/SMS notification engine description (section 11).

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
  channel?: NotificationChannel
  unreadOnly?: boolean
}

export interface NotificationPreference {
  channel: NotificationChannel
  enabled: boolean
}
