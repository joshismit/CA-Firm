import { UserRole } from '@shared/enums';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Express Request Augmentation
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * PURPOSE:
 *   Extends the Express `Request` interface with application-specific
 *   properties that are attached by our foundation middlewares.
 *
 * RESPONSIBILITIES:
 *   - Declares `req.user`       → attached by authMiddleware
 *   - Declares `req.tenant`     → attached by tenantMiddleware
 *   - Declares `req.correlationId` → attached by correlationIdMiddleware
 *   - Declares `req.requestStartTime` → attached by requestLoggerMiddleware
 *
 * RULES:
 *   - This file must NEVER import concrete implementations — only types.
 *   - All properties are optional except `correlationId` (always present).
 *   - `RequestUser.role` uses the `UserRole` enum — never a raw string.
 *
 * FUTURE EXTENSION:
 *   When adding a new middleware that attaches data to `req`, declare
 *   the property here so it is typed globally across the entire codebase.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * The authenticated user payload decoded from the JWT access token.
 * Attached to `req.user` by `authMiddleware`.
 * This is the single source of truth for the shape of the request user.
 */
export interface RequestUser {
  /** The user's UUID primary key */
  id: string;
  /** The user's verified email address */
  email: string;
  /** The user's role within their tenant */
  role: UserRole;
  /** The tenant this user belongs to */
  tenantId: string;
  /** Flat list of permission codes this user holds, e.g. ["clients:read", "tasks:create"] */
  permissions: string[];
}

/**
 * The resolved tenant payload.
 * Attached to `req.tenant` by `tenantMiddleware` (runs after authMiddleware).
 */
export interface RequestTenant {
  /** The tenant's UUID primary key */
  id: string;
  /** The tenant's URL-safe slug, e.g. "sharma-and-associates" */
  slug: string;
  /** The display name of the CA firm */
  name: string;
  /** The active subscription plan code, e.g. "starter", "professional", "enterprise" */
  planCode: string | null;
  /** Whether this tenant is allowed to operate */
  isActive: boolean;
}

// ─── Global Augmentation ────────────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      /**
       * UUID v4 generated per request.
       * Attached by `correlationIdMiddleware` — ALWAYS present.
       * Returned to clients via the `X-Correlation-ID` response header.
       */
      correlationId: string;

      /**
       * Unix timestamp (ms) recorded at the start of request processing.
       * Attached by `correlationIdMiddleware` alongside `correlationId`.
       * Used to compute response duration in the error middleware and logger.
       */
      requestStartTime: number;

      /**
       * The decoded JWT payload of the authenticated user.
       * `undefined` on public/unauthenticated routes.
       * Always present after `authMiddleware` runs.
       */
      user?: RequestUser;

      /**
       * The resolved tenant record for the current request.
       * `undefined` on public/unauthenticated routes.
       * Always present after `tenantMiddleware` runs (which requires authMiddleware).
       */
      tenant?: RequestTenant;
    }
  }
}

export {};
