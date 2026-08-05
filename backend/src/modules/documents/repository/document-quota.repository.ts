import { PrismaClient } from '@prisma/client';

export interface TenantQuotaLimits {
  maxStorageGb: number | null;
  maxUploadSizeMb: number | null;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Document Quota Repository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * PRD §7.4 — narrow, bespoke reads across `Tenant`/`TenantSettings`/`Business`
 * needed to resolve effective upload/storage limits, plus the same
 * live-aggregate usage technique `master-admin/repository/tenant.repository.ts`'s
 * `getUsage()` already uses (`SUM(Document.sizeBytes)`) — deliberately not a
 * maintained counter, so usage can never drift from the actual rows.
 *
 * Not a `BaseRepository<TDelegate, TEntity>` subclass — this repository isn't
 * "the" repository for any one entity, it reads narrow slices of three
 * different tables. Mirrors `modules/billing/repository/tenant-billing.repository.ts`'s
 * same reasoning for reaching into `Tenant` from outside its owning module.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class DocumentQuotaRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findTenantLimits(tenantId: string): Promise<TenantQuotaLimits | null> {
    return this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { maxStorageGb: true, maxUploadSizeMb: true },
    });
  }

  async findTenantDefaultBusinessQuotaMb(tenantId: string): Promise<number | null> {
    const settings = await this.prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { defaultBusinessStorageQuotaMb: true },
    });
    return settings?.defaultBusinessStorageQuotaMb ?? null;
  }

  async findBusinessQuotaMb(businessId: string, tenantId: string): Promise<number | null> {
    const business = await this.prisma.business.findFirst({
      where: { id: businessId, tenantId },
      select: { storageQuotaMb: true },
    });
    return business?.storageQuotaMb ?? null;
  }

  /** Live aggregate — every non-soft-deleted `Document` row across the whole tenant. */
  async getTenantStorageUsedBytes(tenantId: string): Promise<number> {
    const result = await this.prisma.document.aggregate({
      where: { tenantId, deletedAt: null },
      _sum: { sizeBytes: true },
    });
    return result._sum.sizeBytes ?? 0;
  }

  /** Live aggregate — every non-soft-deleted `Document` row belonging to one business. */
  async getBusinessStorageUsedBytes(tenantId: string, businessId: string): Promise<number> {
    const result = await this.prisma.document.aggregate({
      where: { tenantId, businessId, deletedAt: null },
      _sum: { sizeBytes: true },
    });
    return result._sum.sizeBytes ?? 0;
  }
}
