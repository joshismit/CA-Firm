import { Notification } from '@prisma/client';
import { NotificationResponseDto } from '../dto/notification.res.dto';

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
}
