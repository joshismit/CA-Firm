/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Tenant Enums
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * PURPOSE:
 *   Shared enums for the Tenant domain.
 *   These mirror the Prisma schema enums but live in the application layer
 *   so they can be used without importing from @prisma/client.
 *
 * RULES:
 *   - Values MUST exactly match the Prisma schema enum values.
 *   - Only include enums used across multiple modules.
 *   - Tenant-module-only enums stay in the tenant module.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Lifecycle status of a CA Firm tenant on the platform.
 * Mirrors `TenantStatus` in schema.prisma.
 */
export enum TenantStatus {
  ACTIVE = 'ACTIVE',
  TRIAL = 'TRIAL',
  SUSPENDED = 'SUSPENDED',
  DEACTIVATED = 'DEACTIVATED',
}

/**
 * Status of a tenant's paid subscription.
 * Mirrors `SubscriptionStatus` in schema.prisma.
 */
export enum SubscriptionStatus {
  TRIAL = 'TRIAL',
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  SUSPENDED = 'SUSPENDED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}
