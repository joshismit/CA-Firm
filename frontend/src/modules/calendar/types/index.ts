// TypeScript types and interfaces scoped to the Work Calendar.
// Matches backend/src/modules/calendar exactly (routes/calendar.routes.ts, dto/calendar.*.dto.ts).

import type { TaskStatus } from '@/modules/tasks/types'

export type CalendarState = 'OVERDUE' | 'PENDING' | 'CURRENTLY_WORKING' | 'UPCOMING' | 'COMPLETED' | 'CANCELLED'

export type CalendarItemSource = 'TASK' | 'EVENT'

export type CalendarEventType = 'CLIENT_MEETING' | 'INTERNAL_MEETING' | 'CALL' | 'APPOINTMENT' | 'AUDIT' | 'REVIEW' | 'OTHER'

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

export interface CalendarItemRef {
  id: string
  name: string
}

/** The normalized shape every calendar item is returned in, whether it originated from a Task or a CalendarEvent - only fields relevant to `source` are populated. */
export interface CalendarItem {
  id: string
  source: CalendarItemSource
  title: string
  startAt: string | null
  endAt: string | null
  allDay: boolean
  calendarState: CalendarState
  status?: TaskStatus
  priority?: TaskPriority | null
  eventType?: CalendarEventType
  location?: string | null
  meetingUrl?: string | null
  business: CalendarItemRef | null
  assignee?: CalendarItemRef | null
  attendees?: CalendarItemRef[]
}

export type CalendarScope = 'mine' | 'firm'

export interface CalendarQueryFilters {
  from: string
  to: string
  scope?: CalendarScope
  businessId?: string
  staffId?: string
  status?: TaskStatus
  eventType?: CalendarEventType
  source?: CalendarItemSource
}

export interface CalendarEvent {
  id: string
  title: string
  description: string | null
  startAt: string
  endAt: string | null
  allDay: boolean
  eventType: CalendarEventType
  location: string | null
  meetingUrl: string | null
  business: CalendarItemRef | null
  createdBy: CalendarItemRef
  attendees: CalendarItemRef[]
  createdAt: string
  updatedAt: string
}

export interface CreateCalendarEventPayload {
  title: string
  description?: string
  startAt: string
  endAt?: string
  allDay?: boolean
  eventType?: CalendarEventType
  location?: string
  meetingUrl?: string
  businessId?: string
  attendeeIds?: string[]
}

export type UpdateCalendarEventPayload = Partial<CreateCalendarEventPayload>

export type CalendarView = 'month' | 'week' | 'day' | 'agenda'
