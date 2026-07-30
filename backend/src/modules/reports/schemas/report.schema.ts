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

export const reportTypeParamSchema = z.object({
  type: z.enum(reportTypeValues),
});

export const reportFiltersQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  staffId: z.string().uuid().optional(),
});

export const reportExportQuerySchema = reportFiltersQuerySchema.extend({
  format: z.enum(reportExportFormatValues),
});
