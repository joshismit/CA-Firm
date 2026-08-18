import { z } from 'zod';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PAN Validator
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Extracted from `modules/business/schemas/business.schema.ts` once
 * `modules/contacts` needed the identical trim → uppercase → format-check
 * pipeline for its own `pan` field — a genuine duplication, unlike pagination/
 * tenant-scoping/soft-delete, which `BaseRepository` already centralizes.
 *
 * Trims and normalizes to uppercase before validating format, so "abcde1234f"
 * and "ABCDE1234F" both pass and the *value* actually stored is uppercase -
 * not just visually uppercase via CSS on the frontend.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export const panSchema = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .pipe(z.string().regex(PAN_REGEX, 'Enter a valid PAN'));
