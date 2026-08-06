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

/**
 * `GET /notifications/history` (admin, tenant-wide) — the personal-inbox `NotificationResponseDto`
 * above stays field-for-field frozen to the frontend's existing `Notification` type; this is a
 * separate, additive shape for the new admin surface exposing the PRD §11.11 lifecycle columns.
 */
export interface NotificationHistoryResponseDto extends NotificationResponseDto {
  userId: string;
  retryCount: number;
  providerMessageId: string | null;
  priority: string;
  scheduledFor: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
}
