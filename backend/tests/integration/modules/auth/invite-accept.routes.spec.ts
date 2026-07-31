import { randomUUID } from 'crypto';
import request from 'supertest';
import { Application } from 'express';
import { AuditEventType, InvitationStatus, Prisma, RoleType, UserStatus } from '@prisma/client';
import { prisma } from '@config/database';
import { CryptoUtils } from '@shared/utils';
import { createAuthTestApp } from '../../helpers/auth-test-app';
import { seedFixtures, cleanupFixtures, TestFixtures } from '../../helpers/fixtures';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Invitation Acceptance — Integration Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the full real request lifecycle (GET /auth/invite/:token,
 * POST /auth/invite/:token/accept) against a real database. `UserInvitation`
 * rows are seeded directly via Prisma (not through `POST /users/invite`,
 * which is a different, `users:manage`-gated module this suite isn't
 * exercising) — mirrors how `role.routes.spec.ts`/`audit-log.routes.spec.ts`
 * seed fixture rows they don't own the creation endpoint for.
 *
 * Kept to a separate file from password-reset.routes.spec.ts/auth.routes.spec.ts
 * so this suite's own failed (401/404/422) requests — which also count
 * against the shared `authRateLimiter` bucket applied to every route in this
 * file — stay comfortably under `RATE_LIMIT.AUTH_MAX_REQUESTS` (10) without
 * competing with either of those files' own request budgets (each Jest test
 * file gets its own fresh rate-limiter instance).
 * ─────────────────────────────────────────────────────────────────────────────
 */
jest.setTimeout(30000);

