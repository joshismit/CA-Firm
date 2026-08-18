// calendar module — public exports
//
// Work Calendar (PRD "Work Calendar"): aggregates existing `Task`s with the
// new minimal `CalendarEvent` entity into one normalized feed. Tasks remain
// the sole source of truth — this module never creates a parallel task
// record, only reads through `TaskService`. `CalendarEventRepository`,
// `CalendarController`, and `CalendarMapper` are deliberately NOT exported —
// internal implementation details. Mirrors `modules/dashboard/index.ts`.

export { default as calendarRoutes } from './routes/calendar.routes';
export type { CalendarItemDto, CalendarItemsResponseDto, CalendarEventResponseDto } from './dto/calendar.res.dto';
export type { CalendarQueryDto, CreateCalendarEventDto, UpdateCalendarEventDto } from './dto/calendar.req.dto';
