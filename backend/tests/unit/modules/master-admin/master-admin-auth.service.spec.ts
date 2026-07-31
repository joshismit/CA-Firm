/**
 * See the identical comment in tests/unit/modules/business/business.service.spec.ts
 * for why @config/database is stubbed.
 */
jest.mock('@config/database', () => ({ prisma: {} }));

// bcryptjs is mocked for determinism/speed — jsonwebtoken runs for real, using the real JWT
// secrets already loaded from .env by tests/setup.ts. Mirrors auth.service.spec.ts.
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

import { Request } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { MasterAdmin } from '@prisma/client';
import { jwtConfig } from '@config/jwt';
import { UnauthorizedError, ForbiddenError } from '@shared/errors';
import { UserRole } from '@shared/enums';
import { MasterAdminAuthService } from '@modules/master-admin/service/master-admin-auth.service';
import { MasterAdminRepository } from '@modules/master-admin/repository/master-admin.repository';
import type { MasterAdminLoginDto } from '@modules/master-admin/dto/master-admin.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * MasterAdminAuthService — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `MasterAdminRepository` is fully mocked — exercises only the business logic
 * in `MasterAdminAuthService` (not-found/inactive/wrong-password guards, JWT
 * payload shape), never a real database. Mirrors
 * `tests/unit/modules/auth/auth.service.spec.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const ADMIN_ID = 'admin-11111111-1111-1111-1111-111111111111';

type MockedMasterAdminRepository = {
  [K in keyof MasterAdminRepository]: jest.Mock;
};

function createMockRepository(): MockedMasterAdminRepository {
  return {
    findByEmail: jest.fn(),
    recordLogin: jest.fn(),
  } as unknown as MockedMasterAdminRepository;
}

function createFakeRequest(): Request {
  return { correlationId: 'test-correlation-id' } as unknown as Request;
}

function createMockAdmin(overrides: Partial<MasterAdmin> = {}): MasterAdmin {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: ADMIN_ID,
    email: 'admin@cafirm.local',
    passwordHash: 'hashed-password',
    firstName: 'Master',
    lastName: 'Admin',
    isActive: true,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createService(repository: MockedMasterAdminRepository): MasterAdminAuthService {
  return new MasterAdminAuthService(createFakeRequest(), repository as unknown as MasterAdminRepository);
}

describe('MasterAdminAuthService', () => {
  const dto: MasterAdminLoginDto = { email: 'admin@cafirm.local', password: 'correct-password' };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('throws UnauthorizedError when no master admin matches the email', async () => {
    const repo = createMockRepository();
    repo.findByEmail.mockResolvedValue(null);

    const service = createService(repo);

    await expect(service.login(dto)).rejects.toThrow(UnauthorizedError);
    expect(repo.recordLogin).not.toHaveBeenCalled();
  });

  it('throws ForbiddenError when the admin account is inactive', async () => {
    const repo = createMockRepository();
    repo.findByEmail.mockResolvedValue(createMockAdmin({ isActive: false }));

    const service = createService(repo);

    await expect(service.login(dto)).rejects.toThrow(ForbiddenError);
    expect(repo.recordLogin).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedError when the password does not match', async () => {
    const repo = createMockRepository();
    repo.findByEmail.mockResolvedValue(createMockAdmin());
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    const service = createService(repo);

    await expect(service.login(dto)).rejects.toThrow(UnauthorizedError);
    expect(repo.recordLogin).not.toHaveBeenCalled();
  });

  it('returns an access token with role MASTER_ADMIN and no tenantId/permissions on success', async () => {
    const repo = createMockRepository();
    const admin = createMockAdmin();
    repo.findByEmail.mockResolvedValue(admin);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const service = createService(repo);
    const result = await service.login(dto);

    expect(repo.recordLogin).toHaveBeenCalledWith(admin.id);
    expect(result.admin).toEqual({
      id: admin.id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
    });

    const decoded = jwt.verify(result.accessToken, jwtConfig.access.secret) as Record<string, unknown>;
    expect(decoded.sub).toBe(admin.id);
    expect(decoded.role).toBe(UserRole.MASTER_ADMIN);
    expect(decoded.tenantId).toBeUndefined();
    expect(decoded.permissions).toEqual([]);
  });
});
