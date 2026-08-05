/** See the identical comment in tests/unit/modules/documents/document.service.spec.ts for why @config/database is stubbed. */
jest.mock('@config/database', () => ({ prisma: {} }));

import { BadRequestError, ForbiddenError } from '@shared/errors';
import { UPLOAD } from '@shared/constants';
import { StorageQuotaService } from '@modules/documents/service/storage-quota.service';
import { DocumentQuotaRepository } from '@modules/documents/repository/document-quota.repository';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * StorageQuotaService — Unit Tests (PRD §7.4 — Upload Rules)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `DocumentQuotaRepository` is fully mocked — these tests exercise only
 * `StorageQuotaService`'s own resolution/fallback logic and assert*
 * enforcement, never a real database. Mirrors
 * `tests/unit/modules/documents/document.service.spec.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';
const BUSINESS_ID = 'business-33333333-3333-3333-3333-333333333333';
const MB = 1024 * 1024;
const GB = 1024 * 1024 * 1024;

type MockedRepository = {
  [K in
    | 'findTenantLimits'
    | 'findTenantDefaultBusinessQuotaMb'
    | 'findBusinessQuotaMb'
    | 'getTenantStorageUsedBytes'
    | 'getBusinessStorageUsedBytes']: jest.Mock;
};

function createMockRepository(): MockedRepository {
  return {
    findTenantLimits: jest.fn().mockResolvedValue(null),
    findTenantDefaultBusinessQuotaMb: jest.fn().mockResolvedValue(null),
    findBusinessQuotaMb: jest.fn().mockResolvedValue(null),
    getTenantStorageUsedBytes: jest.fn().mockResolvedValue(0),
    getBusinessStorageUsedBytes: jest.fn().mockResolvedValue(0),
  };
}

function createService(repo: MockedRepository = createMockRepository()): { service: StorageQuotaService; repo: MockedRepository } {
  return { service: new StorageQuotaService(repo as unknown as DocumentQuotaRepository), repo };
}

describe('StorageQuotaService', () => {
  // ────────────────────────────────────────────────────────────────────────
  // getEffectiveMaxUploadBytes / assertFileSizeAllowed
  // ────────────────────────────────────────────────────────────────────────
  describe('getEffectiveMaxUploadBytes', () => {
    it('falls back to UPLOAD.DEFAULT_MAX_FILE_SIZE_BYTES (100 MB) when the tenant has no plan override', async () => {
      const { service } = createService();

      await expect(service.getEffectiveMaxUploadBytes(TENANT_ID)).resolves.toBe(UPLOAD.DEFAULT_MAX_FILE_SIZE_BYTES);
    });

    it('uses Tenant.maxUploadSizeMb when set (plan-derived override, e.g. Professional = 250 MB)', async () => {
      const repo = createMockRepository();
      repo.findTenantLimits.mockResolvedValue({ maxStorageGb: 50, maxUploadSizeMb: 250 });
      const { service } = createService(repo);

      await expect(service.getEffectiveMaxUploadBytes(TENANT_ID)).resolves.toBe(250 * MB);
    });
  });

  describe('assertFileSizeAllowed', () => {
    it('does not throw for a file within the effective limit', async () => {
      const { service } = createService();

      await expect(service.assertFileSizeAllowed(TENANT_ID, 50 * MB)).resolves.toBeUndefined();
    });

    it('does not throw for a file exactly at the effective limit', async () => {
      const { service } = createService();

      await expect(service.assertFileSizeAllowed(TENANT_ID, UPLOAD.DEFAULT_MAX_FILE_SIZE_BYTES)).resolves.toBeUndefined();
    });

    it('throws BadRequestError for a file exceeding the effective limit', async () => {
      const { service } = createService();

      await expect(service.assertFileSizeAllowed(TENANT_ID, UPLOAD.DEFAULT_MAX_FILE_SIZE_BYTES + 1)).rejects.toThrow(BadRequestError);
    });

    it('enforces the tenant plan override, not the global default', async () => {
      const repo = createMockRepository();
      repo.findTenantLimits.mockResolvedValue({ maxStorageGb: null, maxUploadSizeMb: 1 }); // Starter-like 1 MB
      const { service } = createService(repo);

      await expect(service.assertFileSizeAllowed(TENANT_ID, 2 * MB)).rejects.toThrow(BadRequestError);
      await expect(service.assertFileSizeAllowed(TENANT_ID, 1 * MB)).resolves.toBeUndefined();
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Business quota — Business.storageQuotaMb → TenantSettings.default → global default
  // ────────────────────────────────────────────────────────────────────────
  describe('getBusinessStorageSummary / assertBusinessQuota', () => {
    it('falls back to UPLOAD.DEFAULT_BUSINESS_STORAGE_QUOTA_BYTES (500 MB) with no overrides anywhere', async () => {
      const { service } = createService();

      const summary = await service.getBusinessStorageSummary(TENANT_ID, BUSINESS_ID);

      expect(summary.quotaBytes).toBe(UPLOAD.DEFAULT_BUSINESS_STORAGE_QUOTA_BYTES);
      expect(summary.usedBytes).toBe(0);
      expect(summary.remainingBytes).toBe(UPLOAD.DEFAULT_BUSINESS_STORAGE_QUOTA_BYTES);
    });

    it("prefers the tenant's default over the global default when set", async () => {
      const repo = createMockRepository();
      repo.findTenantDefaultBusinessQuotaMb.mockResolvedValue(750);
      const { service } = createService(repo);

      const summary = await service.getBusinessStorageSummary(TENANT_ID, BUSINESS_ID);

      expect(summary.quotaBytes).toBe(750 * MB);
    });

    it("prefers the business's own override over the tenant default", async () => {
      const repo = createMockRepository();
      repo.findBusinessQuotaMb.mockResolvedValue(200);
      repo.findTenantDefaultBusinessQuotaMb.mockResolvedValue(750);
      const { service } = createService(repo);

      const summary = await service.getBusinessStorageSummary(TENANT_ID, BUSINESS_ID);

      expect(summary.quotaBytes).toBe(200 * MB);
    });

    it('clamps remainingBytes at 0 when usage already exceeds the quota', async () => {
      const repo = createMockRepository();
      repo.findBusinessQuotaMb.mockResolvedValue(1); // 1 MB
      repo.getBusinessStorageUsedBytes.mockResolvedValue(5 * MB);
      const { service } = createService(repo);

      const summary = await service.getBusinessStorageSummary(TENANT_ID, BUSINESS_ID);

      expect(summary.remainingBytes).toBe(0);
    });

    it('assertBusinessQuota does not throw when usage + new file stays within quota', async () => {
      const repo = createMockRepository();
      repo.findBusinessQuotaMb.mockResolvedValue(10); // 10 MB
      repo.getBusinessStorageUsedBytes.mockResolvedValue(5 * MB);
      const { service } = createService(repo);

      await expect(service.assertBusinessQuota(TENANT_ID, BUSINESS_ID, 4 * MB)).resolves.toBeUndefined();
    });

    it('assertBusinessQuota throws ForbiddenError when usage + new file would exceed quota', async () => {
      const repo = createMockRepository();
      repo.findBusinessQuotaMb.mockResolvedValue(10); // 10 MB
      repo.getBusinessStorageUsedBytes.mockResolvedValue(9 * MB);
      const { service } = createService(repo);

      await expect(service.assertBusinessQuota(TENANT_ID, BUSINESS_ID, 2 * MB)).rejects.toThrow(ForbiddenError);
    });

    it('assertBusinessQuota does not throw exactly at the quota boundary', async () => {
      const repo = createMockRepository();
      repo.findBusinessQuotaMb.mockResolvedValue(10); // 10 MB
      repo.getBusinessStorageUsedBytes.mockResolvedValue(8 * MB);
      const { service } = createService(repo);

      await expect(service.assertBusinessQuota(TENANT_ID, BUSINESS_ID, 2 * MB)).resolves.toBeUndefined();
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Tenant quota — Tenant.maxStorageGb, null = unlimited (existing tenant tracking, now enforced)
  // ────────────────────────────────────────────────────────────────────────
  describe('getTenantStorageSummary / assertTenantQuota', () => {
    it('resolves quotaBytes/remainingBytes to null (unlimited) when maxStorageGb is not set', async () => {
      const { service } = createService();

      const summary = await service.getTenantStorageSummary(TENANT_ID);

      expect(summary.quotaBytes).toBeNull();
      expect(summary.remainingBytes).toBeNull();
    });

    it('converts maxStorageGb to bytes and computes remaining usage', async () => {
      const repo = createMockRepository();
      repo.findTenantLimits.mockResolvedValue({ maxStorageGb: 5, maxUploadSizeMb: null });
      repo.getTenantStorageUsedBytes.mockResolvedValue(2 * GB);
      const { service } = createService(repo);

      const summary = await service.getTenantStorageSummary(TENANT_ID);

      expect(summary.quotaBytes).toBe(5 * GB);
      expect(summary.usedBytes).toBe(2 * GB);
      expect(summary.remainingBytes).toBe(3 * GB);
    });

    it('assertTenantQuota is a no-op (never throws) when the tenant has no maxStorageGb cap', async () => {
      const repo = createMockRepository();
      repo.getTenantStorageUsedBytes.mockResolvedValue(1000 * GB); // huge usage, irrelevant when unlimited
      const { service } = createService(repo);

      await expect(service.assertTenantQuota(TENANT_ID, 1 * GB)).resolves.toBeUndefined();
    });

    it('assertTenantQuota throws ForbiddenError when usage + new file would exceed maxStorageGb', async () => {
      const repo = createMockRepository();
      repo.findTenantLimits.mockResolvedValue({ maxStorageGb: 5, maxUploadSizeMb: null });
      repo.getTenantStorageUsedBytes.mockResolvedValue(4.5 * GB);
      const { service } = createService(repo);

      await expect(service.assertTenantQuota(TENANT_ID, 1 * GB)).rejects.toThrow(ForbiddenError);
    });

    it('assertTenantQuota rejects even a zero-GB plan cap (edge case: 0 means no allowance at all)', async () => {
      const repo = createMockRepository();
      repo.findTenantLimits.mockResolvedValue({ maxStorageGb: 0, maxUploadSizeMb: null });
      const { service } = createService(repo);

      await expect(service.assertTenantQuota(TENANT_ID, 1)).rejects.toThrow(ForbiddenError);
    });
  });
});
