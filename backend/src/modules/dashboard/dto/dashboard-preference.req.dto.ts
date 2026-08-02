import { z } from 'zod';
import { widgetPreferenceSchema, updateDashboardPreferencesSchema } from '../schemas/dashboard-preference.schema';

export type WidgetPreferenceDto = z.infer<typeof widgetPreferenceSchema>;
export type UpdateDashboardPreferencesDto = z.infer<typeof updateDashboardPreferencesSchema>;
