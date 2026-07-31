import { PrismaClient, TenantDomain, Prisma } from '@prisma/client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Tenant Domain Repository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Same "singleton per tenant, not `BaseRepository`" reasoning as
 * `TenantBrandingRepository` — `TenantDomain.tenantId` is `@unique`.
 * `findByHostname()` is deliberately unscoped by tenant (it's how a tenant
 * gets resolved from an incoming hostname in the first place, for the
 * PUBLIC branding endpoint — there is no tenant to scope by yet), matching
 * the same "system query, no tenant context available" precedent as
 * `modules/master-admin/repository/tenant.repository.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class TenantDomainRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByTenantId(tenantId: string): Promise<TenantDomain | null> {
    return this.prisma.tenantDomain.findUnique({ where: { tenantId } });
  }

  /** `domain` always holds the complete servable hostname (`<slug>.PLATFORM_DOMAIN` for a platform subdomain, or the bare custom domain) — never just the `subdomain` label — so a Host header match is always a single-column lookup. */
  async findByHostname(hostname: string): Promise<TenantDomain | null> {
    return this.prisma.tenantDomain.findUnique({ where: { domain: hostname } });
  }

  /** Checks whether a platform subdomain label (e.g. "firmname", not the full hostname) is already taken by another tenant — `subdomain` has its own independent unique constraint from `domain`. */
  async findBySubdomainLabel(subdomain: string): Promise<TenantDomain | null> {
    return this.prisma.tenantDomain.findUnique({ where: { subdomain } });
  }

  async create(data: Prisma.TenantDomainCreateInput): Promise<TenantDomain> {
    return this.prisma.tenantDomain.create({ data });
  }

  async update(id: string, data: Prisma.TenantDomainUpdateInput): Promise<TenantDomain> {
    return this.prisma.tenantDomain.update({ where: { id }, data });
  }

  async deleteByTenantId(tenantId: string): Promise<void> {
    await this.prisma.tenantDomain.delete({ where: { tenantId } });
  }
}
