import { z } from 'zod';

/**
 * Extracted from `modules/business/schemas/business.schema.ts` alongside
 * `pan.validator.ts` — see that file's header comment for why this one and
 * not pagination/tenant-scoping/soft-delete utilities.
 */
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const gstinSchema = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .pipe(z.string().regex(GSTIN_REGEX, 'Enter a valid GSTIN'));
