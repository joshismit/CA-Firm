jest.mock('@config/database', () => ({ prisma: {} }));

import { Request } from 'express';
import { Tenant, TenantStatus, SubscriptionStatus, User, UserStatus, NotificationChannel } from '@prisma/client';
import { NotFoundError } from '@shared/errors';
import { TenantService } from '@modules/master-admin/service/tenant.service';
import { TenantRepository } from '@modules/master-admin/repository/tenant.repository';
import { TenantWithUserCount } from '@modules/master-admin/mapper/tenant.mapper';
import { UserRepository } from '@modules/users/repository/user.repository';
import type { NotificationDispatchService } from '@modules/notifications/service/notification-dispatch.service';
import type { ListTenantsQueryDto, UpdateTenantLimitsDto, UpdateTenantStatusDto } from '@modules/master-admin/dto/master-admin.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * TenantService — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `TenantRepository` is fully mocked — exercises only `TenantService`'s
 * business logic (existence guards, DTO → repository mapping, usage
 * composition), never a real database. Mirrors
 * `tests/unit/modules/business/business.service.spec.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';

type MockedTenantRepository = {
  [K in keyof TenantRepository]: jest.Mock;
};

function createMockRepository(): MockedTenantRepository {
  return {
    search: jest.fn(),
    findById: jest.fn(),
    updateStatus: jest.fn(),
    updateLimits: jest.fn(),
    getUsage: jest.fn(),
  } as unknown as MockedTenantRepository;
}

function createFakeRequest(): Request {
  return { correlationId: 'test-correlation-id' } as unknown as Request;
}

/** Returns `null` (no owner found) by default — sufficient for `notifyOwner()`'s best-effort dispatch to no-op cleanly, since it isn't the subject of these tests. */
function createMockUserRepository(): { findOwnerByTenant: jest.Mock } {
  return { findOwnerByTenant: jest.fn().mockResolvedValue(null) };
}

function createMockTenant(overrides: Partial<Tenant> = {}): Tenant {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: TENANT_ID,
    slug: 'acme',
    name: 'Acme & Co',
    country: 'IN',
    timezone: 'Asia/Kolkata',
    locale: 'en-IN',
    defaultCurrency: 'INR',
    status: TenantStatus.ACTIVE,
    subscriptionStatus: SubscriptionStatus.ACTIVE,
    subscriptionExpiresAt: null,
    planCode: 'professional',
    maxUsers: 25,
    maxClients: 500,
    maxStorageGb: 50,
    maxDocuments: 5000,
    onboardingCompletedAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  } as Tenant;
}

function createMockTenantWithCount(overrides: Partial<Tenant> = {}, userCount = 3): TenantWithUserCount {
  return { ...createMockTenant(overrides), _count: { users: userCount } } as TenantWithUserCount;
}

const USAGE = { userCount: 3, businessCount: 5, clientCount: 4, documentCount: 10, storageUsedBytes: 123456 };

function createMockOwner(overrides: Partial<User> = {}): User {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: 'owner-77777777-7777-7777-7777-777777777777',
    tenantId: TENANT_ID,
    email: 'owner@acme.test',
    passwordHash: 'hash',
    firstName: 'Rohan',
    lastName: 'Mehta',
    phone: null,
    status: UserStatus.ACTIVE,
    isOwner: true,
    failedLoginCount: 0,
    lockedUntil: null,
    avatarStorageKey: null,
    jobTitle: null,
    bio: null,
    emailVerifiedAt: null,
    phoneVerifiedAt: null,
    lastLoginAt: null,
    passwordChangedAt: null,
    createdBy: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deletedBy: null,
    ...overrides,
  };
}

function createMockNotificationDispatchService(): { send: jest.Mock } {
  return { send: jest.fn().mockResolvedValue([]) };
}

function createService(
  repository: MockedTenantRepository,
  userRepository: { findOwnerByTenant: jest.Mock } = createMockUserRepository(),
  notificationDispatchService: { send: jest.Mock } = createMockNotificationDispatchService(),
): TenantService {
  return new TenantService(
    createFakeRequest(),
    repository as unknown as TenantRepository,
    userRepository as unknown as UserRepository,
    notificationDispatchService as unknown as NotificationDispatchService,
  );
}

describe('TenantService', () => {
  describe('listTenants', () => {
    it('delegates to repository.search with filters and pagination mapped from the query', async () => {
      const repo = createMockRepository();
      const tenants = [createMockTenantWithCount()];
      const paginated = {
        data: tenants,
        meta: { page: 1, limit: 20, total: 1, totalPages: 1, hasNextPage: false, hasPrevPage: false },
      };
      repo.search.mockResolvedValue(paginated);

      const service = createService(repo);
      const query: ListTenantsQueryDto = {
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        search: 'acme',
        status: TenantStatus.ACTIVE,
      };

      const result = await service.listTenants(query);

      expect(repo.search).toHaveBeenCalledWith(
        { status: TenantStatus.ACTIVE, search: 'acme' },
        { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' },
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({ id: TENANT_ID, userCount: 3 });
      expect(result.meta).toBe(paginated.meta);
    });
  });

  describe('getTenantById', () => {
    it('throws NotFoundError when the tenant does not exist', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(null);

      const service = createService(repo);

      await expect(service.getTenantById('missing-id')).rejects.toThrow(NotFoundError);
      expect(repo.getUsage).not.toHaveBeenCalled();
    });

    it('returns the tenant merged with its usage stats when found', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockTenant());
      repo.getUsage.mockResolvedValue(USAGE);

      const service = createService(repo);
      const result = await service.getTenantById(TENANT_ID);

      expect(repo.getUsage).toHaveBeenCalledWith(TENANT_ID);
      expect(result.usage).toEqual(USAGE);
      expect(result.id).toBe(TENANT_ID);
    });
  });

  describe('updateStatus', () => {
    it('throws NotFoundError when the tenant does not exist', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(null);

      const service = createService(repo);
      const dto: UpdateTenantStatusDto = { status: TenantStatus.SUSPENDED };

      await expect(service.updateStatus('missing-id', dto)).rejects.toThrow(NotFoundError);
      expect(repo.updateStatus).not.toHaveBeenCalled();
    });

    it('updates the tenant status, returns it with fresh usage, and notifies the tenant owner', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockTenant());
      const suspended = createMockTenant({ status: TenantStatus.SUSPENDED });
      repo.updateStatus.mockResolvedValue(suspended);
      repo.getUsage.mockResolvedValue(USAGE);
      const userRepo = createMockUserRepository();
      const owner = createMockOwner();
      userRepo.findOwnerByTenant.mockResolvedValue(owner);

      const notificationDispatchService = createMockNotificationDispatchService();
      const service = createService(repo, userRepo, notificationDispatchService);
      const dto: UpdateTenantStatusDto = { status: TenantStatus.SUSPENDED };
      const result = await service.updateStatus(TENANT_ID, dto);

      expect(repo.updateStatus).toHaveBeenCalledWith(TENANT_ID, TenantStatus.SUSPENDED);
      expect(result.status).toBe(TenantStatus.SUSPENDED);
      expect(userRepo.findOwnerByTenant).toHaveBeenCalledWith(TENANT_ID);
      expect(notificationDispatchService.send).toHaveBeenCalledWith({
        tenantId: TENANT_ID,
        userId: owner.id,
        title: 'Account suspended',
        message: expect.any(String),
        channels: [NotificationChannel.IN_APP],
      });
    });

    it('notifies on reactivation (SUSPENDED -> ACTIVE) with a distinct message', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockTenant({ status: TenantStatus.SUSPENDED }));
      repo.updateStatus.mockResolvedValue(createMockTenant({ status: TenantStatus.ACTIVE }));
      repo.getUsage.mockResolvedValue(USAGE);
      const userRepo = createMockUserRepository();
      const owner = createMockOwner();
      userRepo.findOwnerByTenant.mockResolvedValue(owner);

      const notificationDispatchService = createMockNotificationDispatchService();
      const service = createService(repo, userRepo, notificationDispatchService);
      await service.updateStatus(TENANT_ID, { status: TenantStatus.ACTIVE });

      expect(notificationDispatchService.send).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Account activated' }),
      );
    });

    it('does NOT notify (or double-fire) when re-setting the same status (idempotent no-op)', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockTenant({ status: TenantStatus.SUSPENDED }));
      repo.updateStatus.mockResolvedValue(createMockTenant({ status: TenantStatus.SUSPENDED }));
      repo.getUsage.mockResolvedValue(USAGE);

      const notificationDispatchService = createMockNotificationDispatchService();
      const service = createService(repo, createMockUserRepository(), notificationDispatchService);
      await service.updateStatus(TENANT_ID, { status: TenantStatus.SUSPENDED });

      expect(notificationDispatchService.send).not.toHaveBeenCalled();
    });

    it('does NOT notify for a status transition that is not SUSPENDED/ACTIVE (e.g. DEACTIVATED)', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockTenant({ status: TenantStatus.ACTIVE }));
      repo.updateStatus.mockResolvedValue(createMockTenant({ status: TenantStatus.DEACTIVATED }));
      repo.getUsage.mockResolvedValue(USAGE);

      const notificationDispatchService = createMockNotificationDispatchService();
      const service = createService(repo, createMockUserRepository(), notificationDispatchService);
      await service.updateStatus(TENANT_ID, { status: TenantStatus.DEACTIVATED });

      expect(notificationDispatchService.send).not.toHaveBeenCalled();
    });
  });

  describe('updateLimits', () => {
    it('throws NotFoundError when the tenant does not exist', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(null);

      const service = createService(repo);
      const dto: UpdateTenantLimitsDto = { maxUsers: 50 };

      await expect(service.updateLimits('missing-id', dto)).rejects.toThrow(NotFoundError);
      expect(repo.updateLimits).not.toHaveBeenCalled();
    });

    it('updates the tenant limits and returns it with fresh usage', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockTenant());
      const updated = createMockTenant({ maxUsers: 50, planCode: 'enterprise' });
      repo.updateLimits.mockResolvedValue(updated);
      repo.getUsage.mockResolvedValue(USAGE);

      const service = createService(repo);
      const dto: UpdateTenantLimitsDto = { maxUsers: 50, planCode: 'enterprise' };
      const result = await service.updateLimits(TENANT_ID, dto);

      expect(repo.updateLimits).toHaveBeenCalledWith(TENANT_ID, dto);
      expect(result.maxUsers).toBe(50);
      expect(result.planCode).toBe('enterprise');
    });
  });
});
