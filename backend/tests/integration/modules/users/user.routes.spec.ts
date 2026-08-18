/**
 * Test-only stub — invite/resend enqueue onto the real `emailQueue` (BullMQ),
 * which would otherwise try to talk to a real Redis connection during these
 * integration tests (unrelated to what this suite verifies: HTTP status
 * codes, permission/tenant scoping, and DB state). Mirrors the `@config/queue`
 * stub in `tests/unit/modules/users/user.service.spec.ts`.
 */
jest.mock('@config/queue', () => ({
  emailQueue: { add: jest.fn().mockResolvedValue(undefined) },
}));

import { randomUUID } from 'crypto';
import request from 'supertest';
import { Application } from 'express';
import { RoleType, SessionDeviceType, SessionStatus, UserStatus } from '@prisma/client';
import { prisma } from '@config/database';
import { createUserTestApp } from '../../helpers/user-test-app';
import { signAccessToken } from '../../helpers/jwt';
import { seedFixtures, cleanupFixtures, TestFixtures } from '../../helpers/fixtures';
import { USER_PERMISSIONS } from '@modules/users/constants/user.permissions';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Users API — Integration Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the full real request lifecycle against a real database:
 *   Request → authMiddleware (JWT) → tenantMiddleware → requirePermission →
 *   validate (Zod) → UserController → UserService → UserRepository /
 *   UserInvitationRepository → Postgres
 *
 * Reuses `seedFixtures`/`cleanupFixtures`/`signAccessToken` from the Project
 * integration suite's helpers, and creates its own `Role`/target `User`/
 * `UserSession` rows directly via Prisma (not HTTP) — Roles/Sessions have no
 * creation endpoint of their own yet, mirroring how the Contacts suite
 * directly seeds its own `BusinessType`/`Business` rows for role-assignment
 * tests.
 * ─────────────────────────────────────────────────────────────────────────────
 */
jest.setTimeout(30000);

