import { z } from 'zod';
import {
  masterAdminLoginSchema,
  listTenantsQuerySchema,
  updateTenantStatusSchema,
  updateTenantLimitsSchema,
  createTenantSchema,
} from '../schemas/master-admin.schema';

/**
 * Request DTOs — inferred from the Zod schemas in `schemas/master-admin.schema.ts`.
 * These are the shapes controllers/services receive AFTER `validate()` has run.
 */

export type MasterAdminLoginDto = z.infer<typeof masterAdminLoginSchema>;
export type ListTenantsQueryDto = z.infer<typeof listTenantsQuerySchema>;
export type UpdateTenantStatusDto = z.infer<typeof updateTenantStatusSchema>;
export type UpdateTenantLimitsDto = z.infer<typeof updateTenantLimitsSchema>;
export type CreateTenantDto = z.infer<typeof createTenantSchema>;
