import { z } from 'zod';
import { updateNotificationPreferenceSchema, updateFirmNotificationSettingsSchema } from '../schemas/notification-preference.schema';

export type UpdateNotificationPreferenceDto = z.infer<typeof updateNotificationPreferenceSchema>;
export type UpdateFirmNotificationSettingsDto = z.infer<typeof updateFirmNotificationSettingsSchema>;
