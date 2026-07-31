/**
 * `AuthRepository`/`UserRepository`/`UserInvitationRepository` are all
 * injected as full mocks via the constructor below, so the real singleton is
 * never touched — but `resetPassword()`/`acceptInvite()` call
 * `this.transaction()` (BaseService → `prisma.$transaction`) for real, so a
 * working stub is provided, mirroring
 * tests/unit/modules/users/user.service.spec.ts's identical setup.
 */
jest.mock('@config/database', () => ({
  prisma: {
    $transaction: jest.fn((operation: (tx: unknown) => unknown) =>
      operation({ userRole: { createMany: jest.fn().mockResolvedValue({ count: 0 }) } }),
    ),
  },
}));

/**
 * Test-only stub — AuthService.forgotPassword() fire-and-forgets onto the
 * real `emailQueue` (BullMQ), which would otherwise try to talk to a real
 * Redis connection during these unit tests. Mirrors
 * tests/unit/modules/users/user.service.spec.ts's identical stub.
 */
jest.mock('@config/queue', () => ({
  emailQueue: { add: jest.fn().mockResolvedValue(undefined) },
}));

// bcryptjs is mocked for determinism/speed — every other dependency (jsonwebtoken, CryptoUtils)
// runs for real, using the real JWT secrets already loaded from .env by tests/setup.ts.
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

