/**
 * ─────────────────────────────────────────────────────────────────────────────
 * shared/types — Barrel Export
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * PURPOSE:
 *   Single entry point for all shared type definitions.
 *   Import from '@shared/types' — never from individual type files.
 *
 * USAGE:
 *   import type { ApiResponse, PaginatedResult, AuthenticatedRequest } from '@shared/types';
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Express Augmentation (must be exported to activate the global extension) ─
export type { RequestUser, RequestTenant } from './express.d';

// ─── Core Application Types ───────────────────────────────────────────────────
export type {
  // Pagination
  SortOrder,
  PaginationQuery,
  PaginationMeta,
  PaginatedResult,

  // API Response
  ApiErrorDetail,
  ApiResponse,

  // Authenticated Request
  AuthenticatedRequest,

  // Utility Types
  Nullable,
  Optional,
  DeepPartial,
  Awaited,
  WithRequired,
  StrictOmit,
} from './pagination.types';
