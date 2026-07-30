import { Request } from 'express';
import { Notification } from '@prisma/client';
import { prisma } from '@config/database';
import { BaseService } from '@shared/base';
import { PaginationMeta } from '@shared/types';
import { NotificationRepository } from '../repository/notification.repository';
import { ListNotificationsQueryDto } from '../dto/notification.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Notification Service
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Business logic for `Notification`. No HTTP concerns — the controller
 * passes plain values in and gets domain entities back, exactly like every
 * other module's service.
 *
 * Notifications are system-generated — some future module/event pipeline
 * inserts rows directly (out of scope here, per explicit product
 * direction: no admin broadcast, no manual send, no email/push/SMS
 * delivery). This service only ever reads, marks-read, and deletes.
 *
 * Every method scopes by `this.userId` in addition to `this.tenantId` — a
 * user may only ever see/mark/delete their OWN notifications, never another
 * user's in the same tenant. A missing/mismatched (id, tenant, owner) row
 * surfaces as 404, identical to how a cross-tenant ID surfaces elsewhere in
 * this codebase — never distinguishable from "doesn't exist".
 *
 * Deliberately has no `requirePermission()` gate anywhere in this module's
 * routes (see `routes/notification.routes.ts`'s header comment) — this is a
 * self-service personal inbox, and the frontend's own
 * `NotificationListPage.tsx` explicitly does not wrap mark-as-read/delete in
 * `<Can>`, even though `PERMISSIONS.NOTIFICATIONS_READ`/`MANAGE` exist in
 * the registry (used elsewhere, not here).
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class NotificationService extends BaseService {
  constructor(
    req: Request,
    private readonly repository: NotificationRepository = new NotificationRepository(prisma),
  ) {
    super(req);
  }

  async listNotifications(query: ListNotificationsQueryDto): Promise<{ data: Notification[]; meta: PaginationMeta }> {
    return this.repository.search(
      {
        userId: this.userId as string,
        search: query.search,
        channel: query.channel,
        status: query.status,
        unreadOnly: query.unreadOnly,
      },
      { page: query.page, limit: query.limit, sortBy: query.sortBy, sortOrder: query.sortOrder },
      { tenantId: this.tenantId },
    );
  }

  async getNotificationById(id: string): Promise<Notification> {
    const notification = await this.repository.findByIdForUser(id, this.userId as string, { tenantId: this.tenantId });
    this.validateExists(notification, 'Notification');
    return notification;
  }

  async markAsRead(id: string): Promise<void> {
    const updated = await this.repository.markAsRead(id, this.userId as string, { tenantId: this.tenantId });
    if (!updated) {
      this.throwNotFound('Notification');
    }
    this.logger.info({ notificationId: id }, 'Notification marked as read');
  }

  async markAllAsRead(): Promise<void> {
    const count = await this.repository.markAllAsRead(this.userId as string, { tenantId: this.tenantId });
    this.logger.info({ count }, 'All notifications marked as read');
  }

  async deleteNotification(id: string): Promise<void> {
    const deleted = await this.repository.deleteForUser(id, this.userId as string, { tenantId: this.tenantId });
    if (!deleted) {
      this.throwNotFound('Notification');
    }
    this.logger.info({ notificationId: id }, 'Notification deleted');
  }
}
