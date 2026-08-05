/**
 * See the identical comment in tests/unit/modules/documents/document.repository.spec.ts
 * for why @config/database is stubbed — DocumentQuotaRepository is instantiated directly
 * against a hand-built mock PrismaClient below, so the real singleton is never touched.
 */
jest.mock('@config/database', () => ({ prisma: {} }));

import { DocumentQuotaRepository } from '@modules/documents/repository/document-quota.repository';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * DocumentQuotaRepository — Unit Tests (PRD §7.4)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the real query-construction logic — narrow reads across
 * Tenant/TenantSettings/Business, and the two live `SUM(sizeBytes)` usage
 * aggregates — against a hand-built mock Prisma client. Mirrors
 * `tests/unit/modules/documents/document.repository.spec.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';
const BUSINESS_ID = 'business-33333333-3333-3333-3333-333333333333';

function createMockPrisma() {
  return {
    tenant: { findUnique: jest.fn() },
    tenantSettings: { findUnique: jest.fn() },
    business: { findFirst: jest.fn() },
    document: { aggregate: jest.fn() },
  };
}

describe('DocumentQuotaRepository', () => {
  function createRepository() {
    const mockPrisma = createMockPrisma();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repository = new DocumentQuotaRepository(mockPrisma as any);
    return { repository, mockPrisma };
  }

  describe('findTenantLimits', () => {
    it('reads maxStorageGb/maxUploadSizeMb scoped by tenant id', async () => {
      const { repository, mockPrisma } = createRepository();
      mockPrisma.tenant.findUnique.mockResolvedValue({ maxStorageGb: 50, maxUploadSizeMb: 250 });

      const result = await repository.findTenantLimits(TENANT_ID);

      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: TENANT_ID },
        select: { maxStorageGb: true, maxUploadSizeMb: true },
      });
      expect(result).toEqual({ maxStorageGb: 50, maxUploadSizeMb: 250 });
    });

    it('returns null when the tenant does not exist', async () => {
      const { repository, mockPrisma } = createRepository();
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      await expect(repository.findTenantLimits(TENANT_ID)).resolves.toBeNull();
    });
  });

  describe('findTenantDefaultBusinessQuotaMb', () => {
    it('returns the configured default when TenantSettings has one', async () => {
      const { repository, mockPrisma } = createRepository();
      mockPrisma.tenantSettings.findUnique.mockResolvedValue({ defaultBusinessStorageQuotaMb: 750 });

      await expect(repository.findTenantDefaultBusinessQuotaMb(TENANT_ID)).resolves.toBe(750);
    });

    it('returns null when TenantSettings has no override, or the row does not exist', async () => {
      const { repository, mockPrisma } = createRepository();
      mockPrisma.tenantSettings.findUnique.mockResolvedValue(null);

      await expect(repository.findTenantDefaultBusinessQuotaMb(TENANT_ID)).resolves.toBeNull();
    });
  });

  describe('findBusinessQuotaMb', () => {
    it('scopes the lookup by both businessId and tenantId (tenant isolation)', async () => {
      const { repository, mockPrisma } = createRepository();
      mockPrisma.business.findFirst.mockResolvedValue({ storageQuotaMb: 1000 });

      const result = await repository.findBusinessQuotaMb(BUSINESS_ID, TENANT_ID);

      expect(mockPrisma.business.findFirst).toHaveBeenCalledWith({
        where: { id: BUSINESS_ID, tenantId: TENANT_ID },
        select: { storageQuotaMb: true },
      });
      expect(result).toBe(1000);
    });

    it('returns null when the business has no override', async () => {
      const { repository, mockPrisma } = createRepository();
      mockPrisma.business.findFirst.mockResolvedValue({ storageQuotaMb: null });

      await expect(repository.findBusinessQuotaMb(BUSINESS_ID, TENANT_ID)).resolves.toBeNull();
    });
  });

  describe('getTenantStorageUsedBytes', () => {
    it('aggregates SUM(sizeBytes) scoped to the tenant, excluding soft-deleted documents', async () => {
      const { repository, mockPrisma } = createRepository();
      mockPrisma.document.aggregate.mockResolvedValue({ _sum: { sizeBytes: 4_500_000 } });

      const result = await repository.getTenantStorageUsedBytes(TENANT_ID);

      expect(mockPrisma.document.aggregate).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID, deletedAt: null },
        _sum: { sizeBytes: true },
      });
      expect(result).toBe(4_500_000);
    });

    it('returns 0 when the tenant has no documents (SUM is null)', async () => {
      const { repository, mockPrisma } = createRepository();
      mockPrisma.document.aggregate.mockResolvedValue({ _sum: { sizeBytes: null } });

      await expect(repository.getTenantStorageUsedBytes(TENANT_ID)).resolves.toBe(0);
    });
  });

  describe('getBusinessStorageUsedBytes', () => {
    it('aggregates SUM(sizeBytes) scoped to both tenant and business, excluding soft-deleted documents', async () => {
      const { repository, mockPrisma } = createRepository();
      mockPrisma.document.aggregate.mockResolvedValue({ _sum: { sizeBytes: 900_000 } });

      const result = await repository.getBusinessStorageUsedBytes(TENANT_ID, BUSINESS_ID);

      expect(mockPrisma.document.aggregate).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID, businessId: BUSINESS_ID, deletedAt: null },
        _sum: { sizeBytes: true },
      });
      expect(result).toBe(900_000);
    });

    it('returns 0 when the business has no documents (SUM is null)', async () => {
      const { repository, mockPrisma } = createRepository();
      mockPrisma.document.aggregate.mockResolvedValue({ _sum: { sizeBytes: null } });

      await expect(repository.getBusinessStorageUsedBytes(TENANT_ID, BUSINESS_ID)).resolves.toBe(0);
    });
  });
});
