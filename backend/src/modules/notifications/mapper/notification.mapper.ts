import { Notification } from '@prisma/client';
import { NotificationHistoryResponseDto, NotificationResponseDto } from '../dto/notification.res.dto';

/**
 * Entity ⇄ DTO mapper for `Notification`. Controllers/services must always
 * return data through this mapper — never serialize a raw Prisma row.
 */
export class NotificationMapper {
  static toResponseDto(notification: Notification): NotificationResponseDto {
    return {
      id: notification.id,
      channel: notification.channel,
      status: notification.status,
      title: notification.title,
      message: notification.message,
      isRead: notification.isRead,
      createdAt: notification.createdAt.toISOString(),
    };
  }

  static toResponseDtoList(notifications: Notification[]): NotificationResponseDto[] {
    return notifications.map((notification) => this.toResponseDto(notification));
  }

  static toHistoryResponseDto(notification: Notification): NotificationHistoryResponseDto {
    return {
      ...this.toResponseDto(notification),
      userId: notification.userId,
      retryCount: notification.retryCount,
      providerMessageId: notification.providerMessageId,
      priority: notification.priority,
      scheduledFor: notification.scheduledFor?.toISOString() ?? null,
      sentAt: notification.sentAt?.toISOString() ?? null,
      deliveredAt: notification.deliveredAt?.toISOString() ?? null,
      cancelledAt: notification.cancelledAt?.toISOString() ?? null,
    };
  }

  static toHistoryResponseDtoList(notifications: Notification[]): NotificationHistoryResponseDto[] {
    return notifications.map((notification) => this.toHistoryResponseDto(notification));
  }
}
