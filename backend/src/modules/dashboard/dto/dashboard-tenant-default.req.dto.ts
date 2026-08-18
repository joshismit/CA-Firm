import { z } from 'zod';
import { updateDashboardTenantDefaultSchema } from '../schemas/dashboard-tenant-default.schema';

export type UpdateDashboardTenantDefaultDto = z.infer<typeof updateDashboardTenantDefaultSchema>;
