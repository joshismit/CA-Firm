import { Request } from 'express';
import { Tenant } from '@prisma/client';
import { prisma } from '@config/database';
import { BaseService } from '@shared/base';
import { PaginationMeta } from '@shared/types';
import { TenantRepository } from '../repository/tenant.repository';
import { TenantMapper, TenantWithUserCount } from '../mapper/tenant.mapper';
import { ListTenantsQueryDto, UpdateTenantLimitsDto, UpdateTenantStatusDto } from '../dto/master-admin.req.dto';
import { TenantDetailResponseDto, TenantResponseDto } from '../dto/master-admin.res.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Tenant Service (Master Admin)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Business logic for the platform-admin tenant panel: list every tenant,
 * inspect one tenant's usage, and change its status/plan limits. No
 * `createTenant()` — tenant provisioning happens through self-service signup
 * (not yet built; see `modules/auth`'s `register()` stub), matching the
 * frontend's own `TenantsListPage.tsx`, which was deliberately built
 * read-only-plus-status-changes rather than full CRUD.
 *
 * Unlike every other module's service, this one is NOT scoped by
 * `this.tenantId` — a master admin operates across every tenant, so
 * `TenantRepository`'s queries are intentionally unscoped.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class TenantService extends BaseService {
  constructor(
    req: Request,
    private readonly tenantRepository: TenantRepository = new TenantRepository(prisma),
  ) {
    super(req);
  }

  async listTenants(query: ListTenantsQueryDto): Promise<{ data: TenantResponseDto[]; meta: PaginationMeta }> {
    const { data, meta } = await this.tenantRepository.search(
      { status: query.status, search: query.search },
      { page: query.page, limit: query.limit, sortBy: query.sortBy, sortOrder: query.sortOrder },
    );

    return { data: TenantMapper.toResponseDtoList(data as TenantWithUserCount[]), meta };
  }

  async getTenantById(id: string): Promise<TenantDetailResponseDto> {
    const tenant = await this.tenantRepository.findById(id);
    this.validateExists(tenant, 'Tenant');

    const usage = await this.tenantRepository.getUsage(id);
    return TenantMapper.toDetailResponseDto(tenant, usage);
  }

  async updateStatus(id: string, dto: UpdateTenantStatusDto): Promise<TenantDetailResponseDto> {
    await this.requireTenant(id);

    this.logger.info({ tenantId: id, status: dto.status }, 'Master admin changing tenant status');
    const updated = await this.tenantRepository.updateStatus(id, dto.status);

    const usage = await this.tenantRepository.getUsage(id);
    return TenantMapper.toDetailResponseDto(updated, usage);
  }

  async updateLimits(id: string, dto: UpdateTenantLimitsDto): Promise<TenantDetailResponseDto> {
    await this.requireTenant(id);

    this.logger.info({ tenantId: id }, 'Master admin changing tenant plan/limits');
    const updated = await this.tenantRepository.updateLimits(id, dto);

    const usage = await this.tenantRepository.getUsage(id);
    return TenantMapper.toDetailResponseDto(updated, usage);
  }

  private async requireTenant(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findById(id);
    this.validateExists(tenant, 'Tenant');
    return tenant;
  }
}
