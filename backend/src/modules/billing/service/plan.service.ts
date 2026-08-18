import { Request } from 'express';
import { prisma } from '@config/database';
import { BaseService } from '@shared/base';
import { ConflictError } from '@shared/errors';
import { PlanRepository } from '../repository/plan.repository';
import { BillingMapper } from '../mapper/billing.mapper';
import { CreatePlanDto, UpdatePlanDto } from '../dto/billing.req.dto';
import { PlanResponseDto, PlanWithTenantCountResponseDto } from '../dto/billing.res.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Plan Service
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Business logic for the `Plan` catalog. `listActive()` backs the tenant-
 * facing pricing page (`/billing/plans`); `listAllWithTenantCount()`/
 * `createPlan()`/`updatePlan()` back the master-admin plan-management panel
 * (`/master-admin/plans*`, wired via `masterAdminRoutes` importing
 * `PlanController` from this module — see this module's `index.ts` header
 * comment for why that composition lives here rather than duplicated in
 * `modules/master-admin`).
 *
 * Not tenant-scoped — `Plan` is a shared, cross-tenant catalog, so this
 * service doesn't touch `this.tenantId` at all.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class PlanService extends BaseService {
  constructor(
    req: Request,
    private readonly planRepository: PlanRepository = new PlanRepository(prisma),
  ) {
    super(req);
  }

  async listActive(): Promise<PlanResponseDto[]> {
    const plans = await this.planRepository.listActive();
    return BillingMapper.toPlanResponseDtoList(plans);
  }

  async listAllWithTenantCount(): Promise<PlanWithTenantCountResponseDto[]> {
    const plans = await this.planRepository.listAllWithTenantCount();
    return BillingMapper.toPlanWithTenantCountResponseDtoList(plans);
  }

  async getPlanById(id: string): Promise<PlanResponseDto> {
    const plan = await this.planRepository.findById(id);
    this.validateExists(plan, 'Plan');
    return BillingMapper.toPlanResponseDto(plan);
  }

  async createPlan(dto: CreatePlanDto): Promise<PlanResponseDto> {
    const existing = await this.planRepository.findByCode(dto.code);
    if (existing) {
      throw new ConflictError(`A plan with code "${dto.code}" already exists`);
    }

    this.logger.info({ code: dto.code }, 'Master admin creating plan');
    const plan = await this.planRepository.create({
      code: dto.code,
      name: dto.name,
      billingCycle: dto.billingCycle,
      priceInPaise: dto.priceInPaise,
      maxUsers: dto.maxUsers ?? null,
      maxClients: dto.maxClients ?? null,
      maxStorageGb: dto.maxStorageGb ?? null,
      maxDocuments: dto.maxDocuments ?? null,
      maxUploadSizeMb: dto.maxUploadSizeMb ?? null,
      displayOrder: dto.displayOrder ?? 0,
    });
    return BillingMapper.toPlanResponseDto(plan);
  }

  async updatePlan(id: string, dto: UpdatePlanDto): Promise<PlanResponseDto> {
    const existing = await this.planRepository.findById(id);
    this.validateExists(existing, 'Plan');

    this.logger.info({ planId: id }, 'Master admin updating plan');
    const plan = await this.planRepository.update(id, dto);
    return BillingMapper.toPlanResponseDto(plan);
  }
}
