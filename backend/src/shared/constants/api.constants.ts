/**
 * ─────────────────────────────────────────────────────────────────────────────
 * API Constants — Application-Wide Framework Configuration Values
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * PURPOSE:
 *   Single source of truth for every magic number and configuration constant
 *   used across the framework and multiple modules.
 *
 * RULES:
 *   - No business logic. These are values only.
 *   - Do NOT put module-specific constants here (they live in their module).
 *   - Do NOT duplicate values from `config/environment.ts`.
 *     `environment.ts` = values that change per deployment (from .env).
 *     `api.constants.ts` = values that are stable across all deployments.
 *   - All values are `as const` — never mutable at runtime.
 *
 * USAGE:
 *   import { PAGINATION, OTP, UPLOAD, CACHE_TTL } from '@shared/constants';
 *
 * FUTURE EXTENSION:
 *   When a constant begins to vary by tenant plan (e.g., MAX_CLIENTS),
 *   move it to the tenant settings service instead of hardcoding here.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Pagination ───────────────────────────────────────────────────────────────

export const PAGINATION = {
  /** Default page number when none is provided */
  DEFAULT_PAGE: 1,
  /** Default records per page */
  DEFAULT_LIMIT: 20,
  /** Hard cap — prevents runaway queries regardless of what the client requests */
  MAX_LIMIT: 100,
  /** Minimum allowed limit */
  MIN_LIMIT: 1,
  /** Default sort direction */
  DEFAULT_SORT_ORDER: 'desc' as const,
  /** Default column to sort by on all list endpoints */
  DEFAULT_SORT_BY: 'createdAt',
} as const;

// ─── OTP / One-Time Password ──────────────────────────────────────────────────

export const OTP = {
  /** Length of the generated numeric OTP code */
  LENGTH: 6,
  /** How long an OTP is valid (minutes) */
  EXPIRY_MINUTES: 10,
  /** Maximum verification attempts before the OTP is invalidated */
  MAX_ATTEMPTS: 5,
  /** How many OTPs a single email can request within the rate-limit window */
  RATE_LIMIT_MAX: 3,
  /** Rate-limit window for OTP requests (minutes) */
  RATE_LIMIT_WINDOW_MINUTES: 60,
} as const;

// ─── File Upload ──────────────────────────────────────────────────────────────

export const UPLOAD = {
  /** Maximum file size for general document uploads (bytes) — 10 MB */
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024,
  /** Maximum file size for avatar/logo uploads (bytes) — 2 MB */
  MAX_AVATAR_SIZE_BYTES: 2 * 1024 * 1024,
  /** Maximum file size for bulk imports (bytes) — 25 MB */
  MAX_IMPORT_SIZE_BYTES: 25 * 1024 * 1024,
  /** Permitted MIME types for document uploads */
  ALLOWED_DOCUMENT_TYPES: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain',
    'text/csv',
  ] as const,
  /** Permitted MIME types for avatar/logo uploads */
  ALLOWED_AVATAR_TYPES: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
  ] as const,
  /** Maximum number of files in a single batch upload */
  MAX_BATCH_FILES: 20,
} as const;

// ─── Cache TTLs (Time-To-Live in seconds) ────────────────────────────────────

export const CACHE_TTL = {
  /** Short-lived data (e.g., rate-limit counters, OTP session state) */
  SHORT: 60,                    // 1 minute
  /** Standard cache lifetime (e.g., resolved tenant, user profile) */
  STANDARD: 5 * 60,            // 5 minutes
  /** Medium-lived data (e.g., permission sets, role definitions) */
  MEDIUM: 15 * 60,             // 15 minutes
  /** Long-lived data (e.g., static reference data, business types) */
  LONG: 60 * 60,               // 1 hour
  /** Persistent cache (e.g., plan configuration, feature flags) */
  PERSISTENT: 24 * 60 * 60,   // 24 hours
} as const;

// ─── Password Policy ─────────────────────────────────────────────────────────

export const PASSWORD = {
  /** Minimum allowed password length */
  MIN_LENGTH: 8,
  /** Maximum allowed password length (prevent bcrypt DoS on very long inputs) */
  MAX_LENGTH: 128,
  /** bcrypt salt rounds (12 is the production-recommended minimum) */
  BCRYPT_ROUNDS: 12,
  /** How many previous passwords to remember (prevent reuse) */
  HISTORY_DEPTH: 5,
  /** Number of failed login attempts before account lockout */
  MAX_FAILED_ATTEMPTS: 5,
  /** Duration of account lockout after max failed attempts (minutes) */
  LOCKOUT_DURATION_MINUTES: 30,
} as const;

