import { deriveTaskCalendarState, deriveEventCalendarState } from '@shared/utils';
import type { TaskWithCalendarRelations } from '@modules/tasks';
import type { CalendarEventWithRelations } from '../service/calendar-event.service';
import { CalendarEventResponseDto, CalendarItemDto, CalendarItemUserRef } from '../dto/calendar.res.dto';

function userRef(user: { id: string; firstName: string; lastName: string } | null): CalendarItemUserRef | null {
  return user ? { id: user.id, name: `${user.firstName} ${user.lastName}`.trim() } : null;
}

/**
 * Entity ⇄ DTO mapper for Work Calendar items. Services/controllers must
 * always return data through this mapper — never serialize a raw `Task` or
 * `CalendarEvent` in a response. Mirrors `modules/tasks/mapper/task.mapper.ts`.
 */
export class CalendarMapper {
  /** A Task has no start time — only a date-only `dueDate` — so `startAt` is
   *  always null and `allDay` is always true; the calendar renders it as an
   *  all-day item on its due date, exactly like `Task.dueDate`'s own semantics. */
  static taskToCalendarItem(task: TaskWithCalendarRelations, now: Date = new Date()): CalendarItemDto {
    return {
      id: task.id,
      source: 'TASK',
      title: task.title,
      startAt: null,
      endAt: task.dueDate ? task.dueDate.toISOString() : null,
      allDay: true,
      calendarState: deriveTaskCalendarState(task.status, task.dueDate, now),
      status: task.status,
      priority: task.priority,
      business: task.business,
      assignee: userRef(task.assignee),
    };
  }

  static eventToCalendarItem(event: CalendarEventWithRelations, now: Date = new Date()): CalendarItemDto {
    return {
      id: event.id,
      source: 'EVENT',
      title: event.title,
      startAt: event.startAt.toISOString(),
      endAt: event.endAt ? event.endAt.toISOString() : null,
      allDay: event.allDay,
      calendarState: deriveEventCalendarState(event.startAt, event.endAt, now),
      eventType: event.eventType,
      location: event.location,
      meetingUrl: event.meetingUrl,
      business: event.business,
      attendees: event.attendees
        .map((attendee) => userRef(attendee.user))
        .filter((ref): ref is CalendarItemUserRef => ref !== null),
    };
  }

  static eventToResponseDto(event: CalendarEventWithRelations): CalendarEventResponseDto {
    return {
      id: event.id,
      title: event.title,
      description: event.description,
      startAt: event.startAt.toISOString(),
      endAt: event.endAt ? event.endAt.toISOString() : null,
      allDay: event.allDay,
      eventType: event.eventType,
      location: event.location,
      meetingUrl: event.meetingUrl,
      business: event.business,
      createdBy: userRef(event.createdByUser) as CalendarItemUserRef,
      attendees: event.attendees
        .map((attendee) => userRef(attendee.user))
        .filter((ref): ref is CalendarItemUserRef => ref !== null),
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    };
  }
}
