import { z } from 'zod';
import { BusinessStatus } from '@prisma/client';
import { searchPaginationSchema, panSchema, gstinSchema } from '@shared/validators';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Business Validation Schemas
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * All schemas are plain `ZodObject`s (no `.refine()`/`.superRefine()` at the
 * top level) because `validate()` (@middlewares/validation.middleware) types
 * its `body`/`params`/`query` options as `AnyZodObject` — a `.refine()` call
 * returns a `ZodEffects` wrapper that is not assignable to `AnyZodObject`.
 * Mirrors `modules/projects/schemas/project.schema.ts`.
 *
 * `status` is intentionally not settable through `createBusinessSchema` or
 * `updateBusinessSchema` — the Prisma column defaults to ACTIVE and nothing in
 * the current frontend (BusinessForm) exposes a status control yet. Add a
 * dedicated status-transition schema (mirroring Project's) if/when that UI
 * ships, rather than folding it into the general update payload now.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const uuid = z.string().uuid('Must be a valid UUID');

const businessName = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(255, 'Name cannot exceed 255 characters');

const legalName = z.string().trim().max(255, 'Legal name cannot exceed 255 characters');

// PAN/GSTIN normalization (trim → uppercase → format check) is shared with modules/contacts —
// see @shared/validators/pan.validator.ts / gstin.validator.ts.
const pan = panSchema;
const gstin = gstinSchema;

const cin = z.string().trim().max(21, 'CIN cannot exceed 21 characters');
const industry = z.string().trim().max(100, 'Industry cannot exceed 100 characters');
const financialYearStart = z.coerce.number().int().min(1).max(12);

// ─── Create ───────────────────────────────────────────────────────────────────

export const createBusinessSchema = z.object({
  typeId: uuid,
  name: businessName,
  legalName: legalName.optional(),
  pan: pan.optional(),
  gstin: gstin.optional(),
  cin: cin.optional(),
  incorporationDate: z.coerce.date().optional(),
  financialYearStart: financialYearStart.optional(),
  industry: industry.optional(),
});

// ─── Update ───────────────────────────────────────────────────────────────────
// typeId is immutable after creation (mirrors Project's clientId/code) — no
// reassignment endpoint for it exists here or on the frontend.

export const updateBusinessSchema = z.object({
  name: businessName.optional(),
  legalName: legalName.nullable().optional(),
  pan: pan.nullable().optional(),
  gstin: gstin.nullable().optional(),
  cin: cin.nullable().optional(),
  incorporationDate: z.coerce.date().nullable().optional(),
  financialYearStart: financialYearStart.nullable().optional(),
  industry: industry.nullable().optional(),
});

// ─── Params ───────────────────────────────────────────────────────────────────

export const businessIdParamSchema = z.object({ id: uuid });

// ─── List / Search Query ──────────────────────────────────────────────────────

export const listBusinessesQuerySchema = searchPaginationSchema.extend({
  typeId: uuid.optional(),
  status: z.nativeEnum(BusinessStatus).optional(),
});
