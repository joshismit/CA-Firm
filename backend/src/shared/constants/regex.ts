/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Regex Constants — Validation Patterns
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * PURPOSE:
 *   Centralised, tested regex patterns for all field-level validation.
 *   Used by Zod validators in `shared/validators/` — never inline in schemas.
 *
 * RULES:
 *   - Every pattern must have a descriptive JSDoc comment.
 *   - Patterns are frozen — import and use; never mutate.
 *   - Indian regulatory patterns (PAN, GST, etc.) reference the official format
 *     as specified by the Income Tax / GST Act.
 *
 * USAGE:
 *   import { REGEX } from '@shared/constants';
 *   const panSchema = z.string().regex(REGEX.PAN, 'Invalid PAN format');
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const REGEX = {

  // ─── Indian Tax / Regulatory ───────────────────────────────────────────────

  /**
   * PAN (Permanent Account Number) — Income Tax India
   * Format: AAAAA9999A
   * - 5 uppercase letters
   * - 4 digits
   * - 1 uppercase letter
   * Official reference: Income Tax Act, 1961, Section 139A
   */
  PAN: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,

  /**
   * GST Identification Number (GSTIN)
   * Format: 22AAAAA0000A1Z5
   * - 2-digit state code (01–38)
   * - 10-char PAN
   * - 1 entity number digit
   * - 1 default 'Z'
   * - 1 checksum digit
   */
  GSTIN: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,

  /**
   * TAN (Tax Deduction and Collection Account Number)
   * Format: AAAA99999A
   * - 4 uppercase letters
   * - 5 digits
   * - 1 uppercase letter
   */
  TAN: /^[A-Z]{4}[0-9]{5}[A-Z]{1}$/,

  /**
   * CIN (Company Identification Number)
   * Format: L17110MH1973PLC013396
   * - 1 listing status letter (L/U)
   * - 5-digit industry code
   * - 2-letter state code
   * - 4-digit year
   * - 3-letter ownership type
   * - 6-digit sequential number
   */
  CIN: /^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/,

  /**
   * LLPIN (Limited Liability Partnership Identification Number)
   * Format: AAA-1234
   */
  LLPIN: /^[A-Z]{3}-[0-9]{4}$/,

  /**
   * DIN (Director Identification Number) — 8 digits
   */
  DIN: /^[0-9]{8}$/,

  /**
   * IFSC (Indian Financial System Code)
   * Format: AAAA0999999
   * - 4 uppercase letters (bank code)
   * - 0 (reserved)
   * - 6 alphanumeric (branch code)
   */
  IFSC: /^[A-Z]{4}0[A-Z0-9]{6}$/,

  /**
   * Indian bank account number: 9–18 digits
   */
  BANK_ACCOUNT: /^[0-9]{9,18}$/,

  // ─── Contact ───────────────────────────────────────────────────────────────

  /**
   * Indian mobile phone number.
   * Accepts optional country code (+91 or 0091 or 91) followed by
   * a 10-digit number starting with 6–9.
   */
  PHONE_IN: /^(\+91|0091|91)?[6-9][0-9]{9}$/,

  /**
   * International E.164 phone number.
   * Format: +[country code][number] — up to 15 digits total.
   */
  PHONE_E164: /^\+[1-9]\d{1,14}$/,

  /**
   * Standard email address.
   * Intentionally simple — deep email validation belongs to mail server verification.
   */
  EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,

  // ─── Password ──────────────────────────────────────────────────────────────

  /**
   * Password — minimum 8 chars, at least one:
   * uppercase letter, lowercase letter, digit, and special character.
   */
  PASSWORD_STRONG: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{}|;':",.<>?/`~])[A-Za-z\d!@#$%^&*()_+\-=[\]{}|;':",.<>?/`~]{8,}$/,

  /**
   * Password — minimum 8 chars, at least one uppercase and one digit.
   * Use for "medium" strength policy.
   */
  PASSWORD_MEDIUM: /^(?=.*[A-Z])(?=.*\d).{8,}$/,

  // ─── Identifiers ───────────────────────────────────────────────────────────

  /**
   * UUID v4 format
   */
  UUID_V4: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,

  /**
   * URL-safe slug: lowercase letters, digits, and hyphens.
   * Min 2 chars, max 100 chars. Must start/end with alphanumeric.
   */
  SLUG: /^[a-z0-9][a-z0-9-]{0,98}[a-z0-9]$/,

  /**
   * Hex color code: #RRGGBB
   */
  HEX_COLOR: /^#[0-9A-Fa-f]{6}$/,

  /**
   * Pincode — Indian 6-digit postal code
   */
  PINCODE_IN: /^[1-9][0-9]{5}$/,

} as const;

export type RegexKey = keyof typeof REGEX;
