import { z } from 'zod';
import { PASSWORD } from '@shared/constants';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Auth Validation Schemas
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * All schemas are plain `ZodObject`s (no `.refine()`/`.superRefine()` at the
 * top level) — mirrors every other module's schema file, see
 * `modules/crm/schemas/lead.schema.ts`'s header comment for why.
 *
 * `loginSchema` matches the frontend's already-built `LoginRequest` exactly
 * (`{ email, password, rememberMe }` — see
 * frontend/src/modules/auth/types/index.ts) — no `tenantSlug`/`tenantId`
 * field, so login resolves the tenant from the user's email alone (see
 * `AuthService.login()`'s header comment for the consequence of that).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const password = z.string().min(PASSWORD.MIN_LENGTH, `Password must be at least ${PASSWORD.MIN_LENGTH} characters`).max(PASSWORD.MAX_LENGTH);

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

/** The refresh token IS the session identifier here (see AuthService.logout()'s comment) — required, not optional. */
export const logoutSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

/** Unlike logout, revoking every other session doesn't strictly need to identify "this one" — omitting it revokes everything, including the caller's own session. */
export const revokeAllSessionsSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: password,
});
