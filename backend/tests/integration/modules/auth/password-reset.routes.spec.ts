/**
 * Test-only stub — AuthService.forgotPassword() fire-and-forgets onto the
 * real `emailQueue` (BullMQ), which would otherwise try to talk to a real
 * Redis connection during these integration tests (unrelated to what this
 * suite verifies: HTTP status codes, token lifecycle, and DB state). Mirrors
 * the `@config/queue` stub in tests/integration/modules/users/user.routes.spec.ts,
 * and additionally lets these tests capture the raw reset token off the
 * enqueued job payload — the only place it ever appears in plaintext,
 * exactly like a real user would get it from their inbox (the DB only ever
 * stores `tokenHash`, a one-way SHA-256 digest).
 */
jest.mock('@config/queue', () => ({
  emailQueue: { add: jest.fn().mockResolvedValue(undefined) },
}));

import { createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { Application } from 'express';
import { AuditEventType, UserStatus } from '@prisma/client';
import { prisma } from '@config/database';
import { emailQueue } from '@config/queue';
import { createAuthTestApp } from '../../helpers/auth-test-app';
import { seedFixtures, cleanupFixtures, TestFixtures } from '../../helpers/fixtures';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Forgot / Reset Password — Integration Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the full real request lifecycle (POST /auth/forgot-password,
 * POST /auth/reset-password) against a real database.
 *
 * Kept to a separate file (not appended to auth.routes.spec.ts) so this
 * suite's own failed (401/422) requests share `authRateLimiter`'s bucket
 * with as few *other* tests as possible — `express-rate-limit`'s in-memory
 * store is a fresh instance per Jest test file (each file gets its own
 * module registry), but multiple `it()`s in one file DO share the same
 * counter, so failure-producing test count is kept comfortably under
 * `RATE_LIMIT.AUTH_MAX_REQUESTS` (10) throughout this file.
 * ─────────────────────────────────────────────────────────────────────────────
 */
jest.setTimeout(30000);

const TEST_PASSWORD = 'CorrectHorseBattery9!';
const addMock = emailQueue.add as jest.Mock;

describe('Forgot/Reset Password API — integration', () => {
  let app: Application;
  let fixtures: TestFixtures;

  beforeAll(async () => {
    app = createAuthTestApp();
    fixtures = await seedFixtures(prisma);

    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    await prisma.user.update({
      where: { id: fixtures.tenantA.userId },
      data: { passwordHash, status: UserStatus.ACTIVE },
    });
  });

  afterEach(() => {
    addMock.mockClear();
  });

  afterAll(async () => {
    await cleanupFixtures(prisma, fixtures);
    await prisma.$disconnect();
  });

  async function getTestUserEmail(): Promise<string> {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: fixtures.tenantA.userId }, select: { email: true } });
    return user.email;
  }

  /** Triggers a real forgot-password request and captures the raw token off the (mocked) enqueued email job. */
  async function requestResetToken(email: string): Promise<string> {
    addMock.mockClear();
    const res = await request(app).post('/api/v1/auth/forgot-password').send({ email });
    expect(res.status).toBe(200);

    const call = addMock.mock.calls.find(([jobName]) => jobName === 'password-reset');
    const resetUrl = (call?.[1] as { context: { resetUrl: string } }).context.resetUrl;
    return new URL(resetUrl).searchParams.get('token') as string;
  }

  describe('POST /auth/forgot-password', () => {
    it('returns 422 for a malformed email', async () => {
      const res = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'not-an-email' });
      expect(res.status).toBe(422);
    });

    it('returns 200 with the same generic response for an unknown email (no enumeration)', async () => {
      const res = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'nobody@nowhere.test' });
      expect(res.status).toBe(200);
      expect(addMock).not.toHaveBeenCalled();
    });

    it('returns 200 and queues a real reset email for a known, ACTIVE user', async () => {
      const email = await getTestUserEmail();
      const res = await request(app).post('/api/v1/auth/forgot-password').send({ email });

      expect(res.status).toBe(200);
      expect(addMock).toHaveBeenCalledWith('password-reset', expect.objectContaining({ to: email, template: 'password-reset' }));
    });
  });

  describe('POST /auth/reset-password', () => {
    it('returns 401 for a token that does not exist', async () => {
      const res = await request(app).post('/api/v1/auth/reset-password').send({ token: 'not-a-real-token', newPassword: 'AnotherPassword1!' });
      expect(res.status).toBe(401);
    });

    it('returns 422 when the new password is too short', async () => {
      const email = await getTestUserEmail();
      const token = await requestResetToken(email);

      const res = await request(app).post('/api/v1/auth/reset-password').send({ token, newPassword: 'short' });
      expect(res.status).toBe(422);
    });

    it('returns 401 for an expired token', async () => {
      const email = await getTestUserEmail();
      const token = await requestResetToken(email);
      await prisma.passwordResetToken.updateMany({ where: { userId: fixtures.tenantA.userId }, data: { expiresAt: new Date(Date.now() - 1000) } });

      const res = await request(app).post('/api/v1/auth/reset-password').send({ token, newPassword: 'AnotherPassword1!' });
      expect(res.status).toBe(401);
    });

    it('invalidates an earlier token once a newer forgot-password request is made (at most one usable link at a time)', async () => {
      const email = await getTestUserEmail();
      const staleToken = await requestResetToken(email);
      const freshToken = await requestResetToken(email); // supersedes staleToken

      const staleAttempt = await request(app).post('/api/v1/auth/reset-password').send({ token: staleToken, newPassword: 'AnotherPassword1!' });
      expect(staleAttempt.status).toBe(401);

      const freshAttempt = await request(app).post('/api/v1/auth/reset-password').send({ token: freshToken, newPassword: 'FreshPassword2!' });
      expect(freshAttempt.status).toBe(200);

      // Restore a known password for the remaining tests in this file.
      await prisma.user.update({ where: { id: fixtures.tenantA.userId }, data: { passwordHash: await bcrypt.hash(TEST_PASSWORD, 10) } });
    });

    it('rejects replaying an already-used token a second time', async () => {
      const email = await getTestUserEmail();
      const token = await requestResetToken(email);

      const first = await request(app).post('/api/v1/auth/reset-password').send({ token, newPassword: 'ReplayGuard1!' });
      expect(first.status).toBe(200);

      const replay = await request(app).post('/api/v1/auth/reset-password').send({ token, newPassword: 'SomethingElse2!' });
      expect(replay.status).toBe(401);

      await prisma.user.update({ where: { id: fixtures.tenantA.userId }, data: { passwordHash: await bcrypt.hash(TEST_PASSWORD, 10) } });
    });

    it('on success: revokes every existing session/refresh token, and old credentials stop working', async () => {
      const email = await getTestUserEmail();

      // A pre-existing session, established via a real login before the reset.
      const loginRes = await request(app).post('/api/v1/auth/login').send({ email, password: TEST_PASSWORD });
      expect(loginRes.status).toBe(200);
      const oldRefreshToken = loginRes.body.data.refreshToken as string;

      const token = await requestResetToken(email);
      const resetRes = await request(app).post('/api/v1/auth/reset-password').send({ token, newPassword: 'PostResetPassword3!' });
      expect(resetRes.status).toBe(200);

      // The refresh token issued before the reset must no longer work.
      const refreshAttempt = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: oldRefreshToken });
      expect(refreshAttempt.status).toBe(401);

      // The old password no longer authenticates...
      const oldLogin = await request(app).post('/api/v1/auth/login').send({ email, password: TEST_PASSWORD });
      expect(oldLogin.status).toBe(401);

      // ...only the new one does.
      const newLogin = await request(app).post('/api/v1/auth/login').send({ email, password: 'PostResetPassword3!' });
      expect(newLogin.status).toBe(200);

      // A PASSWORD_RESET audit log entry was recorded for this user/tenant.
      const auditEntry = await prisma.auditLog.findFirst({
        where: { tenantId: fixtures.tenantA.tenantId, actorId: fixtures.tenantA.userId, eventType: AuditEventType.PASSWORD_RESET },
        orderBy: { createdAt: 'desc' },
      });
      expect(auditEntry).not.toBeNull();
      expect(auditEntry?.description).toEqual(expect.stringContaining(email));

      // Restore a known password for isolation from any other test file reusing these fixtures.
      await prisma.user.update({ where: { id: fixtures.tenantA.userId }, data: { passwordHash: await bcrypt.hash(TEST_PASSWORD, 10) } });
    });
  });

  describe('tenant isolation', () => {
    it('the persisted PasswordResetToken row is scoped to the requesting user\'s own tenant', async () => {
      const email = await getTestUserEmail();
      const token = await requestResetToken(email);
      const tokenHash = createHash('sha256').update(token).digest('hex');

      const tokenRow = await prisma.passwordResetToken.findUniqueOrThrow({ where: { tokenHash } });
      expect(tokenRow.tenantId).toBe(fixtures.tenantA.tenantId);
      expect(tokenRow.userId).toBe(fixtures.tenantA.userId);
    });
  });
});
