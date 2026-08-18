import { z } from 'zod';
import { BusinessStatus } from '@prisma/client';
import { searchPaginationSchema, paginationSchema, panSchema, gstinSchema } from '@shared/validators';

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
// PRD §8.3 — the name the business trades/operates under, when different from `legalName`.
const tradeName = z.string().trim().max(255, 'Trade name cannot exceed 255 characters');

// PAN/GSTIN normalization (trim → uppercase → format check) is shared with modules/contacts —
// see @shared/validators/pan.validator.ts / gstin.validator.ts.
const pan = panSchema;
const gstin = gstinSchema;

const cin = z.string().trim().max(21, 'CIN cannot exceed 21 characters');
// No dedicated `@shared/validators` entry for DIN/TAN exists (only PAN/GSTIN do) — plain
// trimmed/length-capped strings, matching `cin`'s own validator style, not an invented regex.
const din = z.string().trim().max(20, 'DIN cannot exceed 20 characters');
const tan = z.string().trim().max(10, 'TAN cannot exceed 10 characters');
const industry = z.string().trim().max(100, 'Industry cannot exceed 100 characters');
const financialYearStart = z.coerce.number().int().min(1).max(12);
const website = z.string().trim().max(255, 'Website cannot exceed 255 characters').url('Enter a valid URL');
const phone = z.string().trim().max(30, 'Phone cannot exceed 30 characters');
const email = z.string().trim().max(255, 'Email cannot exceed 255 characters').email('Enter a valid email');

// ─── Create ───────────────────────────────────────────────────────────────────

export const createBusinessSchema = z.object({
  typeId: uuid,
  name: businessName,
  legalName: legalName.optional(),
  tradeName: tradeName.optional(),
  pan: pan.optional(),
  gstin: gstin.optional(),
  cin: cin.optional(),
  din: din.optional(),
  tan: tan.optional(),
  incorporationDate: z.coerce.date().optional(),
  financialYearStart: financialYearStart.optional(),
  industry: industry.optional(),
  website: website.optional(),
  phone: phone.optional(),
  email: email.optional(),
});

// ─── Update ───────────────────────────────────────────────────────────────────
// typeId is immutable after creation (mirrors Project's clientId/code) — no
// reassignment endpoint for it exists here or on the frontend.

// `storageQuotaMb` (PRD §7.4) — per-business storage quota override in MB. `null` reverts to the
// tenant's `TenantSettings.defaultBusinessStorageQuotaMb` (itself falling back to the global
// 500 MB default) — see `StorageQuotaService`.
const storageQuotaMb = z.coerce.number().int().min(1, 'Storage quota must be at least 1 MB');

export const updateBusinessSchema = z.object({
  name: businessName.optional(),
  legalName: legalName.nullable().optional(),
  tradeName: tradeName.nullable().optional(),
  pan: pan.nullable().optional(),
  gstin: gstin.nullable().optional(),
  cin: cin.nullable().optional(),
  din: din.nullable().optional(),
  tan: tan.nullable().optional(),
  incorporationDate: z.coerce.date().nullable().optional(),
  financialYearStart: financialYearStart.nullable().optional(),
  industry: industry.nullable().optional(),
  website: website.nullable().optional(),
  phone: phone.nullable().optional(),
  email: email.nullable().optional(),
  storageQuotaMb: storageQuotaMb.nullable().optional(),
});

// ─── Params ───────────────────────────────────────────────────────────────────

export const businessIdParamSchema = z.object({ id: uuid });

/** PRD §8.11 — pagination for `GET /business/:id/timeline`. */
export const businessTimelineQuerySchema = paginationSchema;

// ─── List / Search Query ──────────────────────────────────────────────────────
// `assignedStaffUserId` closes the "search by assigned staff" PRD §8.9 gap —
// filters to businesses with a `BusinessAssignment` for that user.

export const listBusinessesQuerySchema = searchPaginationSchema.extend({
  typeId: uuid.optional(),
  status: z.nativeEnum(BusinessStatus).optional(),
  assignedStaffUserId: uuid.optional(),
});

// ─── Staff Assignment (PRD §8.5) ─────────────────────────────────────────────
// `role` is free text (e.g. "Relationship Manager"/"Accountant"/"Auditor"/"Reviewer")
// rather than a fixed enum — mirrors `BusinessAssignment.role`'s own VarChar(50)
// column, which has no corresponding Prisma enum.

export const assignBusinessSchema = z.object({
  userId: uuid,
  role: z.string().trim().min(1, 'Role is required').max(50, 'Role cannot exceed 50 characters'),
});

export const businessAssignmentParamSchema = z.object({ id: uuid, userId: uuid });

// ─── Notes (PRD §8.6) ─────────────────────────────────────────────────────────
// Exact mirror of `modules/crm/schemas/lead.schema.ts`'s `createLeadNoteSchema`.

export const createBusinessNoteSchema = z.object({
  content: z.string().trim().min(1, 'Content is required').max(5000, 'Content cannot exceed 5000 characters'),
  documentId: uuid.optional(),
});
