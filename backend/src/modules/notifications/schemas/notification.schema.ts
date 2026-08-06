import { z } from 'zod';
import { NotificationChannel, NotificationStatus, NotificationPriority } from '@prisma/client';
import { searchPaginationSchema } from '@shared/validators';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Notification Validation Schemas
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * No create/update body schemas — notifications are system-generated (see
 * `service/notification.service.ts`'s header comment); this module only
 * ever reads, marks-read, and deletes, and none of those take a request
 * body. `unreadOnly` mirrors the frontend's `NotificationListFilters.unreadOnly`
 * exactly (frontend/src/modules/notifications/types/index.ts).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const uuid = z.string().uuid('Must be a valid UUID');

export const notificationIdParamSchema = z.object({ id: uuid });

export const listNotificationsQuerySchema = searchPaginationSchema.extend({
  channel: z.nativeEnum(NotificationChannel).optional(),
  status: z.nativeEnum(NotificationStatus).optional(),
  unreadOnly: z.coerce.boolean().optional(),
});

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PRD §11.11/§11.16/§11.10 — admin surfaces (history, send/schedule/test, cancel).
 * Plain `ZodObject`s only (no `.refine()`) — same reasoning as
 * `task-template.schema.ts`'s header comment.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const listNotificationsHistoryQuerySchema = searchPaginationSchema.extend({
  userId: uuid.optional(),
  channel: z.nativeEnum(NotificationChannel).optional(),
  status: z.nativeEnum(NotificationStatus).optional(),
  createdFrom: z.coerce.date().optional(),
  createdTo: z.coerce.date().optional(),
});

export const sendNotificationSchema = z.object({
  userId: uuid,
  title: z.string().trim().min(1).max(255),
  message: z.string().trim().min(1).max(5000),
  channels: z.array(z.nativeEnum(NotificationChannel)).min(1).max(4),
  priority: z.nativeEnum(NotificationPriority).optional(),
  dedupeKey: z.string().trim().max(200).optional(),
  templateKey: z.string().trim().max(100).optional(),
  templateContext: z.record(z.unknown()).optional(),
});

export const scheduleNotificationSchema = sendNotificationSchema.extend({
  scheduledFor: z.coerce.date(),
});

export const testNotificationSchema = z.object({
  channel: z.nativeEnum(NotificationChannel),
});
