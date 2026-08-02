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
 * `createTenantSchema` provisions a tenant AND its owner's bootstrap invite in
 * one call — self-service signup (`modules/auth`'s `register()` stub) is
 * still not built, so a master admin creating the tenant is the only
 * provisioning path (see `TenantService.createTenant()`).
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

// ─── Create tenant (+ owner bootstrap invite) ──────────────────────────────────

export const createTenantSchema = z.object({
  name: z.string().trim().min(1, 'Firm name is required').max(255, 'Firm name cannot exceed 255 characters'),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .max(100, 'Slug cannot exceed 100 characters')
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Slug may only contain lowercase letters, numbers, and hyphens')
    .optional(),
  country: z.string().trim().length(2, 'Country must be a 2-letter code').optional(),
  timezone: z.string().trim().max(100).optional(),
  locale: z.string().trim().max(20).optional(),
  defaultCurrency: z.string().trim().length(3, 'Currency must be a 3-letter code').optional(),
  planCode: z.string().trim().max(50).optional(),
  ownerFirstName: z.string().trim().min(1, 'Owner first name is required').max(100, 'Owner first name cannot exceed 100 characters'),
  ownerLastName: z.string().trim().min(1, 'Owner last name is required').max(100, 'Owner last name cannot exceed 100 characters'),
  ownerEmail: z.string().trim().min(1, 'Owner email is required').email('Enter a valid email address'),
});
