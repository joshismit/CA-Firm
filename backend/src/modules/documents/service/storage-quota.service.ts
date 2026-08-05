import { prisma } from '@config/database';
import { BadRequestError, ForbiddenError } from '@shared/errors';
import { ErrorCode } from '@shared/enums';
import { MESSAGES, UPLOAD } from '@shared/constants';
import { DocumentQuotaRepository } from '../repository/document-quota.repository';

export interface StorageSummary {
  usedBytes: number;
  /** Effective quota in bytes. `null` means unlimited (only possible for the tenant summary — a
   *  business summary always resolves to a concrete number via the default-fallback chain). */
  quotaBytes: number | null;
  /** `null` when `quotaBytes` is `null` (unlimited). Never negative — clamped at 0. */
  remainingBytes: number | null;
}

const BYTES_PER_MB = 1024 * 1024;
const BYTES_PER_GB = 1024 * 1024 * 1024;

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Storage Quota Service (PRD §7.4 — Upload Rules)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The single place that resolves effective upload/storage limits and checks
 * usage against them — used by `DocumentService` (enforcement, on every
 * upload/version-create) and `BusinessService` (read-only usage display on
 * `GET /business/:id`). No other module computes or checks these values
 * independently, so there is exactly one implementation of "what's this
 * business/tenant's quota and usage."
 *
 * Resolution order, each falling back to the next when the more specific
 * value is `null`:
 *   - Upload size:     `Tenant.maxUploadSizeMb` → `UPLOAD.DEFAULT_MAX_FILE_SIZE_BYTES`
 *   - Business quota:  `Business.storageQuotaMb` → `TenantSettings.defaultBusinessStorageQuotaMb`
 *                       → `UPLOAD.DEFAULT_BUSINESS_STORAGE_QUOTA_BYTES`
 *   - Tenant quota:     `Tenant.maxStorageGb` (unlimited when `null` — matches the
 *                       existing, pre-PRD §7.4 convention that a `null` plan limit means
 *                       "no cap," e.g. Enterprise's `maxUsers`/`maxClients`/`maxDocuments`)
 *
 * Usage is always a live `SUM(Document.sizeBytes)` aggregate (via
 * `DocumentQuotaRepository`), never a maintained counter — the same technique
 * `TenantRepository.getUsage()` already uses, so there is no risk of a
 * counter drifting from the actual rows.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class StorageQuotaService {
  constructor(private readonly quotaRepository: DocumentQuotaRepository = new DocumentQuotaRepository(prisma)) {}

  async getEffectiveMaxUploadBytes(tenantId: string): Promise<number> {
    const limits = await this.quotaRepository.findTenantLimits(tenantId);
    if (limits?.maxUploadSizeMb != null) {
      return limits.maxUploadSizeMb * BYTES_PER_MB;
    }
    return UPLOAD.DEFAULT_MAX_FILE_SIZE_BYTES;
  }

  /** Throws `BadRequestError(FILE_TOO_LARGE)` if `fileSizeBytes` exceeds the tenant's effective upload limit. */
  async assertFileSizeAllowed(tenantId: string, fileSizeBytes: number): Promise<void> {
    const maxBytes = await this.getEffectiveMaxUploadBytes(tenantId);
    if (fileSizeBytes > maxBytes) {
      throw new BadRequestError(MESSAGES.FILE_TOO_LARGE, undefined, ErrorCode.FILE_TOO_LARGE);
    }
  }

  private async resolveBusinessQuotaBytes(tenantId: string, businessId: string): Promise<number> {
    const businessQuotaMb = await this.quotaRepository.findBusinessQuotaMb(businessId, tenantId);
    if (businessQuotaMb != null) {
      return businessQuotaMb * BYTES_PER_MB;
    }

    const tenantDefaultMb = await this.quotaRepository.findTenantDefaultBusinessQuotaMb(tenantId);
    if (tenantDefaultMb != null) {
      return tenantDefaultMb * BYTES_PER_MB;
    }

    return UPLOAD.DEFAULT_BUSINESS_STORAGE_QUOTA_BYTES;
  }

  async getBusinessStorageSummary(tenantId: string, businessId: string): Promise<StorageSummary> {
    const [usedBytes, quotaBytes] = await Promise.all([
      this.quotaRepository.getBusinessStorageUsedBytes(tenantId, businessId),
      this.resolveBusinessQuotaBytes(tenantId, businessId),
    ]);

    return {
      usedBytes,
      quotaBytes,
      remainingBytes: Math.max(quotaBytes - usedBytes, 0),
    };
  }

  /** Throws `ForbiddenError(PLAN_LIMIT_EXCEEDED)` if `Current usage + additionalBytes > effective business quota`. */
  async assertBusinessQuota(tenantId: string, businessId: string, additionalBytes: number): Promise<void> {
    const summary = await this.getBusinessStorageSummary(tenantId, businessId);
    if (summary.usedBytes + additionalBytes > summary.quotaBytes!) {
      throw new ForbiddenError(
        `This business has reached its storage quota (${formatBytes(summary.quotaBytes!)}). Free up space or increase the quota to continue.`,
        ErrorCode.PLAN_LIMIT_EXCEEDED,
      );
    }
  }

  async getTenantStorageSummary(tenantId: string): Promise<StorageSummary> {
    const [usedBytes, limits] = await Promise.all([
      this.quotaRepository.getTenantStorageUsedBytes(tenantId),
      this.quotaRepository.findTenantLimits(tenantId),
    ]);

    const quotaBytes = limits?.maxStorageGb != null ? limits.maxStorageGb * BYTES_PER_GB : null;

    return {
      usedBytes,
      quotaBytes,
      remainingBytes: quotaBytes != null ? Math.max(quotaBytes - usedBytes, 0) : null,
    };
  }

  /** No-op when the tenant has no `maxStorageGb` cap (unlimited). Throws `ForbiddenError(PLAN_LIMIT_EXCEEDED)` otherwise. */
  async assertTenantQuota(tenantId: string, additionalBytes: number): Promise<void> {
    const summary = await this.getTenantStorageSummary(tenantId);
    if (summary.quotaBytes == null) {
      return;
    }
    if (summary.usedBytes + additionalBytes > summary.quotaBytes) {
      throw new ForbiddenError(MESSAGES.PLAN_LIMIT_EXCEEDED, ErrorCode.PLAN_LIMIT_EXCEEDED);
    }
  }
}

function formatBytes(bytes: number): string {
  if (bytes >= BYTES_PER_GB) return `${(bytes / BYTES_PER_GB).toFixed(1)} GB`;
  return `${(bytes / BYTES_PER_MB).toFixed(0)} MB`;
}
