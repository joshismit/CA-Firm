// calendar-scoped constants (status-color mapping, event type labels).
// CALENDAR_STATE_CONFIG reuses the existing semantic StatusBadge variants (src/components/shared/StatusBadge)
// rather than introducing new colors - matches the project's existing status-color system.

import type { CalendarEventType, CalendarState } from '../types'

type StatusVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'

export const CALENDAR_STATE_CONFIG: Record<CalendarState, { variant: StatusVariant; label: string }> = {
  OVERDUE: { variant: 'danger', label: 'Overdue' },
  PENDING: { variant: 'warning', label: 'Pending' },
  CURRENTLY_WORKING: { variant: 'info', label: 'In Progress' },
  UPCOMING: { variant: 'primary', label: 'Upcoming' },
  COMPLETED: { variant: 'success', label: 'Completed' },
  CANCELLED: { variant: 'default', label: 'Cancelled' },
}

export const CALENDAR_EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  CLIENT_MEETING: 'Client Meeting',
  INTERNAL_MEETING: 'Internal Meeting',
  CALL: 'Call',
  APPOINTMENT: 'Appointment',
  AUDIT: 'Audit',
  REVIEW: 'Review',
  OTHER: 'Other',
}

export const CALENDAR_EVENT_TYPE_OPTIONS = Object.entries(CALENDAR_EVENT_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}))

export const CALENDAR_VIEW_OPTIONS: { value: 'month' | 'week' | 'day' | 'agenda'; label: string }[] = [
  { value: 'month', label: 'Month' },
  { value: 'week', label: 'Week' },
  { value: 'day', label: 'Day' },
  { value: 'agenda', label: 'Agenda' },
]
