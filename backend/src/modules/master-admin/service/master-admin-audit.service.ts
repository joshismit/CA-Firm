import { Request } from 'express';
import { prisma } from '@config/database';
import { BaseService } from '@shared/base';
import { PaginationMeta } from '@shared/types';
// Concrete path, not `@modules/audit` — that module's barrel deliberately doesn't export
// `AuditLogRepository` (internal implementation detail). Mirrors this module's own
// `tenant.service.ts`, which reaches into `UserRepository`/`RoleRepository`/etc. the same way —
// see that file's header comment for why.
import { AuditLogRepository } from '@modules/audit/repository/audit-log.repository';
import { TenantRepository } from '../repository/tenant.repository';
import { MasterAdminAuditMapper } from '../mapper/master-admin-audit.mapper';
import { ListMasterAdminAuditLogsQueryDto } from '../dto/master-admin.req.dto';
import { MasterAdminAuditLogResponseDto } from '../dto/master-admin.res.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Master Admin Audit Service (PRD §4.1 — system-level audit monitoring)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Cross-tenant read access over the SAME `AuditLog` table the tenant-scoped
 * `modules/audit/service/audit-log.service.ts` already reads — there is no
 * second audit table or duplicated query-building logic here.
 * `AuditLogRepository.search()` already had every filter this needs; the only
 * repository change was letting it accept an optional `tenantId` filter
 * (unset by the tenant-scoped caller, so that caller's behavior is unchanged)
 * and passing `{ ignoreTenant: true }` in `options` — the exact escape hatch
 * `BaseRepository.applyFilters()` documents for "system admin jobs" like this
 * one, instead of the mandatory single-tenant `options.tenantId` every other
 * caller must supply.
 *
 * `AuditLog` has no Prisma relation back to `Tenant` (a raw `tenantId` column,
 * scoped at the application layer only — same as `Business`/`Client`/
 * `Document`), so "tenant name on every row" is a second, batched query
 * (`TenantRepository.findNamesByIds()`) rather than a Prisma `include`.
 *
 * Not tenant-scoped — like `TenantService`/`PlanService`, this never touches
 * `this.tenantId` (a master-admin JWT doesn't carry one).
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class MasterAdminAuditService extends BaseService {
  constructor(
    req: Request,
    private readonly auditLogRepository: AuditLogRepository = new AuditLogRepository(prisma),
    private readonly tenantRepository: TenantRepository = new TenantRepository(prisma),
  ) {
    super(req);
  }

  async listAuditLogs(
    query: ListMasterAdminAuditLogsQueryDto,
  ): Promise<{ data: MasterAdminAuditLogResponseDto[]; meta: PaginationMeta }> {
    const { data, meta } = await this.auditLogRepository.search(
      {
        tenantId: query.tenantId,
        search: query.search,
        eventType: query.eventType,
        actorId: query.actorId,
        targetType: query.targetType,
        from: query.from,
        to: query.to,
      },
      { page: query.page, limit: query.limit, sortBy: query.sortBy, sortOrder: query.sortOrder },
      { ignoreTenant: true },
    );

    const tenantNamesById = await this.resolveTenantNames(data.map((entry) => entry.tenantId));
    return { data: MasterAdminAuditMapper.toResponseDtoList(data, tenantNamesById), meta };
  }

  async getAuditLogById(id: string): Promise<MasterAdminAuditLogResponseDto> {
    const entry = await this.auditLogRepository.findByIdScoped(id, { ignoreTenant: true });
    this.validateExists(entry, 'Audit log entry');

    const tenantNamesById = await this.resolveTenantNames([entry.tenantId]);
    return MasterAdminAuditMapper.toResponseDto(entry, tenantNamesById.get(entry.tenantId) ?? null);
  }

  private async resolveTenantNames(tenantIds: string[]): Promise<Map<string, string>> {
    const uniqueIds = [...new Set(tenantIds)];
    if (uniqueIds.length === 0) return new Map();

    const tenants = await this.tenantRepository.findNamesByIds(uniqueIds);
    return new Map(tenants.map((tenant) => [tenant.id, tenant.name]));
  }
}