describe('Invitation Acceptance API — integration', () => {
  let app: Application;
  let fixtures: TestFixtures;
  let roleId: string;
  let roleName: string;

  beforeAll(async () => {
    app = createAuthTestApp();
    fixtures = await seedFixtures(prisma);

    roleName = `Invite Test Role ${randomUUID().slice(0, 8)}`;
    const role = await prisma.role.create({
      data: { tenantId: fixtures.tenantA.tenantId, name: roleName, type: RoleType.CUSTOM },
    });
    roleId = role.id;
  });

  afterAll(async () => {
    await prisma.userRole.deleteMany({ where: { tenantId: fixtures.tenantA.tenantId } });
    await prisma.role.deleteMany({ where: { id: roleId } });
    await prisma.userInvitation.deleteMany({ where: { tenantId: fixtures.tenantA.tenantId } });
    await cleanupFixtures(prisma, fixtures);
    await prisma.$disconnect();
  });

  /** Creates a real, hashed-token `UserInvitation` row and returns the raw token — the only place it exists in plaintext, exactly like the real invitation email would carry it. */
  async function createInvitation(overrides: Partial<Prisma.UserInvitationUncheckedCreateInput> = {}): Promise<{ id: string; token: string; email: string }> {
    const rawToken = CryptoUtils.generateRandomToken(32);
    const email = `invitee.${randomUUID().slice(0, 8)}@example.test`;

    const invitation = await prisma.userInvitation.create({
      data: {
        tenantId: fixtures.tenantA.tenantId,
        email,
        invitedById: fixtures.tenantA.userId,
        roleIds: [roleId],
        tokenHash: CryptoUtils.sha256(rawToken),
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        ...overrides,
      },
    });

    return { id: invitation.id, token: rawToken, email };
  }

  describe('GET /auth/invite/:token', () => {
    it('returns 404 for a token that does not exist', async () => {
      const res = await request(app).get('/api/v1/auth/invite/not-a-real-token');
      expect(res.status).toBe(404);
    });

    it('returns 404 and persists EXPIRED for a PENDING invitation past its expiresAt', async () => {
      const { id, token } = await createInvitation({ expiresAt: new Date(Date.now() - 1000) });

      const res = await request(app).get(`/api/v1/auth/invite/${token}`);
      expect(res.status).toBe(404);

      const row = await prisma.userInvitation.findUniqueOrThrow({ where: { id } });
      expect(row.status).toBe(InvitationStatus.EXPIRED);
    });

    it('returns 404 for a REVOKED invitation', async () => {
      const { token } = await createInvitation({ status: InvitationStatus.REVOKED, revokedAt: new Date() });

      const res = await request(app).get(`/api/v1/auth/invite/${token}`);
      expect(res.status).toBe(404);
    });

    it('returns 200 with email/tenantName/inviterName/role for a valid PENDING invitation', async () => {
      const { token, email } = await createInvitation();

      const res = await request(app).get(`/api/v1/auth/invite/${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe(email);
      expect(typeof res.body.data.tenantName).toBe('string');
      expect(res.body.data.tenantName.length).toBeGreaterThan(0);
      expect(typeof res.body.data.inviterName).toBe('string');
      expect(res.body.data.role).toBe(roleName);
    });
  });

  describe('POST /auth/invite/:token/accept', () => {
    it('returns 401 for a token that does not exist', async () => {
      const res = await request(app)
        .post('/api/v1/auth/invite/not-a-real-token/accept')
        .send({ fullName: 'New Person', password: 'BrandNewPassword1!' });
      expect(res.status).toBe(401);
    });

    it('returns 422 when the password is too short', async () => {
      const { token } = await createInvitation();
      const res = await request(app).post(`/api/v1/auth/invite/${token}/accept`).send({ fullName: 'New Person', password: 'short' });
      expect(res.status).toBe(422);
    });

    it('rejects replaying an already-accepted invitation a second time', async () => {
      const { token, email } = await createInvitation();

      const first = await request(app)
        .post(`/api/v1/auth/invite/${token}/accept`)
        .send({ fullName: 'First Accept', password: 'BrandNewPassword1!' });
      expect(first.status).toBe(200);

      const replay = await request(app)
        .post(`/api/v1/auth/invite/${token}/accept`)
        .send({ fullName: 'Second Attempt', password: 'AnotherPassword2!' });
      expect(replay.status).toBe(401);

      // Exactly one User was created for this email, not two.
      const users = await prisma.user.findMany({ where: { email, tenantId: fixtures.tenantA.tenantId } });
      expect(users).toHaveLength(1);
    });

    it('returns 409 when a User with this email already exists', async () => {
      const { token, email } = await createInvitation();
      await prisma.user.create({
        data: { tenantId: fixtures.tenantA.tenantId, email, firstName: 'Already', lastName: 'Exists', status: UserStatus.ACTIVE },
      });

      const res = await request(app).post(`/api/v1/auth/invite/${token}/accept`).send({ fullName: 'New Person', password: 'BrandNewPassword1!' });
      expect(res.status).toBe(409);

      await prisma.user.deleteMany({ where: { email, tenantId: fixtures.tenantA.tenantId } });
    });

    it('on success: creates an ACTIVE User, assigns the invited role, marks the invitation ACCEPTED, and the new user can log in', async () => {
      const { id, token, email } = await createInvitation();

      const res = await request(app)
        .post(`/api/v1/auth/invite/${token}/accept`)
        .send({ fullName: 'Priya Singh', password: 'BrandNewPassword1!' });
      expect(res.status).toBe(200);

      const user = await prisma.user.findFirstOrThrow({ where: { email, tenantId: fixtures.tenantA.tenantId } });
      expect(user.status).toBe(UserStatus.ACTIVE);
      expect(user.firstName).toBe('Priya');
      expect(user.lastName).toBe('Singh');

      const assignment = await prisma.userRole.findFirst({ where: { userId: user.id, roleId } });
      expect(assignment).not.toBeNull();

      const invitationRow = await prisma.userInvitation.findUniqueOrThrow({ where: { id } });
      expect(invitationRow.status).toBe(InvitationStatus.ACCEPTED);
      expect(invitationRow.acceptedById).toBe(user.id);

      const loginRes = await request(app).post('/api/v1/auth/login').send({ email, password: 'BrandNewPassword1!' });
      expect(loginRes.status).toBe(200);

      // An INVITATION_ACCEPTED audit log entry was recorded.
      const auditEntry = await prisma.auditLog.findFirst({
        where: { tenantId: fixtures.tenantA.tenantId, actorId: user.id, eventType: AuditEventType.INVITATION_ACCEPTED },
      });
      expect(auditEntry).not.toBeNull();
    });
  });
});