// ─── JWT / Token ──────────────────────────────────────────────────────────────

export const TOKEN = {
  /** Access token expiry in seconds — matches JWT_ACCESS_EXPIRES_IN default */
  ACCESS_EXPIRY_SECONDS: 15 * 60,        // 15 minutes
  /** Refresh token expiry in seconds — matches JWT_REFRESH_EXPIRES_IN default */
  REFRESH_EXPIRY_SECONDS: 7 * 24 * 60 * 60, // 7 days
  /** Invitation token expiry (hours) */
  INVITATION_EXPIRY_HOURS: 72,
  /** Password reset token expiry (minutes) */
  PASSWORD_RESET_EXPIRY_MINUTES: 30,
  /** Byte length for cryptographically secure random tokens */
  SECURE_BYTES: 32,
} as const;

// ─── Session ──────────────────────────────────────────────────────────────────

export const SESSION = {
  /** Maximum concurrent active sessions per user */
  MAX_CONCURRENT: 5,
  /** Idle session timeout (minutes) — after this, session is expired */
  IDLE_TIMEOUT_MINUTES: 480, // 8 hours
} as const;

// ─── Localisation Defaults ────────────────────────────────────────────────────

export const LOCALE = {
  /** Default timezone for Indian CA firms */
  DEFAULT_TIMEZONE: 'Asia/Kolkata',
  /** Default currency */
  DEFAULT_CURRENCY: 'INR',
  /** Default locale for date/number formatting */
  DEFAULT_LOCALE: 'en-IN',
  /** Default country code */
  DEFAULT_COUNTRY: 'IN',
  /** Fiscal year start month (1-indexed). India: April = 4 */
  FISCAL_YEAR_START_MONTH: 4,
} as const;

// ─── Rate Limiting ────────────────────────────────────────────────────────────

export const RATE_LIMIT = {
  /** General API rate limit window (ms) */
  WINDOW_MS: 15 * 60 * 1000,     // 15 minutes
  /** General API max requests per window */
  MAX_REQUESTS: 100,
  /** Auth endpoints (login, register) — stricter */
  AUTH_WINDOW_MS: 15 * 60 * 1000,
  AUTH_MAX_REQUESTS: 10,
  /** Export endpoints — very strict (prevent data scraping) */
  EXPORT_WINDOW_MS: 60 * 60 * 1000, // 1 hour
  EXPORT_MAX_REQUESTS: 5,
} as const;

// ─── Audit Log ────────────────────────────────────────────────────────────────

export const AUDIT = {
  /** How long to retain audit logs (days). Indian CA regulations = 8 years */
  RETENTION_DAYS: 365 * 8,
  /** Maximum number of audit log entries to return in a single query */
  MAX_QUERY_LIMIT: 500,
} as const;

// ─── White-Label (PRD §4.3) ───────────────────────────────────────────────────

export const WHITE_LABEL = {
  /** Custom-domain DNS ownership is proven via a TXT record at this fixed subdomain of the
   *  tenant's own domain (`_cafirm-verify.<domain>`) — never at the domain's bare root, so this
   *  never clobbers a TXT record the tenant already has there (SPF/DKIM/etc). Platform subdomains
   *  (`<slug>.PLATFORM_DOMAIN`) skip verification entirely — the platform already owns that DNS. */
  VERIFICATION_TXT_PREFIX: '_cafirm-verify',
  /** Byte length for the random verification token placed in the TXT record's value. */
  VERIFICATION_TOKEN_BYTES: 16,
} as const;

// ─── Platform Billing (SaaS subscription, PRD §12) ───────────────────────────

export const BILLING = {
  /** Length of the free trial granted on signup. */
  TRIAL_DAYS: 7,
  /** Every Plan/PlatformInvoice amount is INR — no multi-currency support. */
  CURRENCY: 'INR',
} as const;

// ─── API Versioning ───────────────────────────────────────────────────────────

export const API = {
  /** Current API version prefix */
  VERSION: 'v1',
  /** Full API prefix */
  PREFIX: '/api/v1',
} as const;
