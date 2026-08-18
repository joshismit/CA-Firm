// src/modules/notifications/components/NotificationReadBadge.tsx
// Thin, module-scoped config layer over the shared StatusBadge - renders the boolean isRead field
// as a two-state badge (distinct from NotificationStatusBadge's delivery status).
import { StatusBadge } from '@/components/shared/StatusBadge/StatusBadge'

export interface NotificationReadBadgeProps {
  isRead: boolean
  className?: string
}

export function NotificationReadBadge({ isRead, className }: NotificationReadBadgeProps) {
  return (
    <StatusBadge variant={isRead ? 'default' : 'primary'} dot={!isRead} className={className}>
      {isRead ? 'Read' : 'Unread'}
    </StatusBadge>
  )
}
