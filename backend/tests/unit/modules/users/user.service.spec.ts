import { Request } from 'express';
import { User, UserInvitation, UserStatus, InvitationStatus, Role, RoleType, NotificationChannel } from '@prisma/client';

/**
 * See the identical comment in tests/unit/modules/contacts/contact.service.spec.ts
 * for why @config/database is stubbed, and why a working $transaction stub is
 * provided — UserService.updateUser()/deleteUser() call this.transaction()
 * for real.
 */
jest.mock('@config/database', () => ({
  prisma: { $transaction: jest.fn((operation: (tx: unknown) => unknown) => operation({})) },
}));

/**
 * Test-only stub — UserService.inviteUser()/resendInvitation() fire-and-forget
 * onto the real `emailQueue` (BullMQ), which would otherwise try to talk to a
 * real Redis connection during these unit tests. Mirrors the `@config/database`
 * stub above: test-only, does not touch production code.
 */
jest.mock('@config/queue', () => ({
  emailQueue: { add: jest.fn().mockResolvedValue(undefined) },
}));

import { UserRole } from '@shared/enums';
import { ConflictError, ForbiddenError, NotFoundError } from '@shared/errors';
import { UserService } from '@modules/users/service/user.service';
import { UserRepository } from '@modules/users/repository/user.repository';
import { UserInvitationRepository } from '@modules/users/repository/user-invitation.repository';
import type { NotificationDispatchService } from '@modules/notifications/service/notification-dispatch.service';
import { InviteUserDto, UpdateUserDto } from '@modules/users/dto/user.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * UserService — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Both repositories are fully mocked — these tests exercise only the
 * business logic in `UserService` (existence guards, owner/self-delete
 * guards, email/role/invitation-state conflict guards, DTO → repository
 * mapping), never a real database. Mirrors
 * `tests/unit/modules/contacts/contact.service.spec.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';
const CALLER_ID = 'user-22222222-2222-2222-2222-222222222222';
const TARGET_ID = 'user-33333333-3333-3333-3333-333333333333';

type MockedUserRepository = {
  [K in
    | 'findById'
    | 'search'
    | 'findByEmail'
    | 'findActiveRolesByIds'
    | 'findRolesForUser'
    | 'findActiveSessionsForUser'
    | 'update'
    | 'delete'
    | 'revokeAllSessionsAndTokens'
    | 'findOwnerByTenant']: jest.Mock;
};

type MockedUserInvitationRepository = {
  [K in 'create' | 'findById' | 'findPendingByEmail' | 'update']: jest.Mock;
};

function createMockRepository(): MockedUserRepository {
  return {
    findById: jest.fn(),
    search: jest.fn(),
    findByEmail: jest.fn(),
    findActiveRolesByIds: jest.fn(),
    findRolesForUser: jest.fn(),
    findActiveSessionsForUser: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    revokeAllSessionsAndTokens: jest.fn(),
    findOwnerByTenant: jest.fn(),
  };
}

function createMockInvitationRepository(): MockedUserInvitationRepository {
  return { create: jest.fn(), findById: jest.fn(), findPendingByEmail: jest.fn(), update: jest.fn() };
}

function createFakeRequest(): Request {
  return {
    tenant: { id: TENANT_ID, slug: 'acme', name: 'Acme & Co', planCode: 'professional', isActive: true },
    user: { id: CALLER_ID, email: 'admin@acme.test', role: UserRole.TENANT_ADMIN, tenantId: TENANT_ID, permissions: [] },
    correlationId: 'test-correlation-id',
  } as unknown as Request;
}

function createMockUser(overrides: Partial<User> = {}): User {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: TARGET_ID,
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

function createMockInvitation(overrides: Partial<UserInvitation> = {}): UserInvitation {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: 'invitation-44444444-4444-4444-4444-444444444444',
    tenantId: TENANT_ID,
    email: 'new.hire@acme.test',
    firstName: 'New',
    lastName: 'Hire',
    invitedById: CALLER_ID,
    invitedByMasterAdminId: null,
    isOwner: false,
    roleIds: ['role-55555555-5555-5555-5555-555555555555'],
    tokenHash: 'hash',
    status: InvitationStatus.PENDING,
    expiresAt: new Date('2026-01-04T00:00:00.000Z'),
    acceptedAt: null,
    acceptedById: null,
    message: null,
    createdAt: now,
    updatedAt: now,
    revokedAt: null,
    ...overrides,
  };
}

function createMockRole(overrides: Partial<Role> = {}): Role {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: 'role-55555555-5555-5555-5555-555555555555',
    tenantId: TENANT_ID,
    name: 'Staff',
    description: null,
    color: null,
    type: RoleType.CUSTOM,
    isActive: true,
    createdById: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

function createMockNotificationDispatchService(): { send: jest.Mock } {
  return { send: jest.fn().mockResolvedValue([]) };
}

function createService(
  repository: MockedUserRepository,
  invitationRepository: MockedUserInvitationRepository = createMockInvitationRepository(),
  notificationDispatchService: { send: jest.Mock } = createMockNotificationDispatchService(),
): UserService {
  return new UserService(
    createFakeRequest(),
    repository as unknown as UserRepository,
    invitationRepository as unknown as UserInvitationRepository,
    notificationDispatchService as unknown as NotificationDispatchService,
  );
}

describe('UserService', () => {
  // ────────────────────────────────────────────────────────────────────────
  // getUserById / listUsers
  // ────────────────────────────────────────────────────────────────────────
  describe('getUserById', () => {
    it('returns the user when found', async () => {
      const repo = createMockRepository();
      const user = createMockUser();
      repo.findById.mockResolvedValue(user);

      const service = createService(repo);
      const result = await service.getUserById(user.id);

      expect(repo.findById).toHaveBeenCalledWith(user.id, { tenantId: TENANT_ID });
      expect(result).toBe(user);
    });

    it('throws NotFoundError when no user matches the ID', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(null);

      const service = createService(repo);

      await expect(service.getUserById('missing-id')).rejects.toThrow(NotFoundError);
    });
  });

  describe('listUsers', () => {
    it('delegates to repository.search with the filters and pagination mapped from the query', async () => {
      const repo = createMockRepository();
      const users = [createMockUser()];
      const paginated = {
        data: users,
        meta: { page: 1, limit: 20, total: 1, totalPages: 1, hasNextPage: false, hasPrevPage: false },
      };
      repo.search.mockResolvedValue(paginated);

      const service = createService(repo);
      const result = await service.listUsers({
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        search: 'rohan',
        status: UserStatus.ACTIVE,
      });

      expect(repo.search).toHaveBeenCalledWith(
        { search: 'rohan', status: UserStatus.ACTIVE },
        { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' },
        { tenantId: TENANT_ID },
      );
      expect(result).toBe(paginated);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // getUserRoles / getUserSessions
  // ────────────────────────────────────────────────────────────────────────
  describe('getUserRoles', () => {
    it('throws NotFoundError when the user does not exist', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(null);

      const service = createService(repo);

      await expect(service.getUserRoles('missing-id')).rejects.toThrow(NotFoundError);
      expect(repo.findRolesForUser).not.toHaveBeenCalled();
    });

    it('delegates to repository.findRolesForUser using the resolved user tenantId', async () => {
      const repo = createMockRepository();
      const user = createMockUser();
      repo.findById.mockResolvedValue(user);
      const roles = [{ ...createMockRole(), rolePermissions: [] }];
      repo.findRolesForUser.mockResolvedValue(roles);

      const service = createService(repo);
      const result = await service.getUserRoles(user.id);

      expect(repo.findRolesForUser).toHaveBeenCalledWith(user.id, user.tenantId);
      expect(result).toBe(roles);
    });
  });

  describe('getUserSessions', () => {
    it('throws NotFoundError when the user does not exist', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(null);

      const service = createService(repo);

      await expect(service.getUserSessions('missing-id')).rejects.toThrow(NotFoundError);
    });

    it('maps sessions with isCurrent always false (no session claim for another user)', async () => {
      const repo = createMockRepository();
      const user = createMockUser();
      repo.findById.mockResolvedValue(user);
      repo.findActiveSessionsForUser.mockResolvedValue([
        {
          id: 'session-1',
          deviceType: 'WEB',
          deviceName: null,
          browser: 'Chrome',
          os: 'Windows',
          ipAddress: '127.0.0.1',
          locationCity: null,
          locationCountry: null,
          lastActiveAt: new Date('2026-01-01T00:00:00.000Z'),
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]);

      const service = createService(repo);
      const result = await service.getUserSessions(user.id);

      expect(repo.findActiveSessionsForUser).toHaveBeenCalledWith(user.id, user.tenantId);
      expect(result).toHaveLength(1);
      expect(result[0].isCurrent).toBe(false);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // updateUser
  // ────────────────────────────────────────────────────────────────────────
  describe('updateUser', () => {
    it('throws NotFoundError when the user does not exist', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(null);

      const service = createService(repo);

      await expect(service.updateUser('missing-id', { firstName: 'X' })).rejects.toThrow(NotFoundError);
    });

    it("throws ForbiddenError when changing the account owner's status away from ACTIVE", async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockUser({ isOwner: true, status: UserStatus.ACTIVE }));

      const service = createService(repo);
      const dto: UpdateUserDto = { status: UserStatus.SUSPENDED };

      await expect(service.updateUser(TARGET_ID, dto)).rejects.toThrow(ForbiddenError);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('updates directly (no transaction) when status is not changing away from ACTIVE', async () => {
      const repo = createMockRepository();
      const existing = createMockUser();
      repo.findById.mockResolvedValue(existing);
      const updated = createMockUser({ firstName: 'Renamed' });
      repo.update.mockResolvedValue(updated);

      const service = createService(repo);
      const dto: UpdateUserDto = { firstName: 'Renamed' };
      const result = await service.updateUser(TARGET_ID, dto);

      expect(repo.update).toHaveBeenCalledWith(TARGET_ID, dto, { tenantId: TENANT_ID });
      expect(repo.revokeAllSessionsAndTokens).not.toHaveBeenCalled();
      expect(result).toBe(updated);
    });

    it('runs update + session revocation in a transaction when status transitions away from ACTIVE, and notifies the tenant owner', async () => {
      const repo = createMockRepository();
      const existing = createMockUser({ status: UserStatus.ACTIVE, firstName: 'Rohan', lastName: 'Mehta' });
      repo.findById.mockResolvedValue(existing);
      const updated = createMockUser({ status: UserStatus.SUSPENDED });
      repo.update.mockResolvedValue(updated);
      const owner = createMockUser({ id: 'owner-id', isOwner: true });
      repo.findOwnerByTenant.mockResolvedValue(owner);

      const notificationDispatchService = createMockNotificationDispatchService();
      const service = createService(repo, createMockInvitationRepository(), notificationDispatchService);
      const dto: UpdateUserDto = { status: UserStatus.SUSPENDED };
      const result = await service.updateUser(TARGET_ID, dto);

      expect(repo.update).toHaveBeenCalledWith(TARGET_ID, dto, { tenantId: TENANT_ID, tx: {} });
      expect(repo.revokeAllSessionsAndTokens).toHaveBeenCalledWith(TARGET_ID, TENANT_ID, {});
      expect(result).toBe(updated);
      expect(notificationDispatchService.send).toHaveBeenCalledWith({
        tenantId: TENANT_ID,
        userId: owner.id,
        title: 'User deactivated',
        message: expect.stringContaining('Rohan Mehta'),
        channels: [NotificationChannel.IN_APP],
      });
    });

    it('does NOT notify when the tenant owner is the one performing the deactivation', async () => {
      const repo = createMockRepository();
      const existing = createMockUser({ status: UserStatus.ACTIVE });
      repo.findById.mockResolvedValue(existing);
      repo.update.mockResolvedValue(createMockUser({ status: UserStatus.SUSPENDED }));
      // The caller (CALLER_ID, per createFakeRequest()) *is* the owner.
      repo.findOwnerByTenant.mockResolvedValue(createMockUser({ id: CALLER_ID, isOwner: true }));

      const notificationDispatchService = createMockNotificationDispatchService();
      const service = createService(repo, createMockInvitationRepository(), notificationDispatchService);
      await service.updateUser(TARGET_ID, { status: UserStatus.SUSPENDED });

      expect(notificationDispatchService.send).not.toHaveBeenCalled();
    });

    it('does not revoke sessions when the new status equals the current status', async () => {
      const repo = createMockRepository();
      const existing = createMockUser({ status: UserStatus.SUSPENDED });
      repo.findById.mockResolvedValue(existing);
      repo.update.mockResolvedValue(existing);

      const service = createService(repo);
      await service.updateUser(TARGET_ID, { status: UserStatus.SUSPENDED });

      expect(repo.revokeAllSessionsAndTokens).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // deleteUser
  // ────────────────────────────────────────────────────────────────────────
  describe('deleteUser', () => {
    it('throws NotFoundError when the user does not exist', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(null);

      const service = createService(repo);

      await expect(service.deleteUser('missing-id')).rejects.toThrow(NotFoundError);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('throws ForbiddenError when attempting to remove the account owner', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockUser({ isOwner: true }));

      const service = createService(repo);

      await expect(service.deleteUser(TARGET_ID)).rejects.toThrow(ForbiddenError);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('throws ForbiddenError when the caller attempts to remove their own account', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockUser({ id: CALLER_ID }));

      const service = createService(repo);

      await expect(service.deleteUser(CALLER_ID)).rejects.toThrow(ForbiddenError);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('sets status DELETED, revokes sessions, and soft-deletes within a transaction', async () => {
      const repo = createMockRepository();
      const existing = createMockUser();
      repo.findById.mockResolvedValue(existing);
      repo.delete.mockResolvedValue(true);

      const service = createService(repo);
      await service.deleteUser(TARGET_ID);

      expect(repo.update).toHaveBeenCalledWith(TARGET_ID, { status: UserStatus.DELETED }, { tenantId: TENANT_ID, tx: {} });
      expect(repo.revokeAllSessionsAndTokens).toHaveBeenCalledWith(TARGET_ID, TENANT_ID, {});
      expect(repo.delete).toHaveBeenCalledWith(TARGET_ID, { tenantId: TENANT_ID, userId: CALLER_ID, tx: {} });
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // inviteUser
  // ────────────────────────────────────────────────────────────────────────
  describe('inviteUser', () => {
    const dto: InviteUserDto = {
      email: 'new.hire@acme.test',
      firstName: 'New',
      lastName: 'Hire',
      roleIds: ['role-55555555-5555-5555-5555-555555555555'],
    };

    it('throws ConflictError when a user with this email already exists', async () => {
      const repo = createMockRepository();
      repo.findByEmail.mockResolvedValue(createMockUser());

      const service = createService(repo);

      await expect(service.inviteUser(dto)).rejects.toThrow(ConflictError);
    });

    it('throws ConflictError when an invitation is already pending for this email', async () => {
      const repo = createMockRepository();
      repo.findByEmail.mockResolvedValue(null);
      const invitationRepo = createMockInvitationRepository();
      invitationRepo.findPendingByEmail.mockResolvedValue(createMockInvitation());

      const service = createService(repo, invitationRepo);

      await expect(service.inviteUser(dto)).rejects.toThrow(ConflictError);
      expect(invitationRepo.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when a roleId does not resolve to an active role in this tenant', async () => {
      const repo = createMockRepository();
      repo.findByEmail.mockResolvedValue(null);
      repo.findActiveRolesByIds.mockResolvedValue([]);
      const invitationRepo = createMockInvitationRepository();
      invitationRepo.findPendingByEmail.mockResolvedValue(null);

      const service = createService(repo, invitationRepo);

      await expect(service.inviteUser(dto)).rejects.toThrow(NotFoundError);
      expect(invitationRepo.create).not.toHaveBeenCalled();
    });

    it('creates the invitation once email/roleIds are valid and no invitation is pending', async () => {
      const repo = createMockRepository();
      repo.findByEmail.mockResolvedValue(null);
      repo.findActiveRolesByIds.mockResolvedValue([createMockRole()]);
      const invitationRepo = createMockInvitationRepository();
      invitationRepo.findPendingByEmail.mockResolvedValue(null);
      const created = createMockInvitation();
      invitationRepo.create.mockResolvedValue(created);

      const service = createService(repo, invitationRepo);
      const result = await service.inviteUser(dto);

      expect(invitationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          email: dto.email,
          firstName: dto.firstName,
          lastName: dto.lastName,
          invitedById: CALLER_ID,
          roleIds: dto.roleIds,
        }),
      );
      expect(result).toBe(created);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // resendInvitation / revokeInvitation
  // ────────────────────────────────────────────────────────────────────────
  describe('resendInvitation', () => {
    it('throws NotFoundError when the invitation does not exist', async () => {
      const repo = createMockRepository();
      const invitationRepo = createMockInvitationRepository();
      invitationRepo.findById.mockResolvedValue(null);

      const service = createService(repo, invitationRepo);

      await expect(service.resendInvitation('missing-id')).rejects.toThrow(NotFoundError);
    });

    it('throws ConflictError when the invitation was already accepted', async () => {
      const repo = createMockRepository();
      const invitationRepo = createMockInvitationRepository();
      invitationRepo.findById.mockResolvedValue(createMockInvitation({ status: InvitationStatus.ACCEPTED }));

      const service = createService(repo, invitationRepo);

      await expect(service.resendInvitation('inv-1')).rejects.toThrow(ConflictError);
      expect(invitationRepo.update).not.toHaveBeenCalled();
    });

    it('throws ConflictError when the invitation was revoked', async () => {
      const repo = createMockRepository();
      const invitationRepo = createMockInvitationRepository();
      invitationRepo.findById.mockResolvedValue(createMockInvitation({ status: InvitationStatus.REVOKED }));

      const service = createService(repo, invitationRepo);

      await expect(service.resendInvitation('inv-1')).rejects.toThrow(ConflictError);
      expect(invitationRepo.update).not.toHaveBeenCalled();
    });

    it('reissues the token/expiry and resets status to PENDING when currently PENDING or EXPIRED', async () => {
      const repo = createMockRepository();
      const invitationRepo = createMockInvitationRepository();
      const invitation = createMockInvitation({ status: InvitationStatus.EXPIRED });
      invitationRepo.findById.mockResolvedValue(invitation);
      invitationRepo.update.mockResolvedValue({ ...invitation, status: InvitationStatus.PENDING });

      const service = createService(repo, invitationRepo);
      await service.resendInvitation(invitation.id);

      expect(invitationRepo.update).toHaveBeenCalledWith(
        invitation.id,
        expect.objectContaining({ status: InvitationStatus.PENDING }),
      );
    });
  });

  describe('revokeInvitation', () => {
    it('throws NotFoundError when the invitation does not exist', async () => {
      const repo = createMockRepository();
      const invitationRepo = createMockInvitationRepository();
      invitationRepo.findById.mockResolvedValue(null);

      const service = createService(repo, invitationRepo);

      await expect(service.revokeInvitation('missing-id')).rejects.toThrow(NotFoundError);
    });

    it('throws ConflictError when the invitation was already accepted', async () => {
      const repo = createMockRepository();
      const invitationRepo = createMockInvitationRepository();
      invitationRepo.findById.mockResolvedValue(createMockInvitation({ status: InvitationStatus.ACCEPTED }));

      const service = createService(repo, invitationRepo);

      await expect(service.revokeInvitation('inv-1')).rejects.toThrow(ConflictError);
      expect(invitationRepo.update).not.toHaveBeenCalled();
    });

    it('marks the invitation REVOKED when currently PENDING', async () => {
      const repo = createMockRepository();
      const invitationRepo = createMockInvitationRepository();
      const invitation = createMockInvitation({ status: InvitationStatus.PENDING });
      invitationRepo.findById.mockResolvedValue(invitation);
      invitationRepo.update.mockResolvedValue({ ...invitation, status: InvitationStatus.REVOKED });

      const service = createService(repo, invitationRepo);
      await service.revokeInvitation(invitation.id);

      expect(invitationRepo.update).toHaveBeenCalledWith(
        invitation.id,
        expect.objectContaining({ status: InvitationStatus.REVOKED }),
      );
    });
  });
});
