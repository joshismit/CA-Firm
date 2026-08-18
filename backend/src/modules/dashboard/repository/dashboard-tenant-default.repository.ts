import { PrismaClient, Prisma, DashboardTenantDefault } from '@prisma/client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Dashboard Tenant Default Repository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Data access for `DashboardTenantDefault` — one row per `(tenantId, role)`,
 * the tenant-admin-configurable default widget layout new users of a given
 * coarse role land on (PRD §10.3). Deliberately NOT a `BaseRepository`
 * subclass, for the identical reason `DashboardPreferenceRepository` isn't:
 * every real operation here is "find/upsert/delete the one row for this
 * (tenant, role) pair," not the find-by-id/paginate shape `BaseRepository` is
 * built around. `role` is looked up alongside an explicit `tenantId` (unlike
 * `DashboardPreferenceRepository.findByUserId`, which only needs `userId`) —
 * a role name alone isn't scoped to one tenant.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class DashboardTenantDefaultRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByTenantAndRole(tenantId: string, role: string): Promise<DashboardTenantDefault | null> {
    return this.prisma.dashboardTenantDefault.findUnique({ where: { uq_dashboard_tenant_defaults_tenant_role: { tenantId, role } } });
  }

  /** Every configured role default for a tenant — backs `GET /dashboard/tenant-defaults`. */
  async listByTenant(tenantId: string): Promise<DashboardTenantDefault[]> {
    return this.prisma.dashboardTenantDefault.findMany({ where: { tenantId }, orderBy: { role: 'asc' } });
  }

  async upsert(
    tenantId: string,
    role: string,
    widgets: Prisma.InputJsonValue,
    updatedBy: string,
  ): Promise<DashboardTenantDefault> {
    return this.prisma.dashboardTenantDefault.upsert({
      where: { uq_dashboard_tenant_defaults_tenant_role: { tenantId, role } },
      create: { tenantId, role, widgets, updatedBy },
      update: { widgets, updatedBy },
    });
  }

  async deleteByTenantAndRole(tenantId: string, role: string): Promise<boolean> {
    const result = await this.prisma.dashboardTenantDefault.deleteMany({ where: { tenantId, role } });
    return result.count > 0;
  }
}
