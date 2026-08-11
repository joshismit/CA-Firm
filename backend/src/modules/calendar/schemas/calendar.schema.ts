import { z } from 'zod';
import { TaskStatus, CalendarEventType } from '@prisma/client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Work Calendar Validation Schemas
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Plain `ZodObject`s only (no top-level `.refine()`), same reasoning as
 * `modules/tasks/schemas/task.schema.ts`'s header comment — `validate()`
 * types `body`/`params`/`query` as `AnyZodObject`. Cross-field checks
 * (`endAt >= startAt`) are validated in `CalendarEventService`, not here.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const uuid = z.string().uuid('Must be a valid UUID');

const eventTitle = z
  .string()
  .trim()
  .min(2, 'Title must be at least 2 characters')
  .max(255, 'Title cannot exceed 255 characters');

const eventDescription = z.string().trim().max(5000, 'Description cannot exceed 5000 characters');
const eventLocation = z.string().trim().max(255, 'Location cannot exceed 255 characters');
const eventMeetingUrl = z.string().trim().max(500).url('Must be a valid URL');

// ─── GET /calendar ──────────────────────────────────────────────────────────

/**
 * `from`/`to` are required (not optional, unlike `/dashboard/calendar`'s own
 * query schema) — the Work Calendar always renders a specific view (month/
 * week/day/agenda) with a known visible range; an unbounded query would risk
 * the "load the entire tenant's task history" failure mode (PRD §22).
 */
export const calendarQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  /** 'mine' (default) = assigned-to-me tasks + events I created or attend. 'firm' = tenant-wide, only honored for unrestricted roles (PRD §11). */
  scope: z.enum(['mine', 'firm']).optional().default('mine'),
  businessId: uuid.optional(),
  /** Filters to a specific staff member's work — combined with `scope=firm` (ignored under `scope=mine`, which always means "me"). */
  staffId: uuid.optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  eventType: z.nativeEnum(CalendarEventType).optional(),
  /** Omit to include both Tasks and CalendarEvents. */
  source: z.enum(['TASK', 'EVENT']).optional(),
});

// ─── CalendarEvent CRUD ─────────────────────────────────────────────────────

export const createCalendarEventSchema = z.object({
  title: eventTitle,
  description: eventDescription.optional(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date().optional(),
  allDay: z.boolean().optional(),
  eventType: z.nativeEnum(CalendarEventType).optional(),
  location: eventLocation.optional(),
  meetingUrl: eventMeetingUrl.optional(),
  businessId: uuid.optional(),
  attendeeIds: z.array(uuid).max(50, 'Cannot invite more than 50 attendees').optional(),
});

export const updateCalendarEventSchema = z.object({
  title: eventTitle.optional(),
  description: eventDescription.nullable().optional(),
  startAt: z.coerce.date().optional(),
  endAt: z.coerce.date().nullable().optional(),
  allDay: z.boolean().optional(),
  eventType: z.nativeEnum(CalendarEventType).optional(),
  location: eventLocation.nullable().optional(),
  meetingUrl: eventMeetingUrl.nullable().optional(),
  businessId: uuid.nullable().optional(),
  attendeeIds: z.array(uuid).max(50, 'Cannot invite more than 50 attendees').optional(),
});

export const calendarEventIdParamSchema = z.object({ id: uuid });