describe('Users API — integration', () => {
  let app: Application;
  let fixtures: TestFixtures;
  let roleId: string;
  let targetUserId: string;
  let ownerUserId: string;

  const allPermissions = Object.values(USER_PERMISSIONS);

  beforeAll(async () => {
    app = createUserTestApp();
    fixtures = await seedFixtures(prisma);

    const role = await prisma.role.create({
      data: { tenantId: fixtures.tenantA.tenantId, name: `Test Role ${randomUUID().slice(0, 8)}`, type: RoleType.CUSTOM },
    });
    roleId = role.id;

    const target = await prisma.user.create({
      data: {
        tenantId: fixtures.tenantA.tenantId,
        email: `target.${randomUUID().slice(0, 8)}@example.test`,
        firstName: 'Target',
        lastName: 'User',
        status: UserStatus.ACTIVE,
      },
    });
    targetUserId = target.id;

    const owner = await prisma.user.create({
      data: {
        tenantId: fixtures.tenantA.tenantId,
        email: `owner.${randomUUID().slice(0, 8)}@example.test`,
        firstName: 'Owner',
        lastName: 'User',
        status: UserStatus.ACTIVE,
        isOwner: true,
      },
    });
    ownerUserId = owner.id;

    await prisma.userRole.create({
      data: {
        tenantId: fixtures.tenantA.tenantId,
        userId: targetUserId,
        roleId,
        assignedById: fixtures.tenantA.userId,
      },
    });

    await prisma.userSession.create({
      data: {
        tenantId: fixtures.tenantA.tenantId,
        userId: targetUserId,
        tokenHash: randomUUID(),
        deviceType: SessionDeviceType.WEB,
        status: SessionStatus.ACTIVE,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
  });

  afterAll(async () => {
    await prisma.userSession.deleteMany({ where: { tenantId: { in: [fixtures.tenantA.tenantId, fixtures.tenantB.tenantId] } } });
    await prisma.userRole.deleteMany({ where: { tenantId: { in: [fixtures.tenantA.tenantId, fixtures.tenantB.tenantId] } } });
    await prisma.role.deleteMany({ where: { tenantId: { in: [fixtures.tenantA.tenantId, fixtures.tenantB.tenantId] } } });
    await prisma.userInvitation.deleteMany({ where: { tenantId: { in: [fixtures.tenantA.tenantId, fixtures.tenantB.tenantId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [targetUserId, ownerUserId] } } });
    await cleanupFixtures(prisma, fixtures);
    await prisma.$disconnect();
  });

  function tokenForTenantA(permissions: string[] = allPermissions): string {
    return signAccessToken({ userId: fixtures.tenantA.userId, tenantId: fixtures.tenantA.tenantId, permissions });
  }

  function tokenForTenantB(permissions: string[] = allPermissions): string {
    return signAccessToken({ userId: fixtures.tenantB.userId, tenantId: fixtures.tenantB.tenantId, permissions });
  }

  // ────────────────────────────────────────────────────────────────────────
  // Authentication / Permission middleware
  // ────────────────────────────────────────────────────────────────────────
  describe('authentication and permission middleware', () => {
    it('returns 401 when no Authorization header is present', async () => {
      const res = await request(app).get('/api/v1/users');
      expect(res.status).toBe(401);
    });

    it('returns 403 when the caller lacks users:read', async () => {
      const token = tokenForTenantA([]);
      const res = await request(app).get('/api/v1/users').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });

    it('returns 403 when the caller lacks users:manage for invite', async () => {
      const token = tokenForTenantA([USER_PERMISSIONS.READ]);
      const res = await request(app)
        .post('/api/v1/users/invite')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'no.permission@example.test', roleIds: [roleId] });
      expect(res.status).toBe(403);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Validation middleware
  // ────────────────────────────────────────────────────────────────────────
  describe('validation middleware', () => {
    it('returns 422 when inviting without an email', async () => {
      const res = await request(app)
        .post('/api/v1/users/invite')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ roleIds: [roleId] });
      expect(res.status).toBe(422);
    });

    it('returns 422 when inviting with an empty roleIds array', async () => {
      const res = await request(app)
        .post('/api/v1/users/invite')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ email: 'invalid.roles@example.test', roleIds: [] });
      expect(res.status).toBe(422);
    });

    it('returns 422 for an invalid path param (non-UUID id)', async () => {
      const res = await request(app)
        .get('/api/v1/users/not-a-uuid')
        .set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(422);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Invitation lifecycle
  // ────────────────────────────────────────────────────────────────────────
  describe('invitation lifecycle', () => {
    const inviteEmail = `new.hire.${randomUUID().slice(0, 8)}@example.test`;
    let invitationId: string;

    it('POST /users/invite returns 201 and creates a pending invitation', async () => {
      const res = await request(app)
        .post('/api/v1/users/invite')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ email: inviteEmail, firstName: 'New', lastName: 'Hire', roleIds: [roleId] });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({ email: inviteEmail, status: 'PENDING' });
      invitationId = res.body.data.id;
    });

    it('POST /users/invite returns 409 for an email that already has a pending invitation', async () => {
      const res = await request(app)
        .post('/api/v1/users/invite')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ email: inviteEmail, roleIds: [roleId] });
      expect(res.status).toBe(409);
    });

    it('POST /users/invite returns 409 for an email that already belongs to a user', async () => {
      const res = await request(app)
        .post('/api/v1/users/invite')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ email: (await prisma.user.findUniqueOrThrow({ where: { id: targetUserId } })).email, roleIds: [roleId] });
      expect(res.status).toBe(409);
    });

    it('POST /users/invite returns 404 for a roleId that does not exist in this tenant', async () => {
      const res = await request(app)
        .post('/api/v1/users/invite')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ email: `another.${randomUUID().slice(0, 8)}@example.test`, roleIds: [randomUUID()] });
      expect(res.status).toBe(404);
    });

    it('POST /users/invitations/:id/resend returns 200', async () => {
      const res = await request(app)
        .post(`/api/v1/users/invitations/${invitationId}/resend`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
    });

    it('DELETE /users/invitations/:id returns 200 and revokes the invitation', async () => {
      const res = await request(app)
        .delete(`/api/v1/users/invitations/${invitationId}`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);

      const revoked = await prisma.userInvitation.findUniqueOrThrow({ where: { id: invitationId } });
      expect(revoked.status).toBe('REVOKED');
    });

    it('POST /users/invitations/:id/resend returns 409 once revoked', async () => {
      const res = await request(app)
        .post(`/api/v1/users/invitations/${invitationId}/resend`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(409);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Reads
  // ────────────────────────────────────────────────────────────────────────
  describe('reads', () => {
    it('GET /users returns 200 with a paginated list including the target user', async () => {
      const res = await request(app).get('/api/v1/users').set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      const ids = res.body.data.map((u: { id: string }) => u.id);
      expect(ids).toContain(targetUserId);
    });

    it('GET /users/:id returns 200 with the user', async () => {
      const res = await request(app)
        .get(`/api/v1/users/${targetUserId}`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(targetUserId);
    });

    it('GET /users/:id returns 404 for a well-formed but unknown id', async () => {
      const res = await request(app)
        .get(`/api/v1/users/${randomUUID()}`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(404);
    });

    it("GET /users/:id/roles returns 200 with the user's assigned role and resolved permissionCodes", async () => {
      const res = await request(app)
        .get(`/api/v1/users/${targetUserId}/roles`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toMatchObject({ id: roleId });
      expect(Array.isArray(res.body.data[0].permissionCodes)).toBe(true);
    });

    it("GET /users/:id/sessions returns 200 with the user's active sessions, isCurrent always false", async () => {
      const res = await request(app)
        .get(`/api/v1/users/${targetUserId}/sessions`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].isCurrent).toBe(false);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Update / Delete
  // ────────────────────────────────────────────────────────────────────────
  describe('update and delete', () => {
    it('PATCH /users/:id returns 200 and updates the user', async () => {
      const res = await request(app)
        .patch(`/api/v1/users/${targetUserId}`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ jobTitle: 'Senior Associate' });
      expect(res.status).toBe(200);
      expect(res.body.data.jobTitle).toBe('Senior Associate');
    });

    it('PATCH /users/:id with a status change revokes the active session', async () => {
      const res = await request(app)
        .patch(`/api/v1/users/${targetUserId}`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ status: 'SUSPENDED' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('SUSPENDED');

      const sessions = await prisma.userSession.findMany({ where: { userId: targetUserId } });
      expect(sessions.every((s) => s.status === 'REVOKED')).toBe(true);
    });

    it("PATCH /users/:id returns 403 when changing the account owner's status", async () => {
      const res = await request(app)
        .patch(`/api/v1/users/${ownerUserId}`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ status: 'SUSPENDED' });
      expect(res.status).toBe(403);
    });

    it('DELETE /users/:id returns 403 when the caller attempts to remove their own account', async () => {
      const res = await request(app)
        .delete(`/api/v1/users/${fixtures.tenantA.userId}`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(403);
    });

    it('DELETE /users/:id returns 403 for the account owner', async () => {
      const res = await request(app)
        .delete(`/api/v1/users/${ownerUserId}`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(403);
    });

    it('DELETE /users/:id returns 200 and soft-deletes the user', async () => {
      const res = await request(app)
        .delete(`/api/v1/users/${targetUserId}`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
    });

    it('GET /users/:id returns 404 once soft-deleted (excluded by default)', async () => {
      const res = await request(app)
        .get(`/api/v1/users/${targetUserId}`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(404);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Tenant isolation
  // ────────────────────────────────────────────────────────────────────────
  describe('tenant isolation', () => {
    it("returns 404 when tenant B requests tenant A's user by id", async () => {
      const res = await request(app)
        .get(`/api/v1/users/${ownerUserId}`)
        .set('Authorization', `Bearer ${tokenForTenantB()}`);
      expect(res.status).toBe(404);
    });

    it("does not include tenant A's users in tenant B's list", async () => {
      const res = await request(app).get('/api/v1/users').set('Authorization', `Bearer ${tokenForTenantB()}`);
      expect(res.status).toBe(200);
      const ids = res.body.data.map((u: { id: string }) => u.id);
      expect(ids).not.toContain(ownerUserId);
    });
  });
});
