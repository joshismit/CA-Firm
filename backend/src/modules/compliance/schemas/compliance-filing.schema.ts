import { z } from 'zod';
import { ComplianceFilingStatus } from '@prisma/client';
import { searchPaginationSchema } from '@shared/validators';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Compliance Filing Validation Schemas
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Field-for-field match with the frontend's already-built schemas
 * (frontend/src/modules/compliance/schemas/index.ts) — `createComplianceFilingSchema`/
 * `updateComplianceFilingSchema` here mirror those exactly (same fields,
 * same limits, `updateComplianceFilingSchema` is a `.partial()` of
 * `createComplianceFilingSchema` there too). Deliberately has no `status` or
 * `filedDate` field — the frontend's `CreateComplianceFilingPayload`/
 * `UpdateComplianceFilingPayload` never collect either (see
 * `service/compliance-filing.service.ts`'s header comment for why).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const uuid = z.string().uuid('Must be a valid UUID');

export const createComplianceFilingSchema = z.object({
  reference: z.string().trim().min(2, 'Reference must be at least 2 characters').max(100),
  period: z.string().trim().min(2, 'Period must be at least 2 characters').max(50),
  dueDate: z.coerce.date().optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const updateComplianceFilingSchema = createComplianceFilingSchema.partial();

// ─── Params ───────────────────────────────────────────────────────────────────

export const complianceFilingIdParamSchema = z.object({ id: uuid });

// ─── List / Search Query ──────────────────────────────────────────────────────

export const listComplianceFilingsQuerySchema = searchPaginationSchema.extend({
  status: z.nativeEnum(ComplianceFilingStatus).optional(),
});
