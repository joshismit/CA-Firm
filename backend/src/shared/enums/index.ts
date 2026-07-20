/**
 * ─────────────────────────────────────────────────────────────────────────────
 * shared/enums — Barrel Export
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * PURPOSE:
 *   Single entry point for all shared application enums.
 *   These are the only enums used across multiple modules.
 *
 * RULES:
 *   - Import from '@shared/enums' — never from individual enum files.
 *   - Only enums shared across 2+ modules live here.
 *   - Module-specific enums stay inside their own module folder.
 *   - Values MUST mirror the Prisma schema enum values exactly.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

export { UserRole, UserStatus } from './user.enum';
export { PermissionAction, PermissionResource } from './permission.enum';
export { TenantStatus, SubscriptionStatus } from './tenant.enum';
export { ErrorCode } from './error.enum';

