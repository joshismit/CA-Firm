import { z } from 'zod';
import { UserRole } from '@shared/enums';
import { widgetPreferenceSchema } from './dashboard-preference.schema';

/**
 * PRD §10.3 — tenant-admin-configurable default widget layout per coarse `UserRole`.
 * Reuses `widgetPreferenceSchema` unchanged — a tenant default is shaped identically
 * to a personal preference, just stored one level up (tenant+role instead of user).
 */
export const updateDashboardTenantDefaultSchema = z.object({
  widgets: z.array(widgetPreferenceSchema).max(50, 'A dashboard may have at most 50 widgets'),
});

export const dashboardTenantDefaultRoleParamSchema = z.object({
  role: z.nativeEnum(UserRole),
});
