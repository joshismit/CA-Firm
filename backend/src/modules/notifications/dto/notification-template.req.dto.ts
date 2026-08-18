import { z } from 'zod';
import {
  createNotificationTemplateSchema,
  updateNotificationTemplateSchema,
  notificationTemplateIdParamSchema,
  listNotificationTemplatesQuerySchema,
} from '../schemas/notification-template.schema';

export type CreateNotificationTemplateDto = z.infer<typeof createNotificationTemplateSchema>;
export type UpdateNotificationTemplateDto = z.infer<typeof updateNotificationTemplateSchema>;
export type NotificationTemplateIdParamDto = z.infer<typeof notificationTemplateIdParamSchema>;
export type ListNotificationTemplatesQueryDto = z.infer<typeof listNotificationTemplatesQuerySchema>;
