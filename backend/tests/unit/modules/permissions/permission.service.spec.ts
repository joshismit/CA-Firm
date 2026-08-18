import { Request } from 'express';
import { Permission, PermissionAction, PermissionGroup, Role, RoleType } from '@prisma/client';

/**
 * See the identical comment in tests/unit/modules/contacts/contact.service.spec.ts
 * for why @config/database is stubbed — PermissionService's default
 * constructor params (`PermissionRepository`/`RoleService`) both transitively
 * import it.
 */
jest.mock('@config/database', () => ({ prisma: {} }));

import { UserRole } from '@shared/enums';
import { ForbiddenError, NotFoundError } from '@shared/errors';
import { PermissionService } from '@modules/permissions/service/permission.service';
import { PermissionRepository } from '@modules/permissions/repository/permission.repository';
import { RoleService } from '@modules/roles';
import { UpdatePermissionMatrixDto } from '@modules/permissions/dto/permission.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PermissionService — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Both the repository and the composed `RoleService` are fully mocked —
 * these tests exercise only the business logic in `PermissionService`
 * (matrix construction, SYSTEM-role immutability, not-found guards), never a
 * real database. Mirrors
 * `tests/unit/modules/contacts/contact.service.spec.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';
const CALLER_ID = 'user-22222222-2222-2222-2222-222222222222';
const ROLE_ID = 'role-33333333-3333-3333-3333-333333333333';
const PERMISSION_ID_1 = 'permission-44444444-4444-4444-4444-444444444444';
const PERMISSION_ID_2 = 'permission-55555555-5555-5555-5555-555555555555';

type MockedPermissionRepository = {
  [K in 'findAll' | 'findById' | 'findAllGroups' | 'findGrantedPermissionIds' | 'grantPermission' | 'revokePermission']: jest.Mock;
};

type MockedRoleService = { getRoleById: jest.Mock };

function createMockRepository(): MockedPermissionRepository {
  return {
    findAll: jest.fn(),
    findById: jest.fn(),
    findAllGroups: jest.fn(),
    findGrantedPermissionIds: jest.fn(),
    grantPermission: jest.fn(),
    revokePermission: jest.fn(),
  };
}

function createMockRoleService(): MockedRoleService {
  return { getRoleById: jest.fn() };
}

function createFakeRequest(): Request {
  return {
    tenant: { id: TENANT_ID, slug: 'acme', name: 'Acme & Co', planCode: 'professional', isActive: true },
    user: { id: CALLER_ID, email: 'admin@acme.test', role: UserRole.TENANT_ADMIN, tenantId: TENANT_ID, permissions: [] },
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

function createMockPermission(overrides: Partial<Permission> = {}): Permission {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: PERMISSION_ID_1,
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

function createMockGroup(overrides: Partial<PermissionGroup> = {}): PermissionGroup {
  return {
    id: 'group-66666666-6666-6666-6666-666666666666',
    name: 'Users',
    description: null,
    module: 'users',
    displayOrder: 0,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createService(repository: MockedPermissionRepository, roleService: MockedRoleService = createMockRoleService()): PermissionService {
  return new PermissionService(createFakeRequest(), repository as unknown as PermissionRepository, roleService as unknown as RoleService);
}

describe('PermissionService', () => {
  // ────────────────────────────────────────────────────────────────────────
  // listPermissions / listPermissionGroups
  // ────────────────────────────────────────────────────────────────────────
  describe('listPermissions', () => {
    it('delegates to repository.findAll', async () => {
      const repo = createMockRepository();
      const permissions = [createMockPermission()];
      repo.findAll.mockResolvedValue(permissions);

      const service = createService(repo);
      const result = await service.listPermissions();

      expect(result).toBe(permissions);
    });
  });

  describe('listPermissionGroups', () => {
    it('delegates to repository.findAllGroups', async () => {
      const repo = createMockRepository();
      const groups = [createMockGroup()];
      repo.findAllGroups.mockResolvedValue(groups);

      const service = createService(repo);
      const result = await service.listPermissionGroups();

      expect(result).toBe(groups);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // getPermissionMatrix
  // ────────────────────────────────────────────────────────────────────────
  describe('getPermissionMatrix', () => {
    it('propagates NotFoundError when the role does not exist (via RoleService)', async () => {
      const repo = createMockRepository();
      const roleService = createMockRoleService();
      roleService.getRoleById.mockRejectedValue(new NotFoundError('Role'));

      const service = createService(repo, roleService);

      await expect(service.getPermissionMatrix('missing-id')).rejects.toThrow(NotFoundError);
      expect(repo.findAll).not.toHaveBeenCalled();
    });

    it('returns one entry per catalog permission, flagged granted/ungranted', async () => {
      const repo = createMockRepository();
      const roleService = createMockRoleService();
      roleService.getRoleById.mockResolvedValue({ ...createMockRole(), rolePermissions: [] });
      repo.findAll.mockResolvedValue([createMockPermission({ id: PERMISSION_ID_1 }), createMockPermission({ id: PERMISSION_ID_2 })]);
      repo.findGrantedPermissionIds.mockResolvedValue(new Set([PERMISSION_ID_1]));

      const service = createService(repo, roleService);
      const result = await service.getPermissionMatrix(ROLE_ID);

      expect(result).toEqual([
        { permissionId: PERMISSION_ID_1, granted: true },
        { permissionId: PERMISSION_ID_2, granted: false },
      ]);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // updatePermissionMatrix
  // ────────────────────────────────────────────────────────────────────────
  describe('updatePermissionMatrix', () => {
    const dto: UpdatePermissionMatrixDto = { roleId: ROLE_ID, permissionId: PERMISSION_ID_1, granted: true };

    it('propagates NotFoundError when the role does not exist (via RoleService)', async () => {
      const repo = createMockRepository();
      const roleService = createMockRoleService();
      roleService.getRoleById.mockRejectedValue(new NotFoundError('Role'));

      const service = createService(repo, roleService);

      await expect(service.updatePermissionMatrix(dto)).rejects.toThrow(NotFoundError);
      expect(repo.grantPermission).not.toHaveBeenCalled();
    });

    it('throws ForbiddenError for a SYSTEM role', async () => {
      const repo = createMockRepository();
      const roleService = createMockRoleService();
      roleService.getRoleById.mockResolvedValue({ ...createMockRole({ type: RoleType.SYSTEM }), rolePermissions: [] });

      const service = createService(repo, roleService);

      await expect(service.updatePermissionMatrix(dto)).rejects.toThrow(ForbiddenError);
      expect(repo.grantPermission).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when the permissionId does not exist', async () => {
      const repo = createMockRepository();
      const roleService = createMockRoleService();
      roleService.getRoleById.mockResolvedValue({ ...createMockRole(), rolePermissions: [] });
      repo.findById.mockResolvedValue(null);

      const service = createService(repo, roleService);

      await expect(service.updatePermissionMatrix(dto)).rejects.toThrow(NotFoundError);
      expect(repo.grantPermission).not.toHaveBeenCalled();
    });

    it('grants the permission when granted is true', async () => {
      const repo = createMockRepository();
      const roleService = createMockRoleService();
      roleService.getRoleById.mockResolvedValue({ ...createMockRole(), rolePermissions: [] });
      repo.findById.mockResolvedValue(createMockPermission());

      const service = createService(repo, roleService);
      await service.updatePermissionMatrix(dto);

      expect(repo.grantPermission).toHaveBeenCalledWith(ROLE_ID, PERMISSION_ID_1, CALLER_ID);
      expect(repo.revokePermission).not.toHaveBeenCalled();
    });

    it('revokes the permission when granted is false', async () => {
      const repo = createMockRepository();
      const roleService = createMockRoleService();
      roleService.getRoleById.mockResolvedValue({ ...createMockRole(), rolePermissions: [] });
      repo.findById.mockResolvedValue(createMockPermission());

      const service = createService(repo, roleService);
      await service.updatePermissionMatrix({ ...dto, granted: false });

      expect(repo.revokePermission).toHaveBeenCalledWith(ROLE_ID, PERMISSION_ID_1);
      expect(repo.grantPermission).not.toHaveBeenCalled();
    });
  });
});
