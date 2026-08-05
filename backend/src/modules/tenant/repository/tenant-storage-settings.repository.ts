import { PrismaClient, TenantSettings } from '@prisma/client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Tenant Storage Settings Repository (PRD §7.4 — Upload Rules)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The narrow slice of the `TenantSettings` singleton this feature touches —
 * just `defaultBusinessStorageQuotaMb`. Deliberately does NOT extend
 * `BaseRepository` — `TenantSettings` is a one-row-per-tenant singleton
 * (`tenantId` is `@unique`), so every real operation is "find/create-or-update
 * the one row for this tenant," exactly like
 * `modules/tenant/repository/tenant-branding.repository.ts`, which this
 * mirrors. A `TenantSettings` row always exists in practice (created inside
 * `TenantService.createTenant()`'s provisioning transaction — see
 * `modules/master-admin/service/tenant.service.ts`), but `upsert()` still
 * creates it defensively in case that ever changes.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class TenantStorageSettingsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByTenantId(tenantId: string): Promise<Pick<TenantSettings, 'defaultBusinessStorageQuotaMb'> | null> {
    return this.prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { defaultBusinessStorageQuotaMb: true },
    });
  }

  async upsertDefaultBusinessQuota(tenantId: string, defaultBusinessStorageQuotaMb: number | null): Promise<void> {
    await this.prisma.tenantSettings.upsert({
      where: { tenantId },
      create: { tenantId, defaultBusinessStorageQuotaMb },
      update: { defaultBusinessStorageQuotaMb },
    });
  }
}
