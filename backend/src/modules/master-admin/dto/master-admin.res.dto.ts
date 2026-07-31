import { TenantStatus, SubscriptionStatus } from '@prisma/client';

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
  usage: TenantUsageDto;
  updatedAt: string;
}
