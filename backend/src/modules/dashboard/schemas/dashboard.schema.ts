import { z } from 'zod';
import { DASHBOARD_WIDGET_DATA_IDS } from '../constants/dashboard-widget-ids';

/**
 * `GET /dashboard/widgets?ids=pending-works,due-dates` — comma-separated list, each id
 * validated against the fixed `DASHBOARD_WIDGET_DATA_IDS` catalog (unlike
 * `dashboard-preference.schema.ts`'s `widgetId`, which is deliberately opaque — this
 * endpoint has to know exactly which id maps to which aggregation, see that constants
 * file's header comment).
 */
export const getDashboardWidgetDataQuerySchema = z.object({
  ids: z
    .string()
    .min(1, 'ids is required')
    .transform((value) => value.split(',').map((id) => id.trim()))
    .pipe(z.array(z.enum(DASHBOARD_WIDGET_DATA_IDS)).min(1).max(DASHBOARD_WIDGET_DATA_IDS.length)),
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

export const getDashboardCalendarQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const getDashboardActivityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const getDashboardPerformanceQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
