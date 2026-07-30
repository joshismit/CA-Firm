import { NotificationChannel, NotificationStatus } from '@prisma/client';

/**
 * Response DTO — field-for-field match with the frontend's already-built
 * `Notification` type (frontend/src/modules/notifications/types/index.ts).
 * Deliberately omits `tenantId`/`userId` — internal ownership fields, never
 * exposed to the client (the caller already knows these are "their own"
 * notifications; there is nothing to disclose).
 */
export interface NotificationResponseDto {
  id: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}
