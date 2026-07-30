import { z } from 'zod';
import { notificationIdParamSchema, listNotificationsQuerySchema } from '../schemas/notification.schema';

export type NotificationIdParamDto = z.infer<typeof notificationIdParamSchema>;
export type ListNotificationsQueryDto = z.infer<typeof listNotificationsQuerySchema>;
