// src/modules/notifications/components/NotificationFilters.tsx
// Filter controls for the Notifications list - rendered inside DataTable's toolbarFilters slot.
// unreadOnly is surfaced as Tabs above the table (all/unread), not here - see NotificationListPage.
import { Select } from '@/components/ui/select'
import { NOTIFICATION_CHANNEL_OPTIONS, NOTIFICATION_STATUS_OPTIONS } from '../constants'
import type { NotificationChannel, NotificationStatus } from '../types'

const CHANNEL_FILTER_OPTIONS = [{ value: '__all__', label: 'All channels' }, ...NOTIFICATION_CHANNEL_OPTIONS]
const STATUS_FILTER_OPTIONS = [{ value: '__all__', label: 'All delivery statuses' }, ...NOTIFICATION_STATUS_OPTIONS]

export interface NotificationFiltersProps {
  channel: NotificationChannel | undefined
  onChannelChange: (channel: NotificationChannel | undefined) => void
  status: NotificationStatus | undefined
  onStatusChange: (status: NotificationStatus | undefined) => void
}

export function NotificationFilters({ channel, onChannelChange, status, onStatusChange }: NotificationFiltersProps) {
  return (
    <>
      <Select
        value={channel ?? '__all__'}
        onChange={(value) => onChannelChange(value === '__all__' ? undefined : (value as NotificationChannel))}
        options={CHANNEL_FILTER_OPTIONS}
        className="h-8 w-[150px]"
        placeholder="Channel"
      />
      <Select
        value={status ?? '__all__'}
        onChange={(value) => onStatusChange(value === '__all__' ? undefined : (value as NotificationStatus))}
        options={STATUS_FILTER_OPTIONS}
        className="h-8 w-[180px]"
        placeholder="Delivery status"
      />
    </>
  )
}
