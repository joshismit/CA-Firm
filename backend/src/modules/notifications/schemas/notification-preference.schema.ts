import { z } from 'zod';
import { NotificationDigestFrequency } from '@prisma/client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Notification Preference / Firm Settings Validation Schemas
 * ─────────────────────────────────────────────────────────────────────────────
 * Plain `ZodObject`s only (no `.refine()`) — same reasoning as
 * `task-template.schema.ts`'s header comment.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const quietHour = z.coerce.number().int().min(0).max(23);

export const updateNotificationPreferenceSchema = z.object({
  emailEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  whatsappEnabled: z.boolean().optional(),
  digestFrequency: z.nativeEnum(NotificationDigestFrequency).optional(),
  quietHoursStart: quietHour.nullable().optional(),
  quietHoursEnd: quietHour.nullable().optional(),
  muteUntil: z.coerce.date().nullable().optional(),
});

export const updateFirmNotificationSettingsSchema = z.object({
  emailEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  whatsappEnabled: z.boolean().optional(),
  defaultQuietHoursStart: quietHour.nullable().optional(),
  defaultQuietHoursEnd: quietHour.nullable().optional(),
});
