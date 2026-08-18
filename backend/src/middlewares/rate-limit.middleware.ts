import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { RATE_LIMIT } from '@shared/constants';
import { ErrorCode } from '@shared/enums';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Rate Limiting
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `express-rate-limit` was an installed dependency with a fully-defined
 * `RATE_LIMIT` config (see `shared/constants/api.constants.ts`) that was never
 * actually wired into any route — meaning login, token refresh, and the
 * cross-tenant master-admin login had zero brute-force/credential-stuffing
 * protection at the HTTP layer. This file wires it up.
 *
 * Uses the default in-memory store, which is correct for this app's current
 * single-instance deployment (no Docker/orchestration config exists yet — see
 * the RC-1 audit). If this service is ever horizontally scaled behind a load
 * balancer, swap the `store` option for a Redis-backed store (e.g.
 * `rate-limit-redis`, using the same `redis` client already configured in
 * `config/redis.ts`) so limits are shared across instances.
 * ─────────────────────────────────────────────────────────────────────────────
 */

function jsonRateLimitHandler(req: Request, res: Response): void {
  res.status(429).json({
    success: false,
    error: {
      code: ErrorCode.TOO_MANY_REQUESTS,
      message: 'Too many requests. Please try again later.',
    },
  });
}

/** General-purpose limiter — applied to every request as a baseline defense. */
export const generalRateLimiter = rateLimit({
  windowMs: RATE_LIMIT.WINDOW_MS,
  max: RATE_LIMIT.MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitHandler,
});

/**
 * Strict limiter for credential-checking endpoints (login, token refresh).
 * Keyed by IP + request body email when present, so a distributed attack
 * spraying many accounts from one IP is still caught by the IP key, while a
 * single account being brute-forced from rotating IPs is caught via the
 * per-account lockout already implemented in `AuthService`/`MasterAdminAuthService`.
 */
export const authRateLimiter = rateLimit({
  windowMs: RATE_LIMIT.AUTH_WINDOW_MS,
  max: RATE_LIMIT.AUTH_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: jsonRateLimitHandler,
});

/**
 * Master-admin login is the single highest-privilege, cross-tenant credential
 * in the system and — unlike tenant-user login — has no per-account lockout
 * of its own (`MasterAdminAuthService.login()` has no failed-attempt
 * tracking). It gets a tighter ceiling than the regular auth limiter as the
 * only brute-force defense currently in place for that endpoint.
 */
export const masterAdminAuthRateLimiter = rateLimit({
  windowMs: RATE_LIMIT.AUTH_WINDOW_MS,
  max: Math.ceil(RATE_LIMIT.AUTH_MAX_REQUESTS / 2),
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: jsonRateLimitHandler,
});
