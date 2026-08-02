import { widgetPreferenceSchema, updateDashboardPreferencesSchema } from '@modules/dashboard/schemas/dashboard-preference.schema';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Dashboard Preference Zod Schemas — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 * Exercises the schemas directly (`.safeParse()`), independent of Express/
 * `validate()` middleware. Mirrors `tests/unit/modules/notifications/
 * notification.schema.spec.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

describe('widgetPreferenceSchema', () => {
  it('accepts a well-formed widget preference', () => {
    expect(widgetPreferenceSchema.safeParse({ widgetId: 'task-summary', visible: true }).success).toBe(true);
  });

  it('rejects an empty widgetId', () => {
    expect(widgetPreferenceSchema.safeParse({ widgetId: '', visible: true }).success).toBe(false);
  });

  it('rejects a widgetId longer than 60 characters', () => {
    expect(widgetPreferenceSchema.safeParse({ widgetId: 'x'.repeat(61), visible: true }).success).toBe(false);
  });

  it('accepts a widgetId exactly 60 characters long', () => {
    expect(widgetPreferenceSchema.safeParse({ widgetId: 'x'.repeat(60), visible: true }).success).toBe(true);
  });

  it('rejects a missing visible field', () => {
    expect(widgetPreferenceSchema.safeParse({ widgetId: 'task-summary' }).success).toBe(false);
  });

  it('rejects a non-boolean visible field', () => {
    expect(widgetPreferenceSchema.safeParse({ widgetId: 'task-summary', visible: 'yes' }).success).toBe(false);
  });
});

describe('updateDashboardPreferencesSchema', () => {
  it('accepts an empty widgets array', () => {
    expect(updateDashboardPreferencesSchema.safeParse({ widgets: [] }).success).toBe(true);
  });

  it('accepts a list of valid widget preferences, preserving order', () => {
    const widgets = [
      { widgetId: 'kpi-stats', visible: true },
      { widgetId: 'task-summary', visible: false },
    ];
    const result = updateDashboardPreferencesSchema.safeParse({ widgets });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.widgets).toEqual(widgets);
  });

  it('rejects a missing widgets field', () => {
    expect(updateDashboardPreferencesSchema.safeParse({}).success).toBe(false);
  });

  it('rejects more than 50 widgets', () => {
    const widgets = Array.from({ length: 51 }, (_, i) => ({ widgetId: `widget-${i}`, visible: true }));
    expect(updateDashboardPreferencesSchema.safeParse({ widgets }).success).toBe(false);
  });

  it('accepts exactly 50 widgets', () => {
    const widgets = Array.from({ length: 50 }, (_, i) => ({ widgetId: `widget-${i}`, visible: true }));
    expect(updateDashboardPreferencesSchema.safeParse({ widgets }).success).toBe(true);
  });

  it('rejects when any single widget entry is malformed', () => {
    const widgets = [{ widgetId: 'kpi-stats', visible: true }, { widgetId: '', visible: false }];
    expect(updateDashboardPreferencesSchema.safeParse({ widgets }).success).toBe(false);
  });
});
