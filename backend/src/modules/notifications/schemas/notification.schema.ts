import { z } from 'zod';
import { NotificationChannel, NotificationStatus } from '@prisma/client';
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
