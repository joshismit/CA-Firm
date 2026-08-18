import { PrismaClient, TenantBranding, Prisma } from '@prisma/client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Tenant Branding Repository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Deliberately does NOT extend `BaseRepository` — `TenantBranding` is a
 * one-row-per-tenant singleton (`tenantId` is `@unique`, not just indexed),
 * so every real operation is "find/create-or-update the one row for this
 * tenant," not the find-by-id/paginate shape `BaseRepository` is built
 * around. Mirrors `modules/billing/repository/tenant-billing.repository.ts`'s
 * same reasoning for the same kind of singleton relationship.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class TenantBrandingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByTenantId(tenantId: string): Promise<TenantBranding | null> {
    return this.prisma.tenantBranding.findUnique({ where: { tenantId } });
  }

  /** Creates the row on first write, updates it on every write after — a tenant never has more than one. Takes the "unchecked" (scalar `tenantId`, no relation object) input shape both ways since every field this module ever writes is a plain scalar. */
  async upsert(tenantId: string, data: Omit<Prisma.TenantBrandingUncheckedUpdateInput, 'tenantId'>): Promise<TenantBranding> {
    return this.prisma.tenantBranding.upsert({
      where: { tenantId },
      create: { tenantId, ...data } as Prisma.TenantBrandingUncheckedCreateInput,
      update: data,
    });
  }
}
