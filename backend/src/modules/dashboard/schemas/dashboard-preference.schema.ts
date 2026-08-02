import { z } from 'zod';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Dashboard Preference Validation Schemas
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `widgets` is an ordered array — array index IS display order, so there is
 * no separate `order` field to validate. `widgetId` is an opaque string this
 * module never interprets (the frontend's own widget registry owns the
 * catalog of valid ids, labels, and permission gates); the backend only
 * checks shape, never membership in a fixed id list, so new widgets the
 * frontend adds later never require a backend change. Capped at 50 entries —
 * comfortably above any realistic dashboard's widget count — to keep the
 * JSON payload bounded.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const widgetPreferenceSchema = z.object({
  widgetId: z.string().min(1, 'widgetId is required').max(60, 'widgetId must be at most 60 characters'),
  visible: z.boolean(),
});

export const updateDashboardPreferencesSchema = z.object({
  widgets: z.array(widgetPreferenceSchema).max(50, 'A dashboard may have at most 50 widgets'),
});
