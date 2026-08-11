import { z } from 'zod';
import { calendarQuerySchema, createCalendarEventSchema, updateCalendarEventSchema } from '../schemas/calendar.schema';

/**
 * Request DTOs — inferred from the Zod schemas in `schemas/calendar.schema.ts`.
 * These are the shapes controllers/services receive AFTER `validate()` has run.
 */

export type CalendarQueryDto = z.infer<typeof calendarQuerySchema>;
export type CreateCalendarEventDto = z.infer<typeof createCalendarEventSchema>;
export type UpdateCalendarEventDto = z.infer<typeof updateCalendarEventSchema>;
