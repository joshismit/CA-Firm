import { BusinessStatus } from '@prisma/client';

/**
 * Response DTO — the shape returned to API clients. Deliberately omits
 * internal-only fields (`tenantId`, `deletedAt`, `deletedBy`, `createdBy`)
 * that have no value outside the server; dates are serialised to ISO strings
 * rather than leaking Prisma `Date` objects. Field-for-field match with the
 * frontend's already-built `Business` type (modules/business/types/index.ts).
 */
export interface BusinessResponseDto {
  id: string;
  typeId: string;
  name: string;
  legalName: string | null;
  status: BusinessStatus;
  pan: string | null;
  gstin: string | null;
  cin: string | null;
  incorporationDate: string | null;
  financialYearStart: number;
  industry: string | null;
  /** PRD §7.4 — per-business storage quota override in MB; `null` = inherit the tenant's default. */
  storageQuotaMb: number | null;
  /**
   * PRD §7.4 — live storage usage summary. Only populated on `GET /business/:id` (one aggregate
   * query per request) — omitted from the list endpoint (`GET /business`) to keep paginated
   * listings cheap, mirroring `TenantResponseDto` (list) vs `TenantDetailResponseDto` (detail) in
   * the master-admin module.
   */
  storageUsage?: BusinessStorageUsageDto;
  createdAt: string;
  updatedAt: string;
}

/** PRD §7.4 — see `StorageQuotaService.getBusinessStorageSummary()`. */
export interface BusinessStorageUsageDto {
  usedBytes: number;
  quotaBytes: number;
  remainingBytes: number;
}

/**
 * Response DTO for `BusinessType` — the reference/lookup table `Business.typeId`
 * points at. Matches the frontend's `BusinessType` type exactly.
 */
export interface BusinessTypeResponseDto {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
}
