// Zod schema for the CalendarEvent create/edit form. Mirrors backend/src/modules/calendar/schemas/calendar.schema.ts.

import { z } from 'zod'

const eventTitle = z.string().trim().min(2, 'Title must be at least 2 characters').max(255)

export const calendarEventTypeValues = [
  'CLIENT_MEETING',
  'INTERNAL_MEETING',
  'CALL',
  'APPOINTMENT',
  'AUDIT',
  'REVIEW',
  'OTHER',
] as const

export const calendarEventFormSchema = z
  .object({
    title: eventTitle,
    description: z.string().trim().max(2000).optional(),
    eventType: z.enum(calendarEventTypeValues),
    startAt: z.coerce.date(),
    endAt: z.coerce.date().optional(),
    allDay: z.boolean(),
    location: z.string().trim().max(255).optional(),
    // Empty string coerced to undefined so an untouched optional field doesn't fail `.url()`.
    meetingUrl: z
      .string()
      .trim()
      .url('Must be a valid URL')
      .optional()
      .or(z.literal(''))
      .transform((value) => (value === '' ? undefined : value)),
    businessId: z.string().uuid().optional(),
    attendeeIds: z.array(z.string().uuid()).default([]),
  })
  .refine((values) => !values.endAt || values.endAt.getTime() >= values.startAt.getTime(), {
    message: 'End must not be before start',
    path: ['endAt'],
  })

export type CalendarEventFormInput = z.input<typeof calendarEventFormSchema>
export type CalendarEventFormValues = z.infer<typeof calendarEventFormSchema>
