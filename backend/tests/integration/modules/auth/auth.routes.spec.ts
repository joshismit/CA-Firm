import bcrypt from 'bcryptjs';
import request from 'supertest';
import { Application } from 'express';
import { UserStatus } from '@prisma/client';
import { prisma } from '@config/database';
import { createAuthTestApp } from '../../helpers/auth-test-app';
import { seedFixtures, cleanupFixtures, TestFixtures } from '../../helpers/fixtures';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Auth API — Integration Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the full real request lifecycle against a real database and a
 * real bcrypt hash — the one module where the request body's password must
 * actually match what's stored, unlike every other module's fixtures (which
 * never needed a real login). Reuses the shared `seedFixtures` tenant/user
 * rows and layers a real password hash + ACTIVE status onto them, rather than
 * duplicating tenant/user creation.
 * ─────────────────────────────────────────────────────────────────────────────
 */
jest.setTimeout(30000);

const TEST_PASSWORD = 'CorrectHorseBattery9!';

describe('Auth API — integration', () => {
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

  afterAll(async () => {
    await cleanupFixtures(prisma, fixtures);
    await prisma.$disconnect();
  });

  async function getTestUserEmail(): Promise<string> {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: fixtures.tenantA.userId }, select: { email: true } });
    return user.email;
  }

  describe('POST /auth/login', () => {
    it('returns 401 for an unknown email', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({ email: 'nobody@nowhere.test', password: TEST_PASSWORD });
      expect(res.status).toBe(401);
    });

    it('returns 401 for a known email with the wrong password', async () => {
      const email = await getTestUserEmail();
      const res = await request(app).post('/api/v1/auth/login').send({ email, password: 'WrongPassword123!' });
      expect(res.status).toBe(401);
    });

    it('returns 422 when the body fails validation', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({ email: 'not-an-email' });
      expect(res.status).toBe(422);
    });

    it('returns 200 with real access/refresh tokens and the user+tenant on correct credentials', async () => {
      const email = await getTestUserEmail();
      const res = await request(app).post('/api/v1/auth/login').send({ email, password: TEST_PASSWORD });

      expect(res.status).toBe(200);
      expect(typeof res.body.data.accessToken).toBe('string');
      expect(typeof res.body.data.refreshToken).toBe('string');
      expect(res.body.data.user.email).toBe(email);
      expect(res.body.data.tenant.id).toBe(fixtures.tenantA.tenantId);
    });
  });

  describe('authenticated + session lifecycle', () => {
    let accessToken: string;
    let refreshToken: string;
    let sessionId: string;

    beforeAll(async () => {
      const email = await getTestUserEmail();
      const res = await request(app).post('/api/v1/auth/login').send({ email, password: TEST_PASSWORD });
      accessToken = res.body.data.accessToken;
      refreshToken = res.body.data.refreshToken;
    });

    it('GET /auth/me returns 401 with no token', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });

    it('GET /auth/me returns 200 with the caller\'s own profile', async () => {
      const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(fixtures.tenantA.userId);
    });

    it('GET /auth/sessions returns 200 and includes the session just created by login', async () => {
      const res = await request(app).get('/api/v1/auth/sessions').set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      sessionId = res.body.data[0].id;
    });

    it('POST /auth/refresh returns 200 with a new token pair', async () => {
      const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
      expect(res.status).toBe(200);
      expect(typeof res.body.data.accessToken).toBe('string');
      expect(res.body.data.refreshToken).not.toBe(refreshToken);
      refreshToken = res.body.data.refreshToken; // the rotated token, for the reuse test below
    });

    it('POST /auth/refresh with the now-rotated-away old token returns 401 (reuse detection)', async () => {
      const email = await getTestUserEmail();
      // Re-login to get a fresh, still-valid token pair so this test doesn't depend on the
      // rotated-away token from the previous `it` (which is legitimately consumed already).
      const loginRes = await request(app).post('/api/v1/auth/login').send({ email, password: TEST_PASSWORD });
      const firstToken = loginRes.body.data.refreshToken as string;

      const firstRefresh = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: firstToken });
      expect(firstRefresh.status).toBe(200);

      const reuseAttempt = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: firstToken });
      expect(reuseAttempt.status).toBe(401);
    });

    it('DELETE /auth/sessions/:id revokes the session', async () => {
      const res = await request(app).delete(`/api/v1/auth/sessions/${sessionId}`).set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
    });

    it('POST /auth/logout returns 200', async () => {
      const email = await getTestUserEmail();
      const loginRes = await request(app).post('/api/v1/auth/login').send({ email, password: TEST_PASSWORD });

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${loginRes.body.data.accessToken}`)
        .send({ refreshToken: loginRes.body.data.refreshToken });
      expect(res.status).toBe(200);
    });

    it('POST /auth/sessions/revoke-all returns 200', async () => {
      const res = await request(app)
        .post('/api/v1/auth/sessions/revoke-all')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({});
      expect(res.status).toBe(200);
      expect(typeof res.body.data.revokedCount).toBe('number');
    });
  });

  describe('POST /auth/change-password', () => {
    it('returns 401 when the current password is wrong', async () => {
      const email = await getTestUserEmail();
      const loginRes = await request(app).post('/api/v1/auth/login').send({ email, password: TEST_PASSWORD });

      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${loginRes.body.data.accessToken}`)
        .send({ currentPassword: 'WrongOldPassword1!', newPassword: 'BrandNewPassword2!' });

      expect(res.status).toBe(401);
    });

    it('returns 200 on success, and the old password no longer works for a subsequent login', async () => {
      const email = await getTestUserEmail();
      const loginRes = await request(app).post('/api/v1/auth/login').send({ email, password: TEST_PASSWORD });

      const changeRes = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${loginRes.body.data.accessToken}`)
        .send({ currentPassword: TEST_PASSWORD, newPassword: 'BrandNewPassword2!' });
      expect(changeRes.status).toBe(200);

      const oldLoginRes = await request(app).post('/api/v1/auth/login').send({ email, password: TEST_PASSWORD });
      expect(oldLoginRes.status).toBe(401);

      const newLoginRes = await request(app).post('/api/v1/auth/login').send({ email, password: 'BrandNewPassword2!' });
      expect(newLoginRes.status).toBe(200);
    });
  });
});
