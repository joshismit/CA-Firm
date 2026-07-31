jest.mock('@config/database', () => ({ prisma: {} }));

import { Request } from 'express';
import { BillingCycle, Plan } from '@prisma/client';
import { ConflictError, NotFoundError } from '@shared/errors';
import { PlanService } from '@modules/billing/service/plan.service';
import { PlanRepository } from '@modules/billing/repository/plan.repository';
import { PlanWithTenantCount } from '@modules/billing/mapper/billing.mapper';
import type { CreatePlanDto, UpdatePlanDto } from '@modules/billing/dto/billing.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PlanService — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `PlanRepository` is fully mocked — exercises only `PlanService`'s business
 * logic (duplicate-code guard, existence guards), never a real database.
 * Mirrors `tests/unit/modules/business/business.service.spec.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

type MockedPlanRepository = { [K in keyof PlanRepository]: jest.Mock };

function createMockRepository(): MockedPlanRepository {
  return {
    listActive: jest.fn(),
    listAllWithTenantCount: jest.fn(),
    findByCode: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  } as unknown as MockedPlanRepository;
}

function createFakeRequest(): Request {
  return { correlationId: 'test-correlation-id' } as unknown as Request;
}

function createMockPlan(overrides: Partial<Plan> = {}): Plan {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: 'plan-11111111-1111-1111-1111-111111111111',
    code: 'PROFESSIONAL_MONTHLY',
    name: 'Professional',
    billingCycle: BillingCycle.MONTHLY,
    priceInPaise: 249_900,
    maxUsers: 15,
    maxClients: 500,
    maxStorageGb: 50,
    maxDocuments: 10_000,
    isActive: true,
    displayOrder: 2,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createService(repository: MockedPlanRepository): PlanService {
  return new PlanService(createFakeRequest(), repository as unknown as PlanRepository);
}

describe('PlanService', () => {
  describe('listActive', () => {
    it('delegates to repository.listActive and maps the result', async () => {
      const repo = createMockRepository();
      repo.listActive.mockResolvedValue([createMockPlan()]);

      const service = createService(repo);
      const result = await service.listActive();

      expect(repo.listActive).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ code: 'PROFESSIONAL_MONTHLY', priceInPaise: 249_900 });
    });
  });

  describe('listAllWithTenantCount', () => {
    it('delegates to repository.listAllWithTenantCount and maps the result', async () => {
      const repo = createMockRepository();
      const withCount: PlanWithTenantCount = { ...createMockPlan(), tenantCount: 4 };
      repo.listAllWithTenantCount.mockResolvedValue([withCount]);

      const service = createService(repo);
      const result = await service.listAllWithTenantCount();

      expect(result[0]).toMatchObject({ code: 'PROFESSIONAL_MONTHLY', tenantCount: 4 });
    });
  });

  describe('getPlanById', () => {
    it('throws NotFoundError when the plan does not exist', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(null);

      const service = createService(repo);
      await expect(service.getPlanById('missing-id')).rejects.toThrow(NotFoundError);
    });
  });

  describe('createPlan', () => {
    const dto: CreatePlanDto = {
      code: 'NEW_PLAN_MONTHLY',
      name: 'New Plan',
      billingCycle: BillingCycle.MONTHLY,
      priceInPaise: 100_000,
    };

    it('throws ConflictError when the code is already in use', async () => {
      const repo = createMockRepository();
      repo.findByCode.mockResolvedValue(createMockPlan());

      const service = createService(repo);
      await expect(service.createPlan(dto)).rejects.toThrow(ConflictError);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('creates the plan, defaulting optional fields to null/0', async () => {
      const repo = createMockRepository();
      repo.findByCode.mockResolvedValue(null);
      repo.create.mockResolvedValue(createMockPlan({ code: dto.code, name: dto.name }));

      const service = createService(repo);
      await service.createPlan(dto);

      expect(repo.create).toHaveBeenCalledWith({
        code: dto.code,
        name: dto.name,
        billingCycle: dto.billingCycle,
        priceInPaise: dto.priceInPaise,
        maxUsers: null,
        maxClients: null,
        maxStorageGb: null,
        maxDocuments: null,
        displayOrder: 0,
      });
    });
  });

  describe('updatePlan', () => {
    it('throws NotFoundError when the plan does not exist', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(null);

      const service = createService(repo);
      const dto: UpdatePlanDto = { isActive: false };

      await expect(service.updatePlan('missing-id', dto)).rejects.toThrow(NotFoundError);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('updates the plan when it exists', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockPlan());
      repo.update.mockResolvedValue(createMockPlan({ isActive: false }));

      const service = createService(repo);
      const dto: UpdatePlanDto = { isActive: false };
      const result = await service.updatePlan('plan-1', dto);

      expect(repo.update).toHaveBeenCalledWith('plan-1', dto);
      expect(result.isActive).toBe(false);
    });
  });
});
