// src/modules/notifications/components/NotificationTableColumns.tsx
// Column definitions consumed by the shared DataTable - no table-rendering logic lives here.
import type { ColumnDef } from '@tanstack/react-table'
import { cn, formatDate } from '@/lib/utils'
import { NotificationStatusBadge } from './NotificationStatusBadge'
import { NotificationReadBadge } from './NotificationReadBadge'
import { NOTIFICATION_CHANNEL_LABELS } from '../constants'
import type { Notification } from '../types'

export const notificationTableColumns: ColumnDef<Notification>[] = [
  {
    accessorKey: 'title',
    header: 'Notification',
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className={cn('truncate max-w-[280px]', row.original.isRead ? 'font-normal text-[var(--color-text-secondary)]' : 'font-semibold text-[var(--color-text-body)]')}>
          {row.original.title}
        </p>
        <p className="text-[11px] text-[var(--color-text-muted)] truncate max-w-[280px]">{row.original.message}</p>
      </div>
    ),
  },
  {
    accessorKey: 'channel',
    header: 'Channel',
    cell: ({ row }) => (
      <span className="text-[12px] text-[var(--color-text-secondary)]">{NOTIFICATION_CHANNEL_LABELS[row.original.channel] ?? row.original.channel}</span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Delivery',
    cell: ({ row }) => <NotificationStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: 'isRead',
    header: 'Read',
    cell: ({ row }) => <NotificationReadBadge isRead={row.original.isRead} />,
  },
  {
    accessorKey: 'createdAt',
    header: 'Received',
    cell: ({ row }) => (
      <span className="text-[12px] text-[var(--color-text-secondary)]">{formatDate(row.original.createdAt)}</span>
    ),
  },
]
