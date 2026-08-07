import { z } from 'zod';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Report Validation Schemas
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `reportTypeValues` matches frontend/src/modules/reports/types/index.ts's
 * `ReportType` union exactly (8 fixed values) — never add, rename, or
 * remove an entry. `reportFiltersQuerySchema` mirrors the frontend's
 * `reportFiltersSchema` (frontend/src/modules/reports/schemas/index.ts)
 * field-for-field. Reports have no Prisma model of their own — `ReportType`
 * is a plain string literal union, not backed by a Prisma enum.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const reportTypeValues = [
  'NEW_LEADS',
  'CONVERTED_CLIENTS',
  'PENDING_TASKS',
  'PENDING_DOCUMENTS',
  'PAYMENTS_PENDING',
  'DOCUMENT_ACTIVITY',
  'STAFF_ASSIGNMENT_SUMMARY',
  'MONTHLY_PENDING_WORK',
] as const;

export const reportExportFormatValues = ['CSV', 'PDF', 'XLSX'] as const;

/**
 * PRD §13.2 — the union of every `groupBy` value any report type supports
 * (`ReportsRepository.ReportGroupBy`). Deliberately NOT cross-validated
 * against `type` here — `validate()` (`middlewares/validation.middleware.ts`)
 * validates `params`/`query` as two independent schemas, so there is no
 * single-schema place to enforce "only SOURCE/OWNER is valid for NEW_LEADS".
 * Each `ReportsRepository` finder instead only honors the `groupBy` values
 * it recognizes and silently falls through to its flat (ungrouped) shape for
 * any other value — a mismatched combination is a no-op, never a 422.
 */
export const reportGroupByValues = ['SOURCE', 'OWNER', 'STAFF', 'PRIORITY', 'STATUS', 'DUE_DATE', 'BUSINESS', 'DATE'] as const;

export const reportTypeParamSchema = z.object({
  type: z.enum(reportTypeValues),
});

export const reportFiltersQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  staffId: z.string().uuid().optional(),
  groupBy: z.enum(reportGroupByValues).optional(),
});

export const reportExportQuerySchema = reportFiltersQuerySchema.extend({
  format: z.enum(reportExportFormatValues),
});
