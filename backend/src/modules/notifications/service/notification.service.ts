import { Request } from 'express';
import { AuditEventType, Notification } from '@prisma/client';
import { prisma } from '@config/database';
import { BaseService } from '@shared/base';
import { ConflictError } from '@shared/errors';
import { PaginationMeta } from '@shared/types';
// Concrete path — see `notification-dispatch.service.ts`'s identical comment for why.
import { AuditLogRecorder } from '@modules/audit/service/audit-log.recorder';
import { NotificationRepository } from '../repository/notification.repository';
import { NotificationDispatchService } from './notification-dispatch.service';
import { NotificationDashboardReader, NotificationDashboardWidgets } from './notification-dashboard.reader';
import {
  ListNotificationsQueryDto,
  ListNotificationsHistoryQueryDto,
  SendNotificationDto,
  ScheduleNotificationDto,
  TestNotificationDto,
} from '../dto/notification.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Notification Service
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Business logic for `Notification`. No HTTP concerns — the controller
 * passes plain values in and gets domain entities back, exactly like every
 * other module's service.
 *
 * Two distinct surfaces share this one class, gated differently at the route
 * level (`routes/notification.routes.ts`):
 *   - Personal inbox (`listNotifications`/`getNotificationById`/`markAsRead`/
 *     `markAllAsRead`/`deleteNotification`) — every method scopes by
 *     `this.userId` in addition to `this.tenantId`, ungated (self-service,
 *     matches every existing precedent in this module).
 *   - Admin/tenant-wide (`listHistory`/`sendNotification`/`scheduleNotification`/
 *     `sendTestNotification`/`cancelNotification`/`getDashboardWidgets`) —
 *     gated by `NOTIFICATION_PERMISSIONS` at the route level; delegates the
 *     actual send/cancel to `NotificationDispatchService`, never duplicating
 *     its logic.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class NotificationService extends BaseService {
  constructor(
    req: Request,
    private readonly repository: NotificationRepository = new NotificationRepository(prisma),
    private readonly auditLogRecorder: AuditLogRecorder = new AuditLogRecorder(),
    private readonly dispatchService: NotificationDispatchService = new NotificationDispatchService(),
    private readonly dashboardReader: NotificationDashboardReader = new NotificationDashboardReader(),
  ) {
    super(req);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Personal inbox (self-service, ungated)
  // ────────────────────────────────────────────────────────────────────────────

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

    if (count > 0) {
      // PRD §11.13 — emitted only here (one row per batch action), not from every individual
      // `markAsRead(id)` call — see AuditEventType.NOTIFICATION_READ's schema comment.
      await this.auditLogRecorder.record({
        tenantId: this.tenantId as string,
        actorId: this.userId as string,
        eventType: AuditEventType.NOTIFICATION_READ,
        description: `Marked ${count} notification(s) as read`,
        targetType: 'Notification',
      });
    }
  }

  async deleteNotification(id: string): Promise<void> {
    const deleted = await this.repository.deleteForUser(id, this.userId as string, { tenantId: this.tenantId });
    if (!deleted) {
      this.throwNotFound('Notification');
    }
    this.logger.info({ notificationId: id }, 'Notification deleted');
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Admin / tenant-wide (gated by NOTIFICATION_PERMISSIONS at the route level)
  // ────────────────────────────────────────────────────────────────────────────

  async listHistory(query: ListNotificationsHistoryQueryDto): Promise<{ data: Notification[]; meta: PaginationMeta }> {
    return this.repository.searchHistory(
      {
        userId: query.userId,
        channel: query.channel,
        status: query.status,
        createdFrom: query.createdFrom,
        createdTo: query.createdTo,
      },
      { page: query.page, limit: query.limit, sortBy: query.sortBy, sortOrder: query.sortOrder },
      { tenantId: this.tenantId },
    );
  }

  async sendNotification(dto: SendNotificationDto): Promise<Notification[]> {
    this.logger.info({ userId: dto.userId, channels: dto.channels }, 'Admin-initiated notification send');

    return this.dispatchService.send({
      tenantId: this.tenantId as string,
      userId: dto.userId,
      title: dto.title,
      message: dto.message,
      channels: dto.channels,
      priority: dto.priority,
      dedupeKey: dto.dedupeKey,
      templateKey: dto.templateKey,
      templateContext: dto.templateContext,
      actorId: this.userId as string,
    });
  }

  async scheduleNotification(dto: ScheduleNotificationDto): Promise<Notification[]> {
    this.logger.info({ userId: dto.userId, channels: dto.channels, scheduledFor: dto.scheduledFor }, 'Admin-initiated notification schedule');

    return this.dispatchService.send({
      tenantId: this.tenantId as string,
      userId: dto.userId,
      title: dto.title,
      message: dto.message,
      channels: dto.channels,
      priority: dto.priority,
      dedupeKey: dto.dedupeKey,
      templateKey: dto.templateKey,
      templateContext: dto.templateContext,
      scheduledFor: dto.scheduledFor,
      actorId: this.userId as string,
    });
  }

  /** Sends a fixed test message to the CALLING admin's own `userId` on the given channel — reuses `send()` rather than a parallel non-persisted path, so a test notification shows up in history exactly like a real one. */
  async sendTestNotification(dto: TestNotificationDto): Promise<Notification[]> {
    this.logger.info({ channel: dto.channel }, 'Sending test notification');

    return this.dispatchService.send({
      tenantId: this.tenantId as string,
      userId: this.userId as string,
      title: 'Test notification',
      message: 'This is a test notification from your notification settings.',
      channels: [dto.channel],
      actorId: this.userId as string,
    });
  }

  async cancelNotification(id: string): Promise<void> {
    const cancelled = await this.dispatchService.cancel(id, { tenantId: this.tenantId as string, actorId: this.userId as string });
    if (!cancelled) {
      throw new ConflictError('Notification not found, or it is no longer pending and cannot be cancelled.');
    }
    this.logger.info({ notificationId: id }, 'Notification cancelled');
  }

  async getDashboardWidgets(): Promise<NotificationDashboardWidgets> {
    return this.dashboardReader.getWidgets(this.tenantId as string, this.userId as string);
  }
}
