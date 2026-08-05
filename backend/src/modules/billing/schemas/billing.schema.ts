import { z } from 'zod';
import { BillingCycle } from '@prisma/client';
import { searchPaginationSchema } from '@shared/validators';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Billing Validation Schemas
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * All schemas are plain `ZodObject`s (no `.refine()`/`.superRefine()` at the
 * top level) — mirrors every other module's schema file, see
 * `modules/crm/schemas/lead.schema.ts`'s header comment for why.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const uuid = z.string().uuid('Must be a valid UUID');
const planCode = z.string().trim().toUpperCase().max(50);

// ─── Plan catalog (master-admin write side) ────────────────────────────────────

export const createPlanSchema = z.object({
  code: planCode,
  name: z.string().trim().min(2).max(100),
  billingCycle: z.nativeEnum(BillingCycle),
  priceInPaise: z.coerce.number().int().min(0),
  maxUsers: z.coerce.number().int().min(0).nullable().optional(),
  maxClients: z.coerce.number().int().min(0).nullable().optional(),
  maxStorageGb: z.coerce.number().int().min(0).nullable().optional(),
  maxDocuments: z.coerce.number().int().min(0).nullable().optional(),
  // PRD §7.4 — per-file upload size ceiling in MB for tenants on this plan.
  maxUploadSizeMb: z.coerce.number().int().min(0).nullable().optional(),
  displayOrder: z.coerce.number().int().min(0).optional(),
});

export const updatePlanSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  priceInPaise: z.coerce.number().int().min(0).optional(),
  maxUsers: z.coerce.number().int().min(0).nullable().optional(),
  maxClients: z.coerce.number().int().min(0).nullable().optional(),
  maxStorageGb: z.coerce.number().int().min(0).nullable().optional(),
  maxDocuments: z.coerce.number().int().min(0).nullable().optional(),
  maxUploadSizeMb: z.coerce.number().int().min(0).nullable().optional(),
  displayOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.coerce.boolean().optional(),
});

export const planIdParamSchema = z.object({ id: uuid });

export const listPlansQuerySchema = searchPaginationSchema.extend({});

// ─── Checkout (tenant-facing) ───────────────────────────────────────────────────

export const createCheckoutSessionSchema = z.object({
  planCode,
});

export const verifyCheckoutPaymentSchema = z.object({
  razorpayOrderId: z.string().trim().min(1),
  razorpayPaymentId: z.string().trim().min(1),
  razorpaySignature: z.string().trim().min(1),
});

export const listInvoicesQuerySchema = searchPaginationSchema.extend({});
