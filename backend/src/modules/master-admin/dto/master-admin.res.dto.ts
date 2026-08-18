import { TenantStatus, SubscriptionStatus } from '@prisma/client';
import { AuditLogResponseDto } from '@modules/audit';

/**
 * Response DTOs — deliberately omit internal-only fields. Dates are
 * serialised to ISO strings rather than leaking Prisma `Date` objects.
 */

export interface MasterAdminResponseDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface MasterAdminLoginResponseDto {
  /** Access-token-only — see `MasterAdmin` model's header comment in schema.prisma for why there's no refresh token. */
  accessToken: string;
  admin: MasterAdminResponseDto;
}

/**
 * A tenant row as returned by the list endpoint. `userCount` is a single
 * `_count` relation read (cheap), unlike the full `usage` block on
 * `TenantDetailResponseDto` which requires several cross-model aggregates —
 * kept off the list response so paginated tenant lists stay fast.
 */
export interface TenantResponseDto {
  id: string;
  slug: string;
  name: string;
  status: TenantStatus;
  subscriptionStatus: SubscriptionStatus;
  planCode: string | null;
  userCount: number;
  createdAt: string;
}

/** Platform-wide resource consumption for one tenant — the "usage view" from PRD §4.1. */
export interface TenantUsageDto {
  userCount: number;
  businessCount: number;
  clientCount: number;
  documentCount: number;
  storageUsedBytes: number;
}

export interface TenantDetailResponseDto extends Omit<TenantResponseDto, 'userCount'> {
  subscriptionExpiresAt: string | null;
  maxUsers: number | null;
  maxClients: number | null;
  maxStorageGb: number | null;
  maxDocuments: number | null;
  /** PRD §7.4 — per-file upload size ceiling in MB. Null = falls back to `UPLOAD.DEFAULT_MAX_FILE_SIZE_BYTES` (100 MB). */
  maxUploadSizeMb: number | null;
  usage: TenantUsageDto;
  updatedAt: string;
}

/** Minimal user row for the master-admin audit filter's "User" selector (PRD §4.1). */
export interface TenantUserOptionResponseDto {
  id: string;
  name: string;
  email: string;
}

/**
 * `AuditLogResponseDto` plus the two fields a cross-tenant view needs that the
 * tenant-scoped one deliberately omits: which tenant the entry belongs to, and
 * its name (resolved separately — see `MasterAdminAuditService.resolveTenantNames()`,
 * since `AuditLog` has no Prisma relation back to `Tenant`).
 */
export interface MasterAdminAuditLogResponseDto extends AuditLogResponseDto {
  tenantId: string;
  tenantName: string | null;
}
