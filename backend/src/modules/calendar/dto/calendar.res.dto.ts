import { TaskStatus, TaskPriority, CalendarEventType } from '@prisma/client';
import type { CalendarState } from '@shared/utils';

export type CalendarItemSource = 'TASK' | 'EVENT';

export interface CalendarItemBusinessRef {
  id: string;
  name: string;
}

export interface CalendarItemUserRef {
  id: string;
  name: string;
}

/**
 * The normalized shape every calendar item is mapped to, regardless of
 * whether it originated from a `Task` or a `CalendarEvent` — the frontend
 * never needs to understand either backend model separately (PRD §8). Only
 * the fields relevant to the item's `source` are populated; the others are
 * simply omitted (not sent as `null`) by `CalendarMapper`.
 */
export interface CalendarItemDto {
  id: string;
  source: CalendarItemSource;
  title: string;
  startAt: string | null;
  endAt: string | null;
  allDay: boolean;
  calendarState: CalendarState;
  status?: TaskStatus;
  priority?: TaskPriority | null;
  eventType?: CalendarEventType;
  location?: string | null;
  meetingUrl?: string | null;
  business: CalendarItemBusinessRef | null;
  assignee?: CalendarItemUserRef | null;
  attendees?: CalendarItemUserRef[];
}

export interface CalendarItemsResponseDto {
  items: CalendarItemDto[];
}

/** Response DTO for `CalendarEvent` CRUD endpoints — deliberately omits `tenantId`/`deletedAt`/`deletedBy`, mirrors `TaskResponseDto`'s own reasoning. */
export interface CalendarEventResponseDto {
  id: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  eventType: CalendarEventType;
  location: string | null;
  meetingUrl: string | null;
  business: CalendarItemBusinessRef | null;
  createdBy: CalendarItemUserRef;
  attendees: CalendarItemUserRef[];
  createdAt: string;
  updatedAt: string;
}