import { Request } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
  User,
  UserSession,
  RefreshToken,
  PasswordResetToken,
  UserInvitation,
  Role,
  Tenant,
  UserStatus,
  TenantStatus,
  SessionStatus,
  SessionDeviceType,
  InvitationStatus,
  RoleType,
} from '@prisma/client';
import { jwtConfig } from '@config/jwt';
import { UnauthorizedError, ForbiddenError, ConflictError, NotFoundError } from '@shared/errors';
import { PASSWORD, TOKEN } from '@shared/constants';
import { CryptoUtils } from '@shared/utils';
import { AuthService } from '@modules/auth/service/auth.service';
import { AuthRepository } from '@modules/auth/repository/auth.repository';
import { UserRepository } from '@modules/users/repository/user.repository';
import { UserInvitationRepository } from '@modules/users/repository/user-invitation.repository';
import { emailQueue } from '@config/queue';
import type {
  AcceptInviteDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  ResetPasswordDto,
  RequestMeta,
} from '@modules/auth/dto/auth.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * AuthService — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `AuthRepository` is fully mocked — these tests exercise only the business
 * logic in `AuthService` (lockout/lockout-reset, password verification,
 * refresh-token rotation and reuse-detection, session revocation), never a
 * real database. Mocks are injected via the service's constructor DI
 * parameter, exactly as designed for this. Mirrors
 * `tests/unit/modules/crm/lead.service.spec.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';
const USER_ID = 'user-22222222-2222-2222-2222-222222222222';
const SESSION_ID = 'session-33333333-3333-3333-3333-333333333333';
const OTHER_SESSION_ID = 'session-44444444-4444-4444-4444-444444444444';

const META: RequestMeta = {
  ipAddress: '203.0.113.5',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
};

type MockedAuthRepository = {
  [K in keyof AuthRepository]: jest.Mock;
};

function createMockAuthRepository(): MockedAuthRepository {
  return {
    findUserByEmail: jest.fn(),
    findUserById: jest.fn(),
    recordFailedLogin: jest.fn(),
    recordSuccessfulLogin: jest.fn(),
    updatePassword: jest.fn(),
    findTenantById: jest.fn(),
    resolvePermissionCodes: jest.fn(),
    createSession: jest.fn(),
    touchSession: jest.fn(),
    findActiveSessionsByUser: jest.fn(),
    findSessionById: jest.fn(),
    revokeSession: jest.fn(),
    revokeAllSessionsExcept: jest.fn(),
    createRefreshToken: jest.fn(),
    findRefreshTokenByHash: jest.fn(),
    markRefreshTokenUsed: jest.fn(),
    revokeRefreshTokenFamily: jest.fn(),
    revokeRefreshTokensBySession: jest.fn(),
    createPasswordResetToken: jest.fn(),
    findPasswordResetTokenByHash: jest.fn(),
    markPasswordResetTokenUsed: jest.fn(),
    invalidatePasswordResetTokens: jest.fn(),
    recordLoginHistory: jest.fn(),
    createPasswordHistory: jest.fn(),
    getRecentPasswordHashes: jest.fn(),
  } as unknown as MockedAuthRepository;
}

type MockedUserRepository = { [K in keyof UserRepository]: jest.Mock };

function createMockUserRepository(): MockedUserRepository {
  return {
    findByEmail: jest.fn(),
    findActiveRolesByIds: jest.fn(),
    findRolesForUser: jest.fn(),
    findActiveSessionsForUser: jest.fn(),
    revokeAllSessionsAndTokens: jest.fn(),
    create: jest.fn(),
    search: jest.fn(),
    findById: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    paginate: jest.fn(),
  } as unknown as MockedUserRepository;
}

type MockedUserInvitationRepository = { [K in keyof UserInvitationRepository]: jest.Mock };

function createMockUserInvitationRepository(): MockedUserInvitationRepository {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    findPendingByEmail: jest.fn(),
    findByTokenHash: jest.fn(),
    update: jest.fn(),
  } as unknown as MockedUserInvitationRepository;
}

function createFakeRequest(): Request {
  return { correlationId: 'test-correlation-id' } as unknown as Request;
}

function createFakeAuthenticatedRequest(): Request {
  return {
    tenant: { id: TENANT_ID, slug: 'acme', name: 'Acme & Co', planCode: 'professional', isActive: true },
    user: { id: USER_ID, email: 'user@acme.test', role: 'STAFF', tenantId: TENANT_ID, permissions: [] },
    correlationId: 'test-correlation-id',
  } as unknown as Request;
}

function createMockUser(overrides: Partial<User> = {}): User {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: USER_ID,
    tenantId: TENANT_ID,
    email: 'user@acme.test',
    passwordHash: 'hashed-password',
    firstName: 'Aditi',
    lastName: 'Kapoor',
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
    subscriptionStatus: 'ACTIVE',
    subscriptionExpiresAt: null,
    planCode: 'professional',
    maxUsers: null,
    maxClients: null,
    maxStorageGb: null,
    maxDocuments: null,
    onboardingCompletedAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(overrides as any),
  } as Tenant;
}

function createMockSession(overrides: Partial<UserSession> = {}): UserSession {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: SESSION_ID,
    tenantId: TENANT_ID,
    userId: USER_ID,
    tokenHash: 'session-token-hash',
    deviceType: SessionDeviceType.WEB,
    deviceName: null,
    deviceFingerprint: null,
    browser: 'Chrome',
    os: 'Windows',
    ipAddress: META.ipAddress,
    userAgent: META.userAgent,
    locationCity: null,
    locationCountry: null,
    status: SessionStatus.ACTIVE,
    // Relative to the real clock, not the fixed `now` above (this needs to be a real future
    // date regardless of when the test actually runs, e.g. for the "not expired" branch).
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    lastActiveAt: now,
    revokedAt: null,
    revokeReason: null,
    createdAt: now,
    ...overrides,
  };
}

function createMockRefreshToken(overrides: Partial<RefreshToken> = {}): RefreshToken {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: 'refresh-55555555-5555-5555-5555-555555555555',
    tenantId: TENANT_ID,
    userId: USER_ID,
    sessionId: SESSION_ID,
    tokenHash: 'refresh-token-hash',
    familyId: 'family-66666666-6666-6666-6666-666666666666',
    sequence: 1,
    isUsed: false,
    usedAt: null,
    rotatedToId: null,
    // Relative to the real clock, not the fixed `now` above - see createMockSession's identical comment.
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    revokedAt: null,
    revokeReason: null,
    ipAddress: META.ipAddress,
    userAgent: META.userAgent,
    createdAt: now,
    ...overrides,
  };
}

function createMockPasswordResetToken(overrides: Partial<PasswordResetToken> = {}): PasswordResetToken {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: 'reset-77777777-7777-7777-7777-777777777777',
    tenantId: TENANT_ID,
    userId: USER_ID,
    tokenHash: CryptoUtils.sha256('raw-reset-token'),
    isUsed: false,
    usedAt: null,
    revokedAt: null,
    // Relative to the real clock — see createMockSession's identical comment.
    expiresAt: new Date(Date.now() + TOKEN.PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000),
    ipAddress: META.ipAddress,
    userAgent: META.userAgent,
    createdAt: now,
    ...overrides,
  };
}

const INVITATION_ID = 'invitation-88888888-8888-8888-8888-888888888888';
const INVITER_ID = 'user-99999999-9999-9999-9999-999999999999';
const ROLE_ID = 'role-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

function createMockInvitation(overrides: Partial<UserInvitation> = {}): UserInvitation {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: INVITATION_ID,
    tenantId: TENANT_ID,
    email: 'invitee@acme.test',
    firstName: null,
    lastName: null,
    invitedById: INVITER_ID,
    roleIds: [ROLE_ID],
    tokenHash: CryptoUtils.sha256('raw-invite-token'),
    status: InvitationStatus.PENDING,
    // Relative to the real clock — see createMockSession's identical comment.
    expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
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
    id: ROLE_ID,
    tenantId: TENANT_ID,
    name: 'Staff',
    description: null,
    color: null,
    type: RoleType.CUSTOM,
    isActive: true,
    createdById: INVITER_ID,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

function createService(
  repository: MockedAuthRepository,
  req: Request = createFakeRequest(),
  userRepository: MockedUserRepository = createMockUserRepository(),
  userInvitationRepository: MockedUserInvitationRepository = createMockUserInvitationRepository(),
): AuthService {
  return new AuthService(
    req,
    repository as unknown as AuthRepository,
    undefined,
    userRepository as unknown as UserRepository,
    userInvitationRepository as unknown as UserInvitationRepository,
  );
}

describe('AuthService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ────────────────────────────────────────────────────────────────────────
  // login
  // ────────────────────────────────────────────────────────────────────────
  describe('login', () => {
    const dto: LoginDto = { email: 'user@acme.test', password: 'Password123!' };

    it('throws UnauthorizedError and records a failed login when no user matches the email', async () => {
      const repo = createMockAuthRepository();
      repo.findUserByEmail.mockResolvedValue(null);

      const service = createService(repo);

      await expect(service.login(dto, META)).rejects.toThrow(UnauthorizedError);
      expect(repo.recordLoginHistory).toHaveBeenCalledWith(
        expect.objectContaining({ email: dto.email, status: 'FAILURE' }),
      );
      expect(repo.createSession).not.toHaveBeenCalled();
    });

    it('throws ForbiddenError when the account is locked', async () => {
      const repo = createMockAuthRepository();
      repo.findUserByEmail.mockResolvedValue(createMockUser({ lockedUntil: new Date(Date.now() + 60_000) }));

      const service = createService(repo);

      await expect(service.login(dto, META)).rejects.toThrow(ForbiddenError);
    });

    it('throws ForbiddenError when the account is not ACTIVE', async () => {
      const repo = createMockAuthRepository();
      repo.findUserByEmail.mockResolvedValue(createMockUser({ status: UserStatus.INACTIVE }));

      const service = createService(repo);

      await expect(service.login(dto, META)).rejects.toThrow(ForbiddenError);
    });

    it('throws UnauthorizedError and increments failedLoginCount on a wrong password', async () => {
      const repo = createMockAuthRepository();
      const user = createMockUser({ failedLoginCount: 2 });
      repo.findUserByEmail.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const service = createService(repo);

      await expect(service.login(dto, META)).rejects.toThrow(UnauthorizedError);
      expect(repo.recordFailedLogin).toHaveBeenCalledWith(user.id, 3, null);
    });

    it('locks the account once failedLoginCount reaches PASSWORD.MAX_FAILED_ATTEMPTS', async () => {
      const repo = createMockAuthRepository();
      const user = createMockUser({ failedLoginCount: PASSWORD.MAX_FAILED_ATTEMPTS - 1 });
      repo.findUserByEmail.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const service = createService(repo);
      await expect(service.login(dto, META)).rejects.toThrow(UnauthorizedError);

      expect(repo.recordFailedLogin).toHaveBeenCalledWith(user.id, PASSWORD.MAX_FAILED_ATTEMPTS, expect.any(Date));
    });

    it('throws ForbiddenError when the tenant is not active', async () => {
      const repo = createMockAuthRepository();
      repo.findUserByEmail.mockResolvedValue(createMockUser());
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      repo.findTenantById.mockResolvedValue(createMockTenant({ status: TenantStatus.SUSPENDED }));

      const service = createService(repo);

      await expect(service.login(dto, META)).rejects.toThrow(ForbiddenError);
      expect(repo.createSession).not.toHaveBeenCalled();
    });

    it('on success: creates a session + refresh token, resets failed-login state, and returns real tokens', async () => {
      const repo = createMockAuthRepository();
      const user = createMockUser();
      repo.findUserByEmail.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      repo.findTenantById.mockResolvedValue(createMockTenant());
      repo.resolvePermissionCodes.mockResolvedValue(['business:read']);
      repo.createSession.mockResolvedValue(createMockSession());
      repo.createRefreshToken.mockResolvedValue(createMockRefreshToken());

      const service = createService(repo);
      const result = await service.login(dto, META);

      expect(repo.createSession).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: user.tenantId, userId: user.id, browser: 'Chrome', os: 'Windows' }),
      );
      expect(repo.createRefreshToken).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: SESSION_ID, sequence: 1 }),
      );
      expect(repo.recordSuccessfulLogin).toHaveBeenCalledWith(user.id);
      expect(result.user).toEqual({
        id: user.id,
        email: user.email,
        role: 'STAFF',
        tenantId: user.tenantId,
        permissions: ['business:read'],
        firstName: user.firstName,
        lastName: user.lastName,
      });
      expect(result.tenant.id).toBe(TENANT_ID);
      expect(typeof result.accessToken).toBe('string');
      expect(typeof result.refreshToken).toBe('string');

      const decoded = jwt.verify(result.accessToken, jwtConfig.access.secret) as { sub: string; permissions: string[] };
      expect(decoded.sub).toBe(user.id);
      expect(decoded.permissions).toEqual(['business:read']);
    });

    it('resolves role TENANT_ADMIN for an owner user', async () => {
      const repo = createMockAuthRepository();
      repo.findUserByEmail.mockResolvedValue(createMockUser({ isOwner: true }));
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      repo.findTenantById.mockResolvedValue(createMockTenant());
      repo.resolvePermissionCodes.mockResolvedValue([]);
      repo.createSession.mockResolvedValue(createMockSession());
      repo.createRefreshToken.mockResolvedValue(createMockRefreshToken());

      const service = createService(repo);
      const result = await service.login(dto, META);

      expect(result.user.role).toBe('TENANT_ADMIN');
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // refresh
  // ────────────────────────────────────────────────────────────────────────
  describe('refresh', () => {
    it('throws UnauthorizedError when the refresh token does not exist', async () => {
      const repo = createMockAuthRepository();
      repo.findRefreshTokenByHash.mockResolvedValue(null);

      const service = createService(repo);

      await expect(service.refresh({ refreshToken: 'bogus' }, META)).rejects.toThrow(UnauthorizedError);
    });

    it('detects reuse (isUsed) and revokes the whole family + session instead of rotating', async () => {
      const repo = createMockAuthRepository();
      repo.findRefreshTokenByHash.mockResolvedValue(createMockRefreshToken({ isUsed: true }));

      const service = createService(repo);

      await expect(service.refresh({ refreshToken: 'stale-token' }, META)).rejects.toThrow(UnauthorizedError);
      expect(repo.revokeRefreshTokenFamily).toHaveBeenCalledWith(
        'family-66666666-6666-6666-6666-666666666666',
        'FAMILY_COMPROMISED',
      );
      expect(repo.revokeSession).toHaveBeenCalledWith(SESSION_ID, 'SUSPICIOUS_ACTIVITY');
      expect(repo.createRefreshToken).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedError when the token is expired', async () => {
      const repo = createMockAuthRepository();
      repo.findRefreshTokenByHash.mockResolvedValue(createMockRefreshToken({ expiresAt: new Date(Date.now() - 1000) }));

      const service = createService(repo);

      await expect(service.refresh({ refreshToken: 'expired' }, META)).rejects.toThrow(UnauthorizedError);
    });

    it('throws UnauthorizedError when the token has been revoked', async () => {
      const repo = createMockAuthRepository();
      repo.findRefreshTokenByHash.mockResolvedValue(createMockRefreshToken({ revokedAt: new Date() }));

      const service = createService(repo);

      await expect(service.refresh({ refreshToken: 'revoked' }, META)).rejects.toThrow(UnauthorizedError);
    });

    it('throws ForbiddenError when the user is no longer active', async () => {
      const repo = createMockAuthRepository();
      repo.findRefreshTokenByHash.mockResolvedValue(createMockRefreshToken());
      repo.findUserById.mockResolvedValue(createMockUser({ status: UserStatus.INACTIVE }));

      const service = createService(repo);

      await expect(service.refresh({ refreshToken: 'valid' }, META)).rejects.toThrow(ForbiddenError);
    });

    it('on success: rotates the token (marks old used, creates a new one in the same family, bumps sequence)', async () => {
      const repo = createMockAuthRepository();
      const tokenRow = createMockRefreshToken();
      repo.findRefreshTokenByHash.mockResolvedValue(tokenRow);
      repo.findUserById.mockResolvedValue(createMockUser());
      repo.resolvePermissionCodes.mockResolvedValue(['crm:read']);
      const newTokenRow = createMockRefreshToken({ id: 'refresh-new', sequence: 2 });
      repo.createRefreshToken.mockResolvedValue(newTokenRow);

      const service = createService(repo);
      const result = await service.refresh({ refreshToken: 'valid-token' }, META);

      expect(repo.createRefreshToken).toHaveBeenCalledWith(
        expect.objectContaining({ familyId: tokenRow.familyId, sequence: tokenRow.sequence + 1, sessionId: tokenRow.sessionId }),
      );
      expect(repo.markRefreshTokenUsed).toHaveBeenCalledWith(tokenRow.id, newTokenRow.id);
      expect(repo.touchSession).toHaveBeenCalledWith(tokenRow.sessionId);
      expect(typeof result.accessToken).toBe('string');
      expect(typeof result.refreshToken).toBe('string');
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // logout / sessions
  // ────────────────────────────────────────────────────────────────────────
  describe('logout', () => {
    it('revokes the matching session and its refresh tokens', async () => {
      const repo = createMockAuthRepository();
      repo.findRefreshTokenByHash.mockResolvedValue(createMockRefreshToken());

      const service = createService(repo, createFakeAuthenticatedRequest());
      await service.logout({ refreshToken: 'my-token' });

      expect(repo.revokeRefreshTokensBySession).toHaveBeenCalledWith(SESSION_ID, 'LOGOUT');
      expect(repo.revokeSession).toHaveBeenCalledWith(SESSION_ID, 'LOGOUT');
    });

    it('does nothing (no throw) when the token belongs to a different user', async () => {
      const repo = createMockAuthRepository();
      repo.findRefreshTokenByHash.mockResolvedValue(createMockRefreshToken({ userId: 'someone-else' }));

      const service = createService(repo, createFakeAuthenticatedRequest());
      await service.logout({ refreshToken: 'not-mine' });

      expect(repo.revokeSession).not.toHaveBeenCalled();
    });
  });

  describe('listSessions', () => {
    it('returns every active session with isCurrent always false', async () => {
      const repo = createMockAuthRepository();
      repo.findActiveSessionsByUser.mockResolvedValue([createMockSession(), createMockSession({ id: OTHER_SESSION_ID })]);

      const service = createService(repo, createFakeAuthenticatedRequest());
      const result = await service.listSessions();

      expect(result).toHaveLength(2);
      expect(result.every((s) => s.isCurrent === false)).toBe(true);
    });
  });

  describe('revokeSession', () => {
    it('throws NotFoundError when the session does not belong to the caller', async () => {
      const repo = createMockAuthRepository();
      repo.findSessionById.mockResolvedValue(null);

      const service = createService(repo, createFakeAuthenticatedRequest());

      await expect(service.revokeSession(OTHER_SESSION_ID)).rejects.toThrow(NotFoundError);
    });

    it('revokes the session and its refresh tokens on success', async () => {
      const repo = createMockAuthRepository();
      repo.findSessionById.mockResolvedValue(createMockSession());

      const service = createService(repo, createFakeAuthenticatedRequest());
      await service.revokeSession(SESSION_ID);

      expect(repo.revokeRefreshTokensBySession).toHaveBeenCalledWith(SESSION_ID, 'SESSION_REVOKED');
      expect(repo.revokeSession).toHaveBeenCalledWith(SESSION_ID, 'DEVICE_REMOVED');
    });
  });

  describe('logoutAllSessions', () => {
    it('revokes every session when no refreshToken is given', async () => {
      const repo = createMockAuthRepository();
      repo.revokeAllSessionsExcept.mockResolvedValue(3);

      const service = createService(repo, createFakeAuthenticatedRequest());
      const result = await service.logoutAllSessions({});

      expect(repo.revokeAllSessionsExcept).toHaveBeenCalledWith(USER_ID, undefined, 'LOGOUT');
      expect(result.revokedCount).toBe(3);
    });

    it('excludes the session matching the given refreshToken', async () => {
      const repo = createMockAuthRepository();
      repo.findRefreshTokenByHash.mockResolvedValue(createMockRefreshToken());
      repo.revokeAllSessionsExcept.mockResolvedValue(1);

      const service = createService(repo, createFakeAuthenticatedRequest());
      await service.logoutAllSessions({ refreshToken: 'keep-me' });

      expect(repo.revokeAllSessionsExcept).toHaveBeenCalledWith(USER_ID, SESSION_ID, 'LOGOUT');
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // me
  // ────────────────────────────────────────────────────────────────────────
  describe('me', () => {
    it('returns the caller\'s own profile with resolved permissions', async () => {
      const repo = createMockAuthRepository();
      repo.findUserById.mockResolvedValue(createMockUser());
      repo.resolvePermissionCodes.mockResolvedValue(['documents:read']);

      const service = createService(repo, createFakeAuthenticatedRequest());
      const result = await service.me();

      expect(result.id).toBe(USER_ID);
      expect(result.permissions).toEqual(['documents:read']);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // changePassword
  // ────────────────────────────────────────────────────────────────────────
  describe('changePassword', () => {
    const dto: ChangePasswordDto = { currentPassword: 'OldPassword123!', newPassword: 'NewPassword456!' };

    it('throws UnauthorizedError when the current password is wrong', async () => {
      const repo = createMockAuthRepository();
      repo.findUserById.mockResolvedValue(createMockUser());
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const service = createService(repo, createFakeAuthenticatedRequest());

      await expect(service.changePassword(dto)).rejects.toThrow(UnauthorizedError);
    });

    it('throws ConflictError when the new password matches the current password', async () => {
      const repo = createMockAuthRepository();
      repo.findUserById.mockResolvedValue(createMockUser());
      repo.getRecentPasswordHashes.mockResolvedValue([]);
      // Every bcrypt.compare call resolves true: the current-password check passes, and so does
      // the reuse check against user.passwordHash (the "new" password matches the current one).
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const service = createService(repo, createFakeAuthenticatedRequest());

      await expect(service.changePassword(dto)).rejects.toThrow(ConflictError);
    });

    it('throws ConflictError when the new password matches a recent password in history', async () => {
      const repo = createMockAuthRepository();
      repo.findUserById.mockResolvedValue(createMockUser());
      repo.getRecentPasswordHashes.mockResolvedValue(['old-hash-1', 'old-hash-2']);
      (bcrypt.compare as jest.Mock).mockImplementation(
        async (plain: string, hash: string) => plain === dto.currentPassword || hash === 'old-hash-2',
      );

      const service = createService(repo, createFakeAuthenticatedRequest());

      await expect(service.changePassword(dto)).rejects.toThrow(ConflictError);
    });

    it('on success: hashes+saves the new password, archives the old one, and revokes every session', async () => {
      const repo = createMockAuthRepository();
      const user = createMockUser();
      repo.findUserById.mockResolvedValue(user);
      repo.getRecentPasswordHashes.mockResolvedValue([]);
      (bcrypt.compare as jest.Mock).mockImplementation(async (plain: string) => plain === dto.currentPassword);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password');

      const service = createService(repo, createFakeAuthenticatedRequest());
      await service.changePassword(dto);

      expect(repo.createPasswordHistory).toHaveBeenCalledWith(user.tenantId, user.id, user.passwordHash);
      expect(repo.updatePassword).toHaveBeenCalledWith(user.id, 'new-hashed-password');
      expect(repo.revokeAllSessionsExcept).toHaveBeenCalledWith(user.id, undefined, 'PASSWORD_CHANGE');
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // forgotPassword
  // ────────────────────────────────────────────────────────────────────────
  describe('forgotPassword', () => {
    const dto: ForgotPasswordDto = { email: 'user@acme.test' };

    it('does nothing observable when no user matches the email (prevents enumeration)', async () => {
      const repo = createMockAuthRepository();
      repo.findUserByEmail.mockResolvedValue(null);

      const service = createService(repo);
      await service.forgotPassword(dto, META);

      expect(repo.createPasswordResetToken).not.toHaveBeenCalled();
      expect(repo.recordLoginHistory).not.toHaveBeenCalled();
      expect(emailQueue.add).not.toHaveBeenCalled();
    });

    it('does nothing observable for a non-ACTIVE user (same as unknown email)', async () => {
      const repo = createMockAuthRepository();
      repo.findUserByEmail.mockResolvedValue(createMockUser({ status: UserStatus.INACTIVE }));

      const service = createService(repo);
      await service.forgotPassword(dto, META);

      expect(repo.createPasswordResetToken).not.toHaveBeenCalled();
      expect(emailQueue.add).not.toHaveBeenCalled();
    });

    it('on a real ACTIVE user: invalidates old tokens, issues a new one, logs history, and queues the email', async () => {
      const repo = createMockAuthRepository();
      const user = createMockUser();
      repo.findUserByEmail.mockResolvedValue(user);

      const service = createService(repo);
      await service.forgotPassword(dto, META);

      expect(repo.invalidatePasswordResetTokens).toHaveBeenCalledWith(user.id);
      expect(repo.createPasswordResetToken).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: user.tenantId, userId: user.id, ipAddress: META.ipAddress, userAgent: META.userAgent }),
      );
      // The raw token is never persisted — only its hash.
      const createCall = repo.createPasswordResetToken.mock.calls[0][0];
      expect(createCall.tokenHash).toHaveLength(64);
      expect(createCall.tokenHash).not.toMatch(/^raw-/);

      expect(repo.recordLoginHistory).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'PASSWORD_RESET_REQUEST', status: 'SUCCESS', userId: user.id }),
      );
      expect(emailQueue.add).toHaveBeenCalledWith(
        'password-reset',
        expect.objectContaining({ to: user.email, template: 'password-reset' }),
      );
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // resetPassword
  // ────────────────────────────────────────────────────────────────────────
  describe('resetPassword', () => {
    const dto: ResetPasswordDto = { token: 'raw-reset-token', newPassword: 'NewPassword456!' };

    it('throws UnauthorizedError when no token matches the hash', async () => {
      const repo = createMockAuthRepository();
      repo.findPasswordResetTokenByHash.mockResolvedValue(null);

      const service = createService(repo);

      await expect(service.resetPassword(dto, META)).rejects.toThrow(UnauthorizedError);
    });

    it('throws UnauthorizedError for an already-used token (replay attack)', async () => {
      const repo = createMockAuthRepository();
      repo.findPasswordResetTokenByHash.mockResolvedValue(createMockPasswordResetToken({ isUsed: true }));

      const service = createService(repo);

      await expect(service.resetPassword(dto, META)).rejects.toThrow(UnauthorizedError);
      expect(repo.updatePassword).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedError for a revoked token (superseded by a newer forgot-password request)', async () => {
      const repo = createMockAuthRepository();
      repo.findPasswordResetTokenByHash.mockResolvedValue(createMockPasswordResetToken({ revokedAt: new Date() }));

      const service = createService(repo);

      await expect(service.resetPassword(dto, META)).rejects.toThrow(UnauthorizedError);
    });

    it('throws UnauthorizedError for an expired token', async () => {
      const repo = createMockAuthRepository();
      repo.findPasswordResetTokenByHash.mockResolvedValue(createMockPasswordResetToken({ expiresAt: new Date(Date.now() - 1000) }));

      const service = createService(repo);

      await expect(service.resetPassword(dto, META)).rejects.toThrow(UnauthorizedError);
    });

    it('throws UnauthorizedError when the token is valid but the user is no longer ACTIVE', async () => {
      const repo = createMockAuthRepository();
      repo.findPasswordResetTokenByHash.mockResolvedValue(createMockPasswordResetToken());
      repo.findUserById.mockResolvedValue(createMockUser({ status: UserStatus.SUSPENDED }));

      const service = createService(repo);

      await expect(service.resetPassword(dto, META)).rejects.toThrow(UnauthorizedError);
      expect(repo.updatePassword).not.toHaveBeenCalled();
    });

    it('on success: marks the token used, rotates the password hash, and revokes every session + refresh token', async () => {
      const repo = createMockAuthRepository();
      const tokenRow = createMockPasswordResetToken();
      const user = createMockUser();
      repo.findPasswordResetTokenByHash.mockResolvedValue(tokenRow);
      repo.findUserById.mockResolvedValue(user);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password');
      const userRepo = createMockUserRepository();

      const service = createService(repo, createFakeRequest(), userRepo);
      await service.resetPassword(dto, META);

      expect(repo.markPasswordResetTokenUsed).toHaveBeenCalledWith(tokenRow.id, expect.anything());
      expect(repo.updatePassword).toHaveBeenCalledWith(user.id, 'new-hashed-password', expect.anything());
      // Revokes BOTH sessions and refresh tokens (not just sessions) — the explicit requirement
      // this flow has beyond changePassword()'s session-only revocation.
      expect(userRepo.revokeAllSessionsAndTokens).toHaveBeenCalledWith(user.id, user.tenantId, expect.anything());
      expect(repo.recordLoginHistory).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'PASSWORD_RESET_SUCCESS', status: 'SUCCESS', userId: user.id }),
      );
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // getInviteInfo
  // ────────────────────────────────────────────────────────────────────────
  describe('getInviteInfo', () => {
    it('throws NotFoundError when no invitation matches the token', async () => {
      const invitationRepo = createMockUserInvitationRepository();
      invitationRepo.findByTokenHash.mockResolvedValue(null);

      const service = createService(createMockAuthRepository(), createFakeRequest(), createMockUserRepository(), invitationRepo);

      await expect(service.getInviteInfo('bogus-token')).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError and persists EXPIRED for a PENDING invitation past its expiresAt', async () => {
      const invitationRepo = createMockUserInvitationRepository();
      const invitation = createMockInvitation({ expiresAt: new Date(Date.now() - 1000) });
      invitationRepo.findByTokenHash.mockResolvedValue(invitation);

      const service = createService(createMockAuthRepository(), createFakeRequest(), createMockUserRepository(), invitationRepo);

      await expect(service.getInviteInfo('expired-token')).rejects.toThrow(NotFoundError);
      expect(invitationRepo.update).toHaveBeenCalledWith(invitation.id, { status: InvitationStatus.EXPIRED });
    });

    it('throws NotFoundError for an already-ACCEPTED invitation (no replay)', async () => {
      const invitationRepo = createMockUserInvitationRepository();
      invitationRepo.findByTokenHash.mockResolvedValue(createMockInvitation({ status: InvitationStatus.ACCEPTED }));

      const service = createService(createMockAuthRepository(), createFakeRequest(), createMockUserRepository(), invitationRepo);

      await expect(service.getInviteInfo('already-used')).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError for a REVOKED invitation', async () => {
      const invitationRepo = createMockUserInvitationRepository();
      invitationRepo.findByTokenHash.mockResolvedValue(createMockInvitation({ status: InvitationStatus.REVOKED }));

      const service = createService(createMockAuthRepository(), createFakeRequest(), createMockUserRepository(), invitationRepo);

      await expect(service.getInviteInfo('revoked')).rejects.toThrow(NotFoundError);
    });

    it('on a valid PENDING invitation: returns email/tenantName/inviterName/role', async () => {
      const authRepo = createMockAuthRepository();
      const userRepo = createMockUserRepository();
      const invitationRepo = createMockUserInvitationRepository();
      const invitation = createMockInvitation();
      invitationRepo.findByTokenHash.mockResolvedValue(invitation);
      authRepo.findTenantById.mockResolvedValue(createMockTenant({ name: 'Acme & Co' }));
      authRepo.findUserById.mockResolvedValue(createMockUser({ id: INVITER_ID, firstName: 'Rohan', lastName: 'Mehta' }));
      userRepo.findActiveRolesByIds.mockResolvedValue([createMockRole({ name: 'Staff' })]);

      const service = createService(authRepo, createFakeRequest(), userRepo, invitationRepo);
      const result = await service.getInviteInfo('valid-token');

      expect(result).toEqual({
        email: invitation.email,
        tenantName: 'Acme & Co',
        inviterName: 'Rohan Mehta',
        role: 'Staff',
      });
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // acceptInvite
  // ────────────────────────────────────────────────────────────────────────
  describe('acceptInvite', () => {
    const dto: AcceptInviteDto = { fullName: 'Priya Singh', password: 'NewPassword456!' };

    it('throws UnauthorizedError when no invitation matches the token', async () => {
      const invitationRepo = createMockUserInvitationRepository();
      invitationRepo.findByTokenHash.mockResolvedValue(null);

      const service = createService(createMockAuthRepository(), createFakeRequest(), createMockUserRepository(), invitationRepo);

      await expect(service.acceptInvite('bogus-token', dto, META)).rejects.toThrow(UnauthorizedError);
    });

    it('throws UnauthorizedError for an expired invitation and persists EXPIRED', async () => {
      const invitationRepo = createMockUserInvitationRepository();
      const invitation = createMockInvitation({ expiresAt: new Date(Date.now() - 1000) });
      invitationRepo.findByTokenHash.mockResolvedValue(invitation);

      const service = createService(createMockAuthRepository(), createFakeRequest(), createMockUserRepository(), invitationRepo);

      await expect(service.acceptInvite('expired-token', dto, META)).rejects.toThrow(UnauthorizedError);
      expect(invitationRepo.update).toHaveBeenCalledWith(invitation.id, { status: InvitationStatus.EXPIRED });
    });

    it('throws UnauthorizedError for an already-ACCEPTED invitation (replay attack)', async () => {
      const invitationRepo = createMockUserInvitationRepository();
      invitationRepo.findByTokenHash.mockResolvedValue(createMockInvitation({ status: InvitationStatus.ACCEPTED }));
      const userRepo = createMockUserRepository();

      const service = createService(createMockAuthRepository(), createFakeRequest(), userRepo, invitationRepo);

      await expect(service.acceptInvite('already-used', dto, META)).rejects.toThrow(UnauthorizedError);
      expect(userRepo.create).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedError for a REVOKED invitation', async () => {
      const invitationRepo = createMockUserInvitationRepository();
      invitationRepo.findByTokenHash.mockResolvedValue(createMockInvitation({ status: InvitationStatus.REVOKED }));

      const service = createService(createMockAuthRepository(), createFakeRequest(), createMockUserRepository(), invitationRepo);

      await expect(service.acceptInvite('revoked', dto, META)).rejects.toThrow(UnauthorizedError);
    });

    it('throws ConflictError when a User with this email already exists (belt-and-suspenders)', async () => {
      const invitationRepo = createMockUserInvitationRepository();
      const invitation = createMockInvitation();
      invitationRepo.findByTokenHash.mockResolvedValue(invitation);
      const userRepo = createMockUserRepository();
      userRepo.findByEmail.mockResolvedValue(createMockUser({ email: invitation.email }));

      const service = createService(createMockAuthRepository(), createFakeRequest(), userRepo, invitationRepo);

      await expect(service.acceptInvite('valid-token', dto, META)).rejects.toThrow(ConflictError);
      expect(userRepo.create).not.toHaveBeenCalled();
    });

    it('on success: creates the User ACTIVE, assigns every invited role, and marks the invitation ACCEPTED', async () => {
      const invitationRepo = createMockUserInvitationRepository();
      const invitation = createMockInvitation({ roleIds: [ROLE_ID, 'role-second'] });
      invitationRepo.findByTokenHash.mockResolvedValue(invitation);
      const userRepo = createMockUserRepository();
      userRepo.findByEmail.mockResolvedValue(null);
      const createdUser = createMockUser({ id: 'new-user-id', email: invitation.email });
      userRepo.create.mockResolvedValue(createdUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password');

      const service = createService(createMockAuthRepository(), createFakeRequest(), userRepo, invitationRepo);
      await service.acceptInvite('valid-token', dto, META);

      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: invitation.email,
          firstName: 'Priya',
          lastName: 'Singh',
          passwordHash: 'new-hashed-password',
          status: UserStatus.ACTIVE,
        }),
        { tenantId: invitation.tenantId, tx: expect.anything() },
      );
      expect(invitationRepo.update).toHaveBeenCalledWith(
        invitation.id,
        expect.objectContaining({ status: InvitationStatus.ACCEPTED, acceptedBy: { connect: { id: createdUser.id } } }),
        expect.anything(),
      );
    });

    it('splits a single-word full name into firstName only, with an empty lastName', async () => {
      const invitationRepo = createMockUserInvitationRepository();
      const invitation = createMockInvitation();
      invitationRepo.findByTokenHash.mockResolvedValue(invitation);
      const userRepo = createMockUserRepository();
      userRepo.findByEmail.mockResolvedValue(null);
      userRepo.create.mockResolvedValue(createMockUser());
      (bcrypt.hash as jest.Mock).mockResolvedValue('hash');

      const service = createService(createMockAuthRepository(), createFakeRequest(), userRepo, invitationRepo);
      await service.acceptInvite('valid-token', { fullName: 'Cher', password: 'NewPassword456!' }, META);

      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ firstName: 'Cher', lastName: '' }),
        expect.anything(),
      );
    });
  });
});
