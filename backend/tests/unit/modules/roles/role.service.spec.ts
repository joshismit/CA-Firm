import { Request } from 'express';
import { Permission, PermissionAction, Role, RoleType, User, UserRole, UserStatus, NotificationChannel } from '@prisma/client';

/**
 * See the identical comment in tests/unit/modules/contacts/contact.service.spec.ts
 * for why @config/database is stubbed, and why a working $transaction stub is
 * provided — RoleService.createRole()/updateRole() call this.transaction()
 * for real.
 */
jest.mock('@config/database', () => ({
  prisma: { $transaction: jest.fn((operation: (tx: unknown) => unknown) => operation({})) },
}));

import { UserRole as JwtUserRole } from '@shared/enums';
import { ConflictError, ForbiddenError, NotFoundError } from '@shared/errors';
import { RoleService } from '@modules/roles/service/role.service';
import { RoleRepository } from '@modules/roles/repository/role.repository';
import { CreateRoleDto, UpdateRoleDto, AssignRoleDto } from '@modules/roles/dto/role.req.dto';
import type { NotificationDispatchService } from '@modules/notifications/service/notification-dispatch.service';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * RoleService — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The repository is fully mocked — these tests exercise only the business
 * logic in `RoleService` (existence guards, SYSTEM-role immutability,
 * permissionCodes resolution, cross-tenant/duplicate-assignment guards),
 * never a real database. Mirrors
 * `tests/unit/modules/contacts/contact.service.spec.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';
const CALLER_ID = 'user-22222222-2222-2222-2222-222222222222';
const ROLE_ID = 'role-33333333-3333-3333-3333-333333333333';
const PERMISSION_ID = 'permission-44444444-4444-4444-4444-444444444444';
const TARGET_USER_ID = 'user-55555555-5555-5555-5555-555555555555';

type MockedRoleRepository = {
  [K in
    | 'findById'
    | 'findByIdWithPermissions'
    | 'search'
    | 'create'
    | 'update'
    | 'delete'
    | 'findPermissionsByCodes'
    | 'replacePermissions'
    | 'userExistsInTenant'
    | 'findUserRoleAssignment'
    | 'createUserRoleAssignment'
    | 'deleteUserRoleAssignment'
    | 'findActiveUsersForRole']: jest.Mock;
};

function createMockRepository(): MockedRoleRepository {
  return {
    findById: jest.fn(),
    findByIdWithPermissions: jest.fn(),
    search: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findPermissionsByCodes: jest.fn(),
    replacePermissions: jest.fn(),
    userExistsInTenant: jest.fn(),
    findUserRoleAssignment: jest.fn(),
    createUserRoleAssignment: jest.fn(),
    deleteUserRoleAssignment: jest.fn(),
    findActiveUsersForRole: jest.fn(),
  };
}

/**
 * Defaults to holding `users:read` — the permission code every DTO/mock role
 * in this file uses — so tests that aren't specifically exercising the
 * permission-containment guard (see the dedicated block below) don't need to
 * think about it. Pass an explicit list to test the guard itself.
 */
function createFakeRequest(permissions: string[] = ['users:read']): Request {
  return {
    tenant: { id: TENANT_ID, slug: 'acme', name: 'Acme & Co', planCode: 'professional', isActive: true },
    user: { id: CALLER_ID, email: 'admin@acme.test', role: JwtUserRole.TENANT_ADMIN, tenantId: TENANT_ID, permissions },
    correlationId: 'test-correlation-id',
  } as unknown as Request;
}

function createMockRole(overrides: Partial<Role> = {}): Role {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: ROLE_ID,
    tenantId: TENANT_ID,
    name: 'Staff',
    description: null,
    color: null,
    type: RoleType.CUSTOM,
    isActive: true,
    createdById: CALLER_ID,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

function createMockRoleWithPermissions(overrides: Partial<Role> = {}) {
  return { ...createMockRole(overrides), rolePermissions: [{ permission: { code: 'users:read' } }] };
}

function createMockPermission(overrides: Partial<Permission> = {}): Permission {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: PERMISSION_ID,
    groupId: null,
    code: 'users:read',
    name: 'View Users',
    description: null,
    module: 'users',
    action: PermissionAction.READ,
    resource: 'users',
    isSensitive: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createMockUser(overrides: Partial<User> = {}): User {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: TARGET_USER_ID,
    tenantId: TENANT_ID,
    email: 'staff@acme.test',
    passwordHash: null,
    firstName: 'Rohan',
    lastName: 'Mehta',
    phone: null,
    status: UserStatus.ACTIVE,
    isOwner: false,
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

function createMockUserRoleAssignment(overrides: Partial<UserRole> = {}): UserRole {
  return {
    id: 'userrole-66666666-6666-6666-6666-666666666666',
    tenantId: TENANT_ID,
    userId: TARGET_USER_ID,
    roleId: ROLE_ID,
    assignedById: CALLER_ID,
    assignedAt: new Date('2026-01-01T00:00:00.000Z'),
    expiresAt: null,
    ...overrides,
  };
}

function createMockNotificationDispatchService(): { send: jest.Mock } {
  return { send: jest.fn().mockResolvedValue([]) };
}

function createService(
  repository: MockedRoleRepository,
  permissions?: string[],
  notificationDispatchService: { send: jest.Mock } = createMockNotificationDispatchService(),
): RoleService {
  return new RoleService(
    createFakeRequest(permissions),
    repository as unknown as RoleRepository,
    undefined,
    notificationDispatchService as unknown as NotificationDispatchService,
  );
}

describe('RoleService', () => {
  // ────────────────────────────────────────────────────────────────────────
  // getRoleById / listRoles
  // ────────────────────────────────────────────────────────────────────────
  describe('getRoleById', () => {
    it('returns the role when found', async () => {
      const repo = createMockRepository();
      const role = createMockRoleWithPermissions();
      repo.findByIdWithPermissions.mockResolvedValue(role);

      const service = createService(repo);
      const result = await service.getRoleById(ROLE_ID);

      expect(repo.findByIdWithPermissions).toHaveBeenCalledWith(ROLE_ID, { tenantId: TENANT_ID });
      expect(result).toBe(role);
    });

    it('throws NotFoundError when no role matches the ID', async () => {
      const repo = createMockRepository();
      repo.findByIdWithPermissions.mockResolvedValue(null);

      const service = createService(repo);

      await expect(service.getRoleById('missing-id')).rejects.toThrow(NotFoundError);
    });
  });

  describe('listRoles', () => {
    it('delegates to repository.search with the filters and pagination mapped from the query', async () => {
      const repo = createMockRepository();
      const paginated = {
        data: [createMockRoleWithPermissions()],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1, hasNextPage: false, hasPrevPage: false },
      };
      repo.search.mockResolvedValue(paginated);

      const service = createService(repo);
      const result = await service.listRoles({
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        search: 'staff',
        type: RoleType.CUSTOM,
      });

      expect(repo.search).toHaveBeenCalledWith(
        { search: 'staff', type: RoleType.CUSTOM },
        { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' },
        { tenantId: TENANT_ID },
      );
      expect(result).toBe(paginated);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // getRoleUsers
  // ────────────────────────────────────────────────────────────────────────
  describe('getRoleUsers', () => {
    it('throws NotFoundError when the role does not exist', async () => {
      const repo = createMockRepository();
      repo.findByIdWithPermissions.mockResolvedValue(null);

      const service = createService(repo);

      await expect(service.getRoleUsers('missing-id')).rejects.toThrow(NotFoundError);
      expect(repo.findActiveUsersForRole).not.toHaveBeenCalled();
    });

    it('maps users through the real UserMapper', async () => {
      const repo = createMockRepository();
      repo.findByIdWithPermissions.mockResolvedValue(createMockRoleWithPermissions());
      const user = createMockUser();
      repo.findActiveUsersForRole.mockResolvedValue([user]);

      const service = createService(repo);
      const result = await service.getRoleUsers(ROLE_ID);

      expect(repo.findActiveUsersForRole).toHaveBeenCalledWith(ROLE_ID, TENANT_ID);
      expect(result).toEqual([
        expect.objectContaining({ id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName }),
      ]);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // createRole
  // ────────────────────────────────────────────────────────────────────────
  describe('createRole', () => {
    const dto: CreateRoleDto = { name: 'Staff', permissionCodes: ['users:read'] };

    it('throws NotFoundError when a permissionCode does not resolve to a real Permission', async () => {
      const repo = createMockRepository();
      repo.findPermissionsByCodes.mockResolvedValue([]);

      const service = createService(repo);

      await expect(service.createRole(dto)).rejects.toThrow(NotFoundError);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('throws ForbiddenError when granting a permission the caller does not hold', async () => {
      const repo = createMockRepository();
      repo.findPermissionsByCodes.mockResolvedValue([createMockPermission({ code: 'billing:manage' })]);

      const service = createService(repo); // caller only holds 'users:read'
      const escalationDto: CreateRoleDto = { name: 'Escalated', permissionCodes: ['billing:manage'] };

      await expect(service.createRole(escalationDto)).rejects.toThrow(ForbiddenError);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('creates the role and replaces its permission set within a transaction', async () => {
      const repo = createMockRepository();
      repo.findPermissionsByCodes.mockResolvedValue([createMockPermission()]);
      const created = createMockRole();
      repo.create.mockResolvedValue(created);
      const withPermissions = createMockRoleWithPermissions();
      repo.findByIdWithPermissions.mockResolvedValue(withPermissions);

      const service = createService(repo);
      const result = await service.createRole(dto);

      expect(repo.create).toHaveBeenCalledWith(
        { name: 'Staff', description: null, color: null, createdById: CALLER_ID },
        { tenantId: TENANT_ID, tx: {} },
      );
      expect(repo.replacePermissions).toHaveBeenCalledWith(created.id, [PERMISSION_ID], CALLER_ID, {});
      expect(result).toBe(withPermissions);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // updateRole
  // ────────────────────────────────────────────────────────────────────────
  describe('updateRole', () => {
    it('throws NotFoundError when the role does not exist', async () => {
      const repo = createMockRepository();
      repo.findByIdWithPermissions.mockResolvedValue(null);

      const service = createService(repo);

      await expect(service.updateRole(ROLE_ID, { name: 'X' })).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when updating a SYSTEM role', async () => {
      const repo = createMockRepository();
      repo.findByIdWithPermissions.mockResolvedValue(createMockRoleWithPermissions({ type: RoleType.SYSTEM }));

      const service = createService(repo);

      await expect(service.updateRole(ROLE_ID, { name: 'X' })).rejects.toThrow(ForbiddenError);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when an updated permissionCode does not resolve', async () => {
      const repo = createMockRepository();
      repo.findByIdWithPermissions.mockResolvedValue(createMockRoleWithPermissions());
      repo.findPermissionsByCodes.mockResolvedValue([]);

      const service = createService(repo);
      const dto: UpdateRoleDto = { permissionCodes: ['not:real'] };

      await expect(service.updateRole(ROLE_ID, dto)).rejects.toThrow(NotFoundError);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('throws ForbiddenError when granting a permission the caller does not hold', async () => {
      const repo = createMockRepository();
      repo.findByIdWithPermissions.mockResolvedValue(createMockRoleWithPermissions());
      repo.findPermissionsByCodes.mockResolvedValue([createMockPermission({ code: 'billing:manage' })]);

      const service = createService(repo); // caller only holds 'users:read'
      const escalationDto: UpdateRoleDto = { permissionCodes: ['billing:manage'] };

      await expect(service.updateRole(ROLE_ID, escalationDto)).rejects.toThrow(ForbiddenError);
      expect(repo.replacePermissions).not.toHaveBeenCalled();
    });

    it('updates only role fields when permissionCodes is not provided', async () => {
      const repo = createMockRepository();
      repo.findByIdWithPermissions
        .mockResolvedValueOnce(createMockRoleWithPermissions())
        .mockResolvedValueOnce(createMockRoleWithPermissions({ name: 'Renamed' }));

      const service = createService(repo);
      await service.updateRole(ROLE_ID, { name: 'Renamed' });

      expect(repo.update).toHaveBeenCalledWith(ROLE_ID, { name: 'Renamed' }, { tenantId: TENANT_ID, tx: {} });
      expect(repo.replacePermissions).not.toHaveBeenCalled();
    });

    it('replaces permissions when permissionCodes is provided', async () => {
      const repo = createMockRepository();
      repo.findByIdWithPermissions
        .mockResolvedValueOnce(createMockRoleWithPermissions())
        .mockResolvedValueOnce(createMockRoleWithPermissions());
      repo.findPermissionsByCodes.mockResolvedValue([createMockPermission()]);

      const service = createService(repo);
      await service.updateRole(ROLE_ID, { permissionCodes: ['users:read'] });

      expect(repo.replacePermissions).toHaveBeenCalledWith(ROLE_ID, [PERMISSION_ID], CALLER_ID, {});
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // deleteRole
  // ────────────────────────────────────────────────────────────────────────
  describe('deleteRole', () => {
    it('throws NotFoundError when the role does not exist', async () => {
      const repo = createMockRepository();
      repo.findByIdWithPermissions.mockResolvedValue(null);

      const service = createService(repo);

      await expect(service.deleteRole('missing-id')).rejects.toThrow(NotFoundError);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('throws ForbiddenError for a SYSTEM role', async () => {
      const repo = createMockRepository();
      repo.findByIdWithPermissions.mockResolvedValue(createMockRoleWithPermissions({ type: RoleType.SYSTEM }));

      const service = createService(repo);

      await expect(service.deleteRole(ROLE_ID)).rejects.toThrow(ForbiddenError);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('soft-deletes a CUSTOM role', async () => {
      const repo = createMockRepository();
      repo.findByIdWithPermissions.mockResolvedValue(createMockRoleWithPermissions({ type: RoleType.CUSTOM }));
      repo.delete.mockResolvedValue(true);

      const service = createService(repo);
      await service.deleteRole(ROLE_ID);

      expect(repo.delete).toHaveBeenCalledWith(ROLE_ID, { tenantId: TENANT_ID, userId: CALLER_ID });
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // assignRole / revokeRole
  // ────────────────────────────────────────────────────────────────────────
  describe('assignRole', () => {
    const dto: AssignRoleDto = { userId: TARGET_USER_ID, roleId: ROLE_ID };

    it('throws ForbiddenError when assigning a role to oneself', async () => {
      const repo = createMockRepository();
      const service = createService(repo);

      await expect(service.assignRole({ userId: CALLER_ID, roleId: ROLE_ID })).rejects.toThrow(ForbiddenError);
      expect(repo.findByIdWithPermissions).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when the role does not exist in this tenant', async () => {
      const repo = createMockRepository();
      repo.findByIdWithPermissions.mockResolvedValue(null);

      const service = createService(repo);

      await expect(service.assignRole(dto)).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when the role grants a permission the caller does not hold', async () => {
      const repo = createMockRepository();
      repo.findByIdWithPermissions.mockResolvedValue({
        ...createMockRoleWithPermissions(),
        rolePermissions: [{ permission: { code: 'billing:manage' } }],
      });

      const service = createService(repo); // caller only holds 'users:read'

      await expect(service.assignRole(dto)).rejects.toThrow(ForbiddenError);
      expect(repo.userExistsInTenant).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when the user does not exist in this tenant (cross-tenant guard)', async () => {
      const repo = createMockRepository();
      repo.findByIdWithPermissions.mockResolvedValue(createMockRoleWithPermissions());
      repo.userExistsInTenant.mockResolvedValue(false);

      const service = createService(repo);

      await expect(service.assignRole(dto)).rejects.toThrow(NotFoundError);
      expect(repo.createUserRoleAssignment).not.toHaveBeenCalled();
    });

    it('throws ConflictError when this (user, role) assignment already exists', async () => {
      const repo = createMockRepository();
      repo.findByIdWithPermissions.mockResolvedValue(createMockRoleWithPermissions());
      repo.userExistsInTenant.mockResolvedValue(true);
      repo.findUserRoleAssignment.mockResolvedValue(createMockUserRoleAssignment());

      const service = createService(repo);

      await expect(service.assignRole(dto)).rejects.toThrow(ConflictError);
      expect(repo.createUserRoleAssignment).not.toHaveBeenCalled();
    });

    it('creates the assignment once role/user/no-duplicate checks pass, and notifies the target user', async () => {
      const repo = createMockRepository();
      const role = createMockRoleWithPermissions();
      repo.findByIdWithPermissions.mockResolvedValue(role);
      repo.userExistsInTenant.mockResolvedValue(true);
      repo.findUserRoleAssignment.mockResolvedValue(null);

      const notificationDispatchService = createMockNotificationDispatchService();
      const service = createService(repo, undefined, notificationDispatchService);
      await service.assignRole(dto);

      expect(repo.createUserRoleAssignment).toHaveBeenCalledWith({
        tenantId: TENANT_ID,
        userId: TARGET_USER_ID,
        roleId: ROLE_ID,
        assignedById: CALLER_ID,
        expiresAt: null,
      });
      expect(notificationDispatchService.send).toHaveBeenCalledWith({
        tenantId: TENANT_ID,
        userId: TARGET_USER_ID,
        title: 'Role assigned',
        message: expect.stringContaining(role.name),
        channels: [NotificationChannel.IN_APP],
      });
    });

    it('never reaches notify when a duplicate assignment is rejected (no double-notify on retry)', async () => {
      const repo = createMockRepository();
      repo.findByIdWithPermissions.mockResolvedValue(createMockRoleWithPermissions());
      repo.userExistsInTenant.mockResolvedValue(true);
      repo.findUserRoleAssignment.mockResolvedValue(createMockUserRoleAssignment());

      const notificationDispatchService = createMockNotificationDispatchService();
      const service = createService(repo, undefined, notificationDispatchService);
      await expect(service.assignRole(dto)).rejects.toThrow(ConflictError);

      expect(notificationDispatchService.send).not.toHaveBeenCalled();
    });
  });

  describe('revokeRole', () => {
    const dto: AssignRoleDto = { userId: TARGET_USER_ID, roleId: ROLE_ID };

    it('throws NotFoundError when no such assignment exists', async () => {
      const repo = createMockRepository();
      repo.findUserRoleAssignment.mockResolvedValue(null);

      const service = createService(repo);

      await expect(service.revokeRole(dto)).rejects.toThrow(NotFoundError);
      expect(repo.deleteUserRoleAssignment).not.toHaveBeenCalled();
    });

    it('deletes the assignment when it exists, and notifies the target user', async () => {
      const repo = createMockRepository();
      const assignment = createMockUserRoleAssignment();
      repo.findUserRoleAssignment.mockResolvedValue(assignment);
      const role = createMockRole();
      repo.findById.mockResolvedValue(role);

      const notificationDispatchService = createMockNotificationDispatchService();
      const service = createService(repo, undefined, notificationDispatchService);
      await service.revokeRole(dto);

      expect(repo.deleteUserRoleAssignment).toHaveBeenCalledWith(assignment.id);
      expect(notificationDispatchService.send).toHaveBeenCalledWith({
        tenantId: TENANT_ID,
        userId: TARGET_USER_ID,
        title: 'Role revoked',
        message: expect.stringContaining(role.name),
        channels: [NotificationChannel.IN_APP],
      });
    });

    it('does NOT notify when a user revokes their own role assignment', async () => {
      const repo = createMockRepository();
      const assignment = createMockUserRoleAssignment({ userId: CALLER_ID });
      repo.findUserRoleAssignment.mockResolvedValue(assignment);
      repo.findById.mockResolvedValue(createMockRole());

      const notificationDispatchService = createMockNotificationDispatchService();
      const service = createService(repo, undefined, notificationDispatchService);
      await service.revokeRole({ userId: CALLER_ID, roleId: ROLE_ID });

      expect(notificationDispatchService.send).not.toHaveBeenCalled();
    });
  });
});
