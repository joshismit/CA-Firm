import { Request } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '@config/database';
import { UserRole } from '@shared/enums';
import { BaseService } from '@shared/base';
import { DashboardTenantDefaultRepository } from '../repository/dashboard-tenant-default.repository';
import { DashboardTenantDefaultResponseDto } from '../dto/dashboard-tenant-default.res.dto';
import { UpdateDashboardTenantDefaultDto } from '../dto/dashboard-tenant-default.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Dashboard Tenant Default Service
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Business logic for `DashboardTenantDefault` — the tenant-admin-configurable
 * default widget layout per coarse `UserRole` (PRD §10.3). No HTTP concerns —
 * mirrors `DashboardPreferenceService`'s own shape, one level up (tenant+role
 * instead of user). Route-level `requireRole(UserRole.TENANT_ADMIN)` is the
 * only gate (`dashboard-tenant-default.routes.ts`) — this service trusts the
 * caller already passed that check, same as every other service trusting its
 * routes' `requirePermission()`/`requireRole()` gate.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class DashboardTenantDefaultService extends BaseService {
  constructor(
    req: Request,
    private readonly repository: DashboardTenantDefaultRepository = new DashboardTenantDefaultRepository(prisma),
  ) {
    super(req);
  }

  /** One entry per `UserRole` value — unconfigured roles come back with an empty layout and no `updatedAt`, mirroring `DashboardPreferenceService.getPreferences()`'s own "no row yet" shape. */
  async listDefaults(): Promise<DashboardTenantDefaultResponseDto[]> {
    const tenantId = this.tenantId as string;
    const rows = await this.repository.listByTenant(tenantId);
    const byRole = new Map(rows.map((row) => [row.role, row]));

    return Object.values(UserRole).map((role) => {
      const row = byRole.get(role);
      return {
        role,
        widgets: (row?.widgets as UpdateDashboardTenantDefaultDto['widgets']) ?? [],
        updatedAt: row ? row.updatedAt.toISOString() : null,
      };
    });
  }

  async upsertDefault(role: UserRole, dto: UpdateDashboardTenantDefaultDto): Promise<DashboardTenantDefaultResponseDto> {
    this.logger.info({ role, widgetCount: dto.widgets.length }, 'Updating dashboard tenant default');

    const row = await this.repository.upsert(
      this.tenantId as string,
      role,
      dto.widgets as unknown as Prisma.InputJsonValue,
      this.userId as string,
    );

    return { role: row.role as UserRole, widgets: dto.widgets, updatedAt: row.updatedAt.toISOString() };
  }

  async deleteDefault(role: UserRole): Promise<void> {
    await this.repository.deleteByTenantAndRole(this.tenantId as string, role);
    this.logger.info({ role }, 'Deleted dashboard tenant default');
  }
}
