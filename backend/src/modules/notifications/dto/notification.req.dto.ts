import { z } from 'zod';
import {
  notificationIdParamSchema,
  listNotificationsQuerySchema,
  listNotificationsHistoryQuerySchema,
  sendNotificationSchema,
  scheduleNotificationSchema,
  testNotificationSchema,
} from '../schemas/notification.schema';

export type NotificationIdParamDto = z.infer<typeof notificationIdParamSchema>;
export type ListNotificationsQueryDto = z.infer<typeof listNotificationsQuerySchema>;
export type ListNotificationsHistoryQueryDto = z.infer<typeof listNotificationsHistoryQuerySchema>;
export type SendNotificationDto = z.infer<typeof sendNotificationSchema>;
export type ScheduleNotificationDto = z.infer<typeof scheduleNotificationSchema>;
export type TestNotificationDto = z.infer<typeof testNotificationSchema>;
