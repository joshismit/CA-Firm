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

/** PRD §10.4 — Tailwind col-span size a widget renders at, mirroring the frontend's own `WidgetSize` union (`frontend/src/modules/dashboard/constants/index.ts`). Opaque to the backend beyond shape validation, same as `widgetId`. */
const widgetSizeSchema = z.enum(['full', 'two-thirds', 'third', 'half', 'quarter']);

export const widgetPreferenceSchema = z.object({
  widgetId: z.string().min(1, 'widgetId is required').max(60, 'widgetId must be at most 60 characters'),
  visible: z.boolean(),
  /** PRD §10.2/§10.4 — per-widget layout overrides. All optional: an entry that omits them keeps the registry's own default. */
  size: widgetSizeSchema.optional(),
  collapsed: z.boolean().optional(),
  pinned: z.boolean().optional(),
});

export const updateDashboardPreferencesSchema = z.object({
  widgets: z.array(widgetPreferenceSchema).max(50, 'A dashboard may have at most 50 widgets'),
  /** PRD §10.2 — whole-dashboard auto-refresh cadence in seconds. `null` clears it (falls back to the frontend's own default interval). */
  refreshIntervalSeconds: z.number().int().min(15).max(3600).nullable().optional(),
});
