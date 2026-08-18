const mockTx = {
  tenantSettings: { create: jest.fn() },
  rolePermission: { createMany: jest.fn() },
};

jest.mock('@config/database', () => ({
  prisma: { $transaction: jest.fn((operation: (tx: unknown) => unknown) => operation(mockTx)) },
}));
jest.mock('@config/queue', () => ({ emailQueue: { add: jest.fn().mockResolvedValue(undefined) } }));

import { Request } from 'express';
import { Tenant, TenantStatus, SubscriptionStatus, RoleType, User, UserStatus, NotificationChannel, AuditEventType } from '@prisma/client';
import { NotFoundError } from '@shared/errors';
import { TenantService } from '@modules/master-admin/service/tenant.service';
import { TenantRepository } from '@modules/master-admin/repository/tenant.repository';
import { TenantWithUserCount } from '@modules/master-admin/mapper/tenant.mapper';
import { UserRepository } from '@modules/users/repository/user.repository';
import { UserInvitationRepository } from '@modules/users/repository/user-invitation.repository';
import { RoleRepository } from '@modules/roles/repository/role.repository';
import { PermissionRepository } from '@modules/permissions/repository/permission.repository';
import { AuditLogRecorder } from '@modules/audit';
import { emailQueue } from '@config/queue';
import type { NotificationDispatchService } from '@modules/notifications/service/notification-dispatch.service';
import type {
  CreateTenantDto,
  ListTenantsQueryDto,
  UpdateTenantLimitsDto,
  UpdateTenantStatusDto,
} from '@modules/master-admin/dto/master-admin.req.dto';

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
    create: jest.fn(),
    updateStatus: jest.fn(),
    updateLimits: jest.fn(),
    getUsage: jest.fn().mockResolvedValue(USAGE),
  } as unknown as MockedTenantRepository;
}

const MASTER_ADMIN_ID = 'master-admin-99999999-9999-9999-9999-999999999999';

function createFakeRequest(): Request {
  return { correlationId: 'test-correlation-id' } as unknown as Request;
}

/** A master-admin-authenticated request — `BaseService.userId` reads `req.user.id`, which for a master-admin JWT is the admin's own id (see `master-admin-auth.service.ts`'s `login()`). */
function createMasterAdminRequest(): Request {
  return {
    correlationId: 'test-correlation-id',
    user: { id: MASTER_ADMIN_ID, email: 'admin@platform.test' },
    ip: '127.0.0.1',
  } as unknown as Request;
}

/** `findOwnerByTenant` returns `null` (no owner found) by default — sufficient for `notifyOwner()`'s best-effort dispatch to no-op cleanly, since it isn't the subject of most of these tests. `search` backs `listTenantUsers()`. */
function createMockUserRepository(): { findOwnerByTenant: jest.Mock; search: jest.Mock } {
  return {
    findOwnerByTenant: jest.fn().mockResolvedValue(null),
    search: jest.fn().mockResolvedValue({ data: [], meta: { page: 1, limit: 200, total: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false } }),
  };
}

function createMockUserInvitationRepository(): { [K in keyof UserInvitationRepository]: jest.Mock } {
  return {
    create: jest.fn().mockResolvedValue({ id: 'invitation-id' }),
    findById: jest.fn(),
    findPendingByEmail: jest.fn(),
    findByTokenHash: jest.fn(),
    update: jest.fn(),
  } as unknown as { [K in keyof UserInvitationRepository]: jest.Mock };
}

function createMockRoleRepository(): { create: jest.Mock } {
  return { create: jest.fn().mockResolvedValue({ id: 'owner-role-id', name: 'Owner', type: RoleType.SYSTEM }) };
}

