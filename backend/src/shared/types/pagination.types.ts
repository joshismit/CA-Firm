/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Core Application Types
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * PURPOSE:
 *   Centralised type definitions shared across every module.
 *   These are the contracts between layers — controllers, services, repositories.
 *
 * RESPONSIBILITIES:
 *   - `ApiResponse<T>`         → Standard HTTP response envelope
 *   - `PaginatedResult<T>`     → Typed result from any paginated query
 *   - `PaginationQuery`        → Parsed, validated query params for list endpoints
 *   - `PaginationMeta`         → Metadata included in every paginated response
 *   - `SortOrder`              → Constrained sort direction type
 *   - `AuthenticatedRequest`   → Express Request guaranteed to have `user` and `tenant`
 *   - `Nullable<T>`            → Convenience type for T | null
 *   - `Optional<T>`            → Convenience type for T | undefined
 *   - `DeepPartial<T>`         → Recursive Partial for patch operations
 *
 * RULES:
 *   - No imports from Prisma, Express, or any module here.
 *     Only import other shared types/enums.
 *   - These types MUST be framework-agnostic (except AuthenticatedRequest).
 *
 * FUTURE EXTENSION:
 *   - Add `CursorPaginationQuery` here when cursor-based pagination is needed
 *     (e.g., for infinite-scroll in the client portal).
 *   - Add `WebhookPayload<T>` here when the webhook delivery system is built.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { Request } from 'express';
import type { RequestUser, RequestTenant } from './express.d';

// ─── Sort ───────────────────────────────────────────────────────────────────

/** Constrained sort direction. Always 'asc' | 'desc' — never a raw string. */
export type SortOrder = 'asc' | 'desc';

// ─── Pagination ──────────────────────────────────────────────────────────────

/**
 * Parsed and validated query parameters for any list endpoint.
 * Produced by `parsePaginationQuery()` in `shared/utils/pagination.ts`.
 * Never construct this manually — always go through the parser.
 */
export interface PaginationQuery {
  /** Current page number. Min: 1. Default: 1. */
  page: number;
  /** Number of records per page. Min: 1. Max: 100. Default: 20. */
  limit: number;
  /** Column name to sort by (must be a valid model field). */
  sortBy?: string;
  /** Sort direction. Default: 'desc'. */
  sortOrder?: SortOrder;
  /** Optional full-text / ILIKE search term. */
  search?: string;
}

/**
 * Pagination metadata included in every paginated API response.
 * Constructed by `buildPaginationMeta()` in `shared/utils/pagination.ts`.
 */
export interface PaginationMeta {
  /** Current page number */
  page: number;
  /** Records per page */
  limit: number;
  /** Total matching records across all pages */
  total: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether a next page exists */
  hasNextPage: boolean;
  /** Whether a previous page exists */
  hasPrevPage: boolean;
}

/**
 * Typed result returned from any paginated repository query.
 * BaseRepository.paginate() always returns this shape.
 *
 * @template T - The entity type (e.g., Client, Contact, Task)
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

// ─── API Response ────────────────────────────────────────────────────────────

/**
 * Standardised error detail block for failure responses.
 */
export interface ApiErrorDetail {
  /** Machine-readable error code, e.g. "VALIDATION_ERROR", "NOT_FOUND" */
  code: string;
  /** Structured field-level error details (e.g., from Zod) */
  details?: unknown;
}

/**
 * The single, canonical HTTP response envelope for this API.
 *
 * Success shape:
 * ```json
 * {
 *   "success": true,
 *   "message": "Fetched successfully",
 *   "data": { ... },
 *   "meta": { "page": 1, "limit": 20, ... },
 *   "timestamp": "2025-01-01T00:00:00.000Z",
 *   "correlationId": "uuid-v4"
 * }
 * ```
 *
 * Error shape:
 * ```json
 * {
 *   "success": false,
 *   "message": "Validation failed",
 *   "error": { "code": "VALIDATION_ERROR", "details": [...] },
 *   "timestamp": "2025-01-01T00:00:00.000Z",
 *   "correlationId": "uuid-v4"
 * }
 * ```
 *
 * @template T - The data payload type. Use `null` for error/no-content responses.
 */
export interface ApiResponse<T = null> {
  /** Indicates overall request success or failure */
  success: boolean;
  /** Human-readable message suitable for display */
  message: string;
  /** The response payload. Present on success responses. */
  data?: T;
  /** Pagination metadata. Present on paginated list responses only. */
  meta?: PaginationMeta;
  /** Structured error detail. Present on failure responses only. */
  error?: ApiErrorDetail;
  /** ISO 8601 timestamp of when the response was generated */
  timestamp: string;
  /** UUID v4 linking this response to a specific request in logs */
  correlationId?: string;
  /** Request processing duration in milliseconds */
  durationMs?: number;
}

// ─── Authenticated Request ───────────────────────────────────────────────────

/**
 * An Express Request that is guaranteed to have `user` and `tenant` populated.
 *
 * Use this type in controller handlers that sit behind `authMiddleware`
 * AND `tenantMiddleware` to avoid `req.user!` non-null assertions.
 *
 * @example
 * ```typescript
 * async function getClients(req: AuthenticatedRequest, res: Response): Promise<void> {
 *   const { tenantId } = req.user;   // No '!' needed
 *   const { planCode } = req.tenant; // No '!' needed
 * }
 * ```
 */
export interface AuthenticatedRequest extends Request {
  user: RequestUser;
  tenant: RequestTenant;
  correlationId: string;
  requestStartTime: number;
}

// ─── Utility Types ───────────────────────────────────────────────────────────

/** T | null */
export type Nullable<T> = T | null;

/** T | undefined */
export type Optional<T> = T | undefined;

/** Recursive Partial<T> — useful for PATCH operations */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

/**
 * Extract the resolved type of a Promise.
 * @example `Awaited<Promise<string>>` → `string`
 */
export type Awaited<T> = T extends Promise<infer U> ? U : T;

/**
 * Makes specific keys of T required while leaving the rest unchanged.
 * Useful for distinguishing "created" records that always have an `id`.
 * @example `WithRequired<CreateUserDto, 'id' | 'createdAt'>`
 */
export type WithRequired<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Omit<T, K> with stronger typing (keyof T enforced on K).
 */
export type StrictOmit<T, K extends keyof T> = Omit<T, K>;
