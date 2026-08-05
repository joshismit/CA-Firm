import { z } from 'zod';
import { updateStorageSettingsSchema } from '../schemas/storage-settings.schema';

export type UpdateStorageSettingsDto = z.infer<typeof updateStorageSettingsSchema>;