function createMockPermissionRepository(): { findAll: jest.Mock } {
  return { findAll: jest.fn().mockResolvedValue([{ id: 'perm-1' }, { id: 'perm-2' }]) };
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
    maxUploadSizeMb: null,
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
    isManager: false,
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

function createMockAuditLogRecorder(): { record: jest.Mock } {
  return { record: jest.fn().mockResolvedValue(undefined) };
}

function createService(
  repository: MockedTenantRepository,
  userRepository: { findOwnerByTenant: jest.Mock; search: jest.Mock } = createMockUserRepository(),
  notificationDispatchService: { send: jest.Mock } = createMockNotificationDispatchService(),
  request: Request = createFakeRequest(),
  userInvitationRepository: { [K in keyof UserInvitationRepository]: jest.Mock } = createMockUserInvitationRepository(),
  roleRepository: { create: jest.Mock } = createMockRoleRepository(),
  permissionRepository: { findAll: jest.Mock } = createMockPermissionRepository(),
  auditLogRecorder: { record: jest.Mock } = createMockAuditLogRecorder(),
): TenantService {
  return new TenantService(
    request,
    repository as unknown as TenantRepository,
    userRepository as unknown as UserRepository,
    userInvitationRepository as unknown as UserInvitationRepository,
    roleRepository as unknown as RoleRepository,
    permissionRepository as unknown as PermissionRepository,
    notificationDispatchService as unknown as NotificationDispatchService,
    auditLogRecorder as unknown as AuditLogRecorder,
  );
}

describe('TenantService', () => {
  describe('createTenant', () => {
    const dto: CreateTenantDto = {
      name: 'Acme & Co',
      ownerFirstName: 'Rohan',
      ownerLastName: 'Mehta',
      ownerEmail: 'rohan@acme.test',
    };

    beforeEach(() => {
      mockTx.tenantSettings.create.mockReset().mockResolvedValue({});
      mockTx.rolePermission.createMany.mockReset().mockResolvedValue({ count: 2 });
      (emailQueue.add as jest.Mock).mockClear();
    });

    it('creates the tenant + settings + a fully-permissioned Owner role, issues the master-admin-attributed owner invitation, and queues the invite email', async () => {
      const repo = createMockRepository();
      repo.create.mockResolvedValue(createMockTenant({ slug: 'acme-co', name: dto.name }));
      const roleRepo = createMockRoleRepository();
      const permissionRepo = createMockPermissionRepository();
      const invitationRepo = createMockUserInvitationRepository();

      const service = createService(
        repo,
        createMockUserRepository(),
        createMockNotificationDispatchService(),
        createMasterAdminRequest(),
        invitationRepo,
        roleRepo,
        permissionRepo,
      );

      const result = await service.createTenant(dto);

      // Slug auto-derived from `name` when the caller doesn't supply one.
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'acme-co', name: dto.name, status: TenantStatus.ACTIVE }),
        mockTx,
      );
      expect(mockTx.tenantSettings.create).toHaveBeenCalledWith({ data: { tenantId: TENANT_ID } });
      expect(roleRepo.create).toHaveBeenCalledWith(
        { name: 'Owner', description: 'Full access to every module.', type: RoleType.SYSTEM },
        { tenantId: TENANT_ID, tx: mockTx },
      );
      expect(mockTx.rolePermission.createMany).toHaveBeenCalledWith({
        data: [
          { roleId: 'owner-role-id', permissionId: 'perm-1', grantedById: null },
          { roleId: 'owner-role-id', permissionId: 'perm-2', grantedById: null },
        ],
      });
      expect(invitationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          email: dto.ownerEmail,
          firstName: dto.ownerFirstName,
          lastName: dto.ownerLastName,
          invitedById: null,
          invitedByMasterAdminId: MASTER_ADMIN_ID,
          isOwner: true,
          roleIds: ['owner-role-id'],
        }),
        mockTx,
      );
      expect(emailQueue.add).toHaveBeenCalledWith(
        'user-invitation',
        expect.objectContaining({ to: dto.ownerEmail, template: 'user-invitation' }),
      );
      expect(result.id).toBe(TENANT_ID);
      expect(result.usage).toEqual(USAGE);
    });

    it('uses the caller-supplied slug instead of deriving one from the name', async () => {
      const repo = createMockRepository();
      repo.create.mockResolvedValue(createMockTenant({ slug: 'custom-slug' }));

      const service = createService(repo, undefined, undefined, createMasterAdminRequest());
      await service.createTenant({ ...dto, slug: 'custom-slug' });

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ slug: 'custom-slug' }), mockTx);
    });
  });

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

    // PRD §7.4 — maxUploadSizeMb flows through updateLimits exactly like every other plan limit.
    it('passes maxUploadSizeMb through to the repository and the response', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockTenant());
      repo.updateLimits.mockResolvedValue(createMockTenant({ maxUploadSizeMb: 1024 }));
      repo.getUsage.mockResolvedValue(USAGE);

      const service = createService(repo);
      const dto: UpdateTenantLimitsDto = { maxUploadSizeMb: 1024 };
      const result = await service.updateLimits(TENANT_ID, dto);

      expect(repo.updateLimits).toHaveBeenCalledWith(TENANT_ID, dto);
      expect(result.maxUploadSizeMb).toBe(1024);
    });

    // PRD §7.4 — "changing upload limits must generate audit logs."
    it('audit-logs a SETTINGS_UPDATE entry attributed to the master admin, with an explicit actorName override', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockTenant());
      repo.updateLimits.mockResolvedValue(createMockTenant({ maxUploadSizeMb: 1024 }));
      repo.getUsage.mockResolvedValue(USAGE);
      const auditLogRecorder = createMockAuditLogRecorder();

      const service = createService(
        repo,
        createMockUserRepository(),
        createMockNotificationDispatchService(),
        createMasterAdminRequest(),
        createMockUserInvitationRepository(),
        createMockRoleRepository(),
        createMockPermissionRepository(),
        auditLogRecorder,
      );
      await service.updateLimits(TENANT_ID, { maxUploadSizeMb: 1024 });

      expect(auditLogRecorder.record).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          actorId: MASTER_ADMIN_ID,
          eventType: AuditEventType.SETTINGS_UPDATE,
          targetType: 'Tenant',
          targetId: TENANT_ID,
          actorName: 'admin@platform.test',
        }),
      );
    });

    it('does not audit-log when the request has no authenticated actor', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockTenant());
      repo.updateLimits.mockResolvedValue(createMockTenant());
      repo.getUsage.mockResolvedValue(USAGE);
      const auditLogRecorder = createMockAuditLogRecorder();

      const service = createService(
        repo,
        createMockUserRepository(),
        createMockNotificationDispatchService(),
        createFakeRequest(), // no `user`
        createMockUserInvitationRepository(),
        createMockRoleRepository(),
        createMockPermissionRepository(),
        auditLogRecorder,
      );
      await service.updateLimits(TENANT_ID, { maxUsers: 10 });

      expect(auditLogRecorder.record).not.toHaveBeenCalled();
    });
  });

  describe('listTenantUsers', () => {
    it('throws NotFoundError when the tenant does not exist, without querying users', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(null);
      const userRepo = createMockUserRepository();

      const service = createService(repo, userRepo);

      await expect(service.listTenantUsers('missing-id')).rejects.toThrow(NotFoundError);
      expect(userRepo.search).not.toHaveBeenCalled();
    });

    it('scopes the user search to this tenant and maps each row to a minimal id/name/email option', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockTenant());
      const userRepo = createMockUserRepository();
      userRepo.search.mockResolvedValue({
        data: [createMockOwner({ id: 'user-a', firstName: 'Rohan', lastName: 'Mehta', email: 'rohan@acme.test' })],
        meta: { page: 1, limit: 200, total: 1, totalPages: 1, hasNextPage: false, hasPrevPage: false },
      });

      const service = createService(repo, userRepo);
      const result = await service.listTenantUsers(TENANT_ID);

      expect(userRepo.search).toHaveBeenCalledWith(
        {},
        { page: 1, limit: 200, sortBy: 'firstName', sortOrder: 'asc' },
        { tenantId: TENANT_ID },
      );
      expect(result).toEqual([{ id: 'user-a', name: 'Rohan Mehta', email: 'rohan@acme.test' }]);
    });
  });
});
