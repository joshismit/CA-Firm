import { z } from 'zod';
import { TenantStatus, SubscriptionStatus } from '@prisma/client';
import { searchPaginationSchema } from '@shared/validators';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Master Admin Validation Schemas
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * All schemas are plain `ZodObject`s (no `.refine()`/`.superRefine()` at the
 * top level) — mirrors every other module's schema file, see
 * `modules/crm/schemas/lead.schema.ts`'s header comment for why.
 *
 * There is no `createTenantSchema` here — tenant provisioning happens through
 * self-service signup (not yet built; see `modules/auth`'s `register()` stub),
 * not an admin "create" action. This mirrors the frontend's own
 * `TenantsListPage.tsx`, whose header comment already documents this as
 * deliberately read-only-plus-status-changes, not full CRUD.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const uuid = z.string().uuid('Must be a valid UUID');

// ─── Auth ───────────────────────────────────────────────────────────────────

export const masterAdminLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

// ─── Params ───────────────────────────────────────────────────────────────────

export const tenantIdParamSchema = z.object({ id: uuid });

// ─── List / Search Query ──────────────────────────────────────────────────────

export const listTenantsQuerySchema = searchPaginationSchema.extend({
  status: z.nativeEnum(TenantStatus).optional(),
});

// ─── Status transition ────────────────────────────────────────────────────────

export const updateTenantStatusSchema = z.object({
  status: z.nativeEnum(TenantStatus),
});

// ─── Plan / limits ─────────────────────────────────────────────────────────────

export const updateTenantLimitsSchema = z.object({
  planCode: z.string().trim().max(50).nullable().optional(),
  subscriptionStatus: z.nativeEnum(SubscriptionStatus).optional(),
  subscriptionExpiresAt: z.coerce.date().nullable().optional(),
  maxUsers: z.coerce.number().int().min(0).nullable().optional(),
  maxClients: z.coerce.number().int().min(0).nullable().optional(),
  maxStorageGb: z.coerce.number().int().min(0).nullable().optional(),
  maxDocuments: z.coerce.number().int().min(0).nullable().optional(),
});
