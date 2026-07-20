/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Error Code Enum — Single Source of Truth for All API Error Codes
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * PURPOSE:
 *   Centralises every machine-readable error code used in API error responses.
 *   Every custom error class, error middleware, and business-level guard
 *   must use this enum instead of hardcoded strings.
 *
 * DESIGN:
 *   Codes are grouped by category (HTTP layer, Auth, Validation, etc.).
 *   The string value is what clients receive in:
 *   ```json
 *   { "error": { "code": "RESOURCE_NOT_FOUND" } }
 *   ```
 *   This allows clients to branch on error codes without parsing messages.
 *
 * RULES:
 *   - Never use a raw string for an error code anywhere in the codebase.
 *   - New modules add their domain codes to the correct category section.
 *   - Values are SCREAMING_SNAKE_CASE by convention.
 *   - Never remove or rename existing codes — that is a breaking API change.
 *     Instead, deprecate by adding a JSDoc `@deprecated` tag.
 *
 * USAGE:
 *   throw new NotFoundError('Client', ErrorCode.RESOURCE_NOT_FOUND);
 *   throw new AppError('Custom msg', 409, ErrorCode.EMAIL_ALREADY_EXISTS);
 *
 * FUTURE EXTENSION:
 *   Each feature module may introduce new domain-specific codes here.
 *   Group them clearly so the file stays navigable.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */
export enum ErrorCode {

  // ─── Generic HTTP Layer ──────────────────────────────────────────────────

  /** 400 — Malformed request, missing required fields, or invalid input type */
  BAD_REQUEST = 'BAD_REQUEST',

  /** 401 — No valid authentication credential was provided */
  UNAUTHORIZED = 'UNAUTHORIZED',

  /** 403 — Authenticated but lacking permission for this action */
  FORBIDDEN = 'FORBIDDEN',

  /** 404 — The requested resource does not exist */
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',

  /** 405 — HTTP method not supported on this endpoint */
  METHOD_NOT_ALLOWED = 'METHOD_NOT_ALLOWED',

  /** 409 — Request conflicts with the current state of the server */
  CONFLICT = 'CONFLICT',

  /** 410 — Resource existed but has been permanently deleted */
  GONE = 'GONE',

  /** 422 — Request was well-formed but failed semantic validation */
  VALIDATION_ERROR = 'VALIDATION_ERROR',

  /** 429 — Client has exceeded the rate limit */
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',

  /** 500 — Unexpected server-side error (non-operational) */
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',

  /** 501 — Feature not yet implemented */
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',

  /** 503 — Server is temporarily unavailable (maintenance, overload) */
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',

  // ─── Authentication & Session ────────────────────────────────────────────

  /** Access token is missing from the Authorization header */
  TOKEN_MISSING = 'TOKEN_MISSING',

  /** JWT access token has expired */
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',

  /** JWT access token is malformed or has an invalid signature */
  TOKEN_INVALID = 'TOKEN_INVALID',

  /** Refresh token has been used or revoked (token rotation violation) */
  REFRESH_TOKEN_REUSE = 'REFRESH_TOKEN_REUSE',

  /** Refresh token has expired */
  REFRESH_TOKEN_EXPIRED = 'REFRESH_TOKEN_EXPIRED',

  /** Invalid email / password combination */
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',

  /** User account is not in ACTIVE state */
  ACCOUNT_INACTIVE = 'ACCOUNT_INACTIVE',

  /** Account temporarily locked after too many failed login attempts */
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',

  /** Email address has not been verified yet */
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',

  /** MFA challenge is required to complete login */
  MFA_REQUIRED = 'MFA_REQUIRED',

  /** Provided MFA / OTP code is incorrect */
  MFA_INVALID_CODE = 'MFA_INVALID_CODE',

  /** MFA / OTP code has expired */
  MFA_CODE_EXPIRED = 'MFA_CODE_EXPIRED',

  /** MFA / OTP maximum attempt count has been exceeded */
  MFA_MAX_ATTEMPTS = 'MFA_MAX_ATTEMPTS',

  // ─── Tenant ──────────────────────────────────────────────────────────────

  /** Tenant does not exist */
  TENANT_NOT_FOUND = 'TENANT_NOT_FOUND',

  /** Tenant is not in ACTIVE status */
  TENANT_INACTIVE = 'TENANT_INACTIVE',

  /** Operation would exceed the tenant's subscription plan limits */
  PLAN_LIMIT_EXCEEDED = 'PLAN_LIMIT_EXCEEDED',

  /** Feature is not enabled for this tenant's plan */
  FEATURE_NOT_ENABLED = 'FEATURE_NOT_ENABLED',

  // ─── Authorization / RBAC ────────────────────────────────────────────────

  /** User does not hold the required permission to perform this action */
  PERMISSION_DENIED = 'PERMISSION_DENIED',

  /** Role does not exist */
  ROLE_NOT_FOUND = 'ROLE_NOT_FOUND',

  /** System roles cannot be modified or deleted */
  ROLE_IMMUTABLE = 'ROLE_IMMUTABLE',

  // ─── User ────────────────────────────────────────────────────────────────

  /** A user with this email already exists within this tenant */
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',

  /** User does not exist */
  USER_NOT_FOUND = 'USER_NOT_FOUND',

  /** Invitation token is invalid or has expired */
  INVITATION_INVALID = 'INVITATION_INVALID',

  /** Invitation has already been accepted */
  INVITATION_ALREADY_ACCEPTED = 'INVITATION_ALREADY_ACCEPTED',

  // ─── File / Storage ──────────────────────────────────────────────────────

  /** Uploaded file exceeds the maximum allowed size */
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',

  /** Uploaded file type is not permitted */
  FILE_TYPE_NOT_ALLOWED = 'FILE_TYPE_NOT_ALLOWED',

  /** No file was provided where one was required */
  FILE_MISSING = 'FILE_MISSING',

  // ─── Database / Prisma ───────────────────────────────────────────────────

  /** A record with a unique constraint field already exists */
  DUPLICATE_RECORD = 'DUPLICATE_RECORD',

  /** A related record required for this operation does not exist */
  RELATED_RECORD_NOT_FOUND = 'RELATED_RECORD_NOT_FOUND',

  /** Database query failed due to an unexpected constraint violation */
  DATABASE_CONSTRAINT_VIOLATION = 'DATABASE_CONSTRAINT_VIOLATION',

  // ─── Business Logic (cross-module) ───────────────────────────────────────

  /** The operation was already performed and cannot be repeated */
  ALREADY_PROCESSED = 'ALREADY_PROCESSED',

  /** A required external service dependency is unavailable */
  DEPENDENCY_UNAVAILABLE = 'DEPENDENCY_UNAVAILABLE',
}
