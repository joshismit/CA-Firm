import { z } from 'zod';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Tenant Domain Validation Schemas (PRD §4.3 — "firmname.yourdomain.com or
 * custom domain")
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exactly one of `subdomain`/`customDomain` per request — a tenant either
 * takes a `<slug>.PLATFORM_DOMAIN` address (no DNS ownership proof needed,
 * the platform already owns that DNS) or a fully custom domain they own
 * (proved via `POST /settings/domain/verify`'s real TXT lookup). Never both
 * at once — `TenantDomain` has a single `domain` column, one row per tenant.
 *
 * `createTenantDomainSchema` is a plain `ZodObject`, not a `.refine()`-wrapped
 * `ZodEffects` — `validate()` (@middlewares/validation.middleware) types its
 * `body`/`params`/`query` options as `AnyZodObject`, which a `.refine()`
 * result isn't assignable to (see `modules/tasks/schemas/task.schema.ts`'s
 * identical header comment). The "exactly one of" cross-field check is
 * therefore enforced in `TenantDomainService.createDomain()` instead.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** DNS label rules: lowercase alphanumeric, hyphens allowed but not leading/trailing, 3-63 chars. */
const subdomainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Subdomain must be at least 3 characters')
  .max(63, 'Subdomain cannot exceed 63 characters')
  .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, 'Only lowercase letters, numbers, and hyphens (not at the start or end)');

/** Loose hostname validation — real ownership is proved by DNS TXT verification, not this regex. */
const customDomainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(253)
  .regex(/^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/, 'Enter a valid domain, e.g. portal.yourfirm.com');

export const createTenantDomainSchema = z.object({
  subdomain: subdomainSchema.optional(),
  customDomain: customDomainSchema.optional(),
});
