/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Date Format Constants
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * PURPOSE:
 *   Centralises all date/time format strings used across the application.
 *   Consistent formatting is critical for financial records, tax filings,
 *   audit logs, and document timestamps in a CA ERP context.
 *
 * USAGE:
 *   import { DATE_FORMAT } from '@shared/constants';
 *   formatDate(date, DATE_FORMAT.DISPLAY_IN); // → "20/07/2025"
 *
 * FUTURE EXTENSION:
 *   When a date utility library (e.g., date-fns) is added, these strings
 *   map directly to its format tokens. No changes to call sites needed.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const DATE_FORMAT = {

  // ─── ISO / API Layer ────────────────────────────────────────────────────────

  /** Full ISO 8601 with milliseconds and UTC offset — use for all API responses */
  ISO: "yyyy-MM-dd'T'HH:mm:ss.SSSxxx",

  /** ISO 8601 date only — use for date-only fields in API responses */
  ISO_DATE: 'yyyy-MM-dd',

  /** ISO 8601 time only */
  ISO_TIME: 'HH:mm:ss',

  // ─── Indian Display Formats ─────────────────────────────────────────────────

  /** Standard Indian date display: DD/MM/YYYY */
  DISPLAY_IN: 'dd/MM/yyyy',

  /** Indian date with month name: 20 Jul 2025 */
  DISPLAY_IN_VERBOSE: 'dd MMM yyyy',

  /** Indian date with full month: 20 July 2025 */
  DISPLAY_IN_FULL: 'dd MMMM yyyy',

  /** Indian date and time: 20/07/2025 14:30 */
  DISPLAY_IN_DATETIME: 'dd/MM/yyyy HH:mm',

  /** Indian date and time with seconds: 20/07/2025 14:30:00 */
  DISPLAY_IN_DATETIME_FULL: 'dd/MM/yyyy HH:mm:ss',

  // ─── Financial / Fiscal ─────────────────────────────────────────────────────

  /**
   * Indian Fiscal Year period string.
   * Derived programmatically — not a format token.
   * Example output: "FY 2025-26"
   */
  FISCAL_YEAR_LABEL: 'FY yyyy', // Applied to April 1 of the year

  /** Month and year: Jul 2025 */
  MONTH_YEAR: 'MMM yyyy',

  /** Full month and year: July 2025 */
  MONTH_YEAR_FULL: 'MMMM yyyy',

  /** Quarter display: Q1 FY 2025-26 */
  QUARTER: "'Q'Q yyyy",

  // ─── Audit / Logging ────────────────────────────────────────────────────────

  /** Timestamp format for log files and audit trails */
  AUDIT_TIMESTAMP: 'yyyy-MM-dd HH:mm:ss.SSS',

  /** Sortable timestamp for file naming: 20250720_143000 */
  FILE_TIMESTAMP: "yyyyMMdd'_'HHmmss",

  // ─── Relative / Human-Readable ──────────────────────────────────────────────

  /** Day of week + date: Monday, 20 July 2025 */
  WEEKDAY_FULL: 'EEEE, dd MMMM yyyy',

} as const;

// ─── Timezone Constants ───────────────────────────────────────────────────────

export const TIMEZONE = {
  /** Indian Standard Time — UTC+5:30 */
  IST: 'Asia/Kolkata',
  /** UTC — for storage and API layer */
  UTC: 'UTC',
} as const;
