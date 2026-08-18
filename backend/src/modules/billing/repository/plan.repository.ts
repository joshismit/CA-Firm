import { PrismaClient, Plan, Prisma } from '@prisma/client';
import { PlanWithTenantCount } from '../mapper/billing.mapper';

export interface CreatePlanData {
  code: string;
  name: string;
  billingCycle: Prisma.PlanCreateInput['billingCycle'];
  priceInPaise: number;
  maxUsers?: number | null;
  maxClients?: number | null;
  maxStorageGb?: number | null;
  maxDocuments?: number | null;
  /** PRD §7.4 — per-file upload size ceiling in MB for tenants on this plan. */
  maxUploadSizeMb?: number | null;
  displayOrder?: number;
}

export type UpdatePlanData = Partial<Omit<CreatePlanData, 'code' | 'billingCycle'>> & { isActive?: boolean };

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Plan Repository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Data access for the `Plan` catalog. Deliberately NOT a
 * `BaseRepository<TDelegate, TEntity>` subclass — `Plan` has no `tenantId`
 * column at all (a shared, cross-tenant reference table, like
 * `BusinessType`), so `BaseRepository`'s tenant scoping doesn't apply.
 * Mirrors `modules/business/repository/business-type.repository.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class PlanRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listActive(): Promise<Plan[]> {
    return this.prisma.plan.findMany({ where: { isActive: true }, orderBy: [{ displayOrder: 'asc' }, { priceInPaise: 'asc' }] });
  }

  /** Master-admin view — every plan (including inactive), with how many tenants currently hold each. */
  async listAllWithTenantCount(): Promise<PlanWithTenantCount[]> {
    const [plans, tenantCounts] = await Promise.all([
      this.prisma.plan.findMany({ orderBy: [{ displayOrder: 'asc' }, { priceInPaise: 'asc' }] }),
      this.prisma.tenant.groupBy({
        by: ['planCode'],
        where: { deletedAt: null, planCode: { not: null } },
        _count: true,
      }),
    ]);

    const countByCode = new Map(tenantCounts.map((row) => [row.planCode as string, row._count]));
    return plans.map((plan) => ({ ...plan, tenantCount: countByCode.get(plan.code) ?? 0 }));
  }

  async findByCode(code: string): Promise<Plan | null> {
    return this.prisma.plan.findUnique({ where: { code } });
  }

  async findById(id: string): Promise<Plan | null> {
    return this.prisma.plan.findUnique({ where: { id } });
  }

  async create(data: CreatePlanData): Promise<Plan> {
    return this.prisma.plan.create({ data });
  }

  async update(id: string, data: UpdatePlanData): Promise<Plan> {
    return this.prisma.plan.update({ where: { id }, data });
  }
}
