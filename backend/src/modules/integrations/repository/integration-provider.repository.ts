import { PrismaClient, IntegrationProvider as IntegrationProviderRow, IntegrationCategory, Prisma } from '@prisma/client';

export interface UpsertIntegrationProviderCatalogData {
  name: string;
  category: IntegrationCategory;
  description?: string | null;
  capabilities: Prisma.InputJsonValue;
}

/**
 * Platform-wide catalog (no `tenantId`) — deliberately does NOT extend
 * `BaseRepository`, same reasoning as `PaymentGatewaySettingsRepository`:
 * `BaseRepository.applyFilters()` requires a `tenantId` on every query, but
 * this table has no tenant scope at all (see `IntegrationProvider` model's
 * header comment in `schema.prisma`).
 */
export class IntegrationProviderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(onlyActive = false): Promise<IntegrationProviderRow[]> {
    return this.prisma.integrationProvider.findMany({
      where: onlyActive ? { isActive: true } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  async findByKey(key: string): Promise<IntegrationProviderRow | null> {
    return this.prisma.integrationProvider.findUnique({ where: { key } });
  }

  /** Called once at process boot (`syncProviderCatalog()`) to upsert one row per
   *  registered provider — never called from any request-handling code path. */
  async upsertByKey(key: string, data: UpsertIntegrationProviderCatalogData): Promise<IntegrationProviderRow> {
    return this.prisma.integrationProvider.upsert({
      where: { key },
      create: { key, isActive: true, ...data },
      update: { ...data, isActive: true },
    });
  }

  /** Soft-disables (never deletes) catalog rows for keys no longer registered in code —
   *  keeps `IntegrationConnection.providerKey`'s FK intact for any tenant still connected to it. */
  async deactivateMissing(registeredKeys: string[]): Promise<void> {
    await this.prisma.integrationProvider.updateMany({
      where: { key: { notIn: registeredKeys } },
      data: { isActive: false },
    });
  }
}
