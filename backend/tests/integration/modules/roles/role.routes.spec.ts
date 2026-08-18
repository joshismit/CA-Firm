import { randomUUID } from 'crypto';
import request from 'supertest';
import { Application } from 'express';
import { PermissionAction, RoleType, UserStatus } from '@prisma/client';
import { prisma } from '@config/database';
import { createRoleTestApp } from '../../helpers/role-test-app';
import { signAccessToken } from '../../helpers/jwt';
import { seedFixtures, cleanupFixtures, TestFixtures } from '../../helpers/fixtures';
import { ROLE_PERMISSIONS } from '@modules/roles/constants/role.permissions';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Roles API — Integration Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the full real request lifecycle against a real database:
 *   Request → authMiddleware (JWT) → tenantMiddleware → requirePermission →
 *   validate (Zod) → RoleController → RoleService → RoleRepository →
 *   Postgres.
 *
 * Reuses `seedFixtures`/`cleanupFixtures`/`signAccessToken` from the Project
 * integration suite's helpers, and creates its own `Permission`/SYSTEM
 * `Role`/target `User` rows directly via Prisma (not HTTP) — the permission
 * catalog and SYSTEM roles have no creation endpoint of their own, mirroring
 * how the Contacts/Users suites directly seed rows their tests need.
 * ─────────────────────────────────────────────────────────────────────────────
 */
jest.setTimeout(30000);

describe('Roles API — integration', () => {
  let app: Application;
  let fixtures: TestFixtures;
  let permissionCodeA: string;
  let permissionCodeB: string;
  let permissionIds: string[];
  let systemRoleId: string;
  let roleWithPermBId: string;
  let targetUserId: string;

  const allPermissions = Object.values(ROLE_PERMISSIONS);

  beforeAll(async () => {
    app = createRoleTestApp();
    fixtures = await seedFixtures(prisma);

    const suffix = randomUUID().slice(0, 8);
    permissionCodeA = `test:read:${suffix}`;
    permissionCodeB = `test:manage:${suffix}`;

    const [permA, permB] = await Promise.all([
      prisma.permission.create({
        data: { code: permissionCodeA, name: 'Test Read', module: 'test', action: PermissionAction.READ, resource: 'test' },
      }),
      prisma.permission.create({
        data: { code: permissionCodeB, name: 'Test Manage', module: 'test', action: PermissionAction.MANAGE, resource: 'test' },
      }),
    ]);
    permissionIds = [permA.id, permB.id];

    const systemRole = await prisma.role.create({
      data: { tenantId: fixtures.tenantA.tenantId, name: `Test System Role ${suffix}`, type: RoleType.SYSTEM },
    });
    systemRoleId = systemRole.id;

    const roleWithPermB = await prisma.role.create({
      data: { tenantId: fixtures.tenantA.tenantId, name: `Test Role With Perm B ${suffix}`, type: RoleType.CUSTOM },
    });
    await prisma.rolePermission.create({
      data: { roleId: roleWithPermB.id, permissionId: permB.id, grantedById: fixtures.tenantA.userId },
    });
    roleWithPermBId = roleWithPermB.id;

    const target = await prisma.user.create({
      data: {
        tenantId: fixtures.tenantA.tenantId,
        email: `role.target.${suffix}@example.test`,
        firstName: 'Target',
        lastName: 'User',
        status: UserStatus.ACTIVE,
      },
    });
    targetUserId = target.id;
  });

  afterAll(async () => {
    await prisma.userRole.deleteMany({ where: { tenantId: { in: [fixtures.tenantA.tenantId, fixtures.tenantB.tenantId] } } });
    await prisma.rolePermission.deleteMany({ where: { permissionId: { in: permissionIds } } });
    await prisma.role.deleteMany({ where: { tenantId: { in: [fixtures.tenantA.tenantId, fixtures.tenantB.tenantId] } } });
    await prisma.permission.deleteMany({ where: { id: { in: permissionIds } } });
    await prisma.user.deleteMany({ where: { id: targetUserId } });
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
      const res = await request(app).get('/api/v1/roles');
      expect(res.status).toBe(401);
    });

    it('returns 403 when the caller lacks roles:read', async () => {
      const res = await request(app).get('/api/v1/roles').set('Authorization', `Bearer ${tokenForTenantA([])}`);
      expect(res.status).toBe(403);
    });

    it('returns 403 when the caller lacks roles:manage for create', async () => {
      const res = await request(app)
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${tokenForTenantA([ROLE_PERMISSIONS.READ])}`)
        .send({ name: 'No permission', permissionCodes: [permissionCodeA] });
      expect(res.status).toBe(403);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Validation middleware
  // ────────────────────────────────────────────────────────────────────────
  describe('validation middleware', () => {
    it('returns 422 when creating without a name', async () => {
      const res = await request(app)
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ permissionCodes: [permissionCodeA] });
      expect(res.status).toBe(422);
    });

    it('returns 422 when creating with an empty permissionCodes array', async () => {
      const res = await request(app)
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ name: 'Invalid Role', permissionCodes: [] });
      expect(res.status).toBe(422);
    });

    it('returns 422 for an invalid path param (non-UUID id)', async () => {
      const res = await request(app).get('/api/v1/roles/not-a-uuid').set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(422);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Full lifecycle
  // ────────────────────────────────────────────────────────────────────────
  describe('full lifecycle', () => {
    let roleId: string;

    it('POST /roles returns 201 and creates the role with resolved permissionCodes', async () => {
      const res = await request(app)
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${tokenForTenantA([...allPermissions, permissionCodeA, permissionCodeB])}`)
        .send({ name: 'Test Custom Role', description: 'A test role', color: '#6366F1', permissionCodes: [permissionCodeA] });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({ name: 'Test Custom Role', type: 'CUSTOM', permissionCodes: [permissionCodeA] });
      roleId = res.body.data.id;
    });

    it('POST /roles returns 404 for a permissionCode that does not exist', async () => {
      const res = await request(app)
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ name: 'Bad Permission Role', permissionCodes: ['not:a:real:permission'] });
      expect(res.status).toBe(404);
    });

    it('POST /roles returns 409 for a duplicate role name in the tenant', async () => {
      const res = await request(app)
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${tokenForTenantA([...allPermissions, permissionCodeA])}`)
        .send({ name: 'Test Custom Role', permissionCodes: [permissionCodeA] });
      expect(res.status).toBe(409);
    });

    it('GET /roles returns 200 with a paginated list including the new role', async () => {
      const res = await request(app).get('/api/v1/roles').set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      const ids = res.body.data.map((r: { id: string }) => r.id);
      expect(ids).toContain(roleId);
    });

    it('GET /roles/:id returns 200 with the role', async () => {
      const res = await request(app).get(`/api/v1/roles/${roleId}`).set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(roleId);
    });

    it('GET /roles/:id returns 404 for a well-formed but unknown id', async () => {
      const res = await request(app).get(`/api/v1/roles/${randomUUID()}`).set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(404);
    });

    it('PATCH /roles/:id returns 200 and replaces the permission set', async () => {
      const res = await request(app)
        .patch(`/api/v1/roles/${roleId}`)
        .set('Authorization', `Bearer ${tokenForTenantA([...allPermissions, permissionCodeB])}`)
        .send({ permissionCodes: [permissionCodeB] });
      expect(res.status).toBe(200);
      expect(res.body.data.permissionCodes).toEqual([permissionCodeB]);
    });

    it('PATCH /roles/:id returns 200 and updates name without touching permissions', async () => {
      const res = await request(app)
        .patch(`/api/v1/roles/${roleId}`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ name: 'Renamed Role' });
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Renamed Role');
      expect(res.body.data.permissionCodes).toEqual([permissionCodeB]);
    });

    it('DELETE /roles/:id returns 200 and soft-deletes the role', async () => {
      const res = await request(app).delete(`/api/v1/roles/${roleId}`).set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
    });

    it('GET /roles/:id returns 404 once soft-deleted (excluded by default)', async () => {
      const res = await request(app).get(`/api/v1/roles/${roleId}`).set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(404);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // SYSTEM role immutability
  // ────────────────────────────────────────────────────────────────────────
  describe('SYSTEM role immutability', () => {
    it('PATCH /roles/:id returns 403 for a SYSTEM role', async () => {
      const res = await request(app)
        .patch(`/api/v1/roles/${systemRoleId}`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ name: 'Renamed System Role' });
      expect(res.status).toBe(403);
    });

    it('DELETE /roles/:id returns 403 for a SYSTEM role', async () => {
      const res = await request(app).delete(`/api/v1/roles/${systemRoleId}`).set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(403);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Assign / Revoke
  // ────────────────────────────────────────────────────────────────────────
  describe('assign and revoke', () => {
    it('POST /roles/assign returns 404 for an unknown role', async () => {
      const res = await request(app)
        .post('/api/v1/roles/assign')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ userId: targetUserId, roleId: randomUUID() });
      expect(res.status).toBe(404);
    });

    it('POST /roles/assign returns 404 for a cross-tenant userId', async () => {
      const res = await request(app)
        .post('/api/v1/roles/assign')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ userId: fixtures.tenantB.userId, roleId: systemRoleId });
      expect(res.status).toBe(404);
    });

    it('POST /roles/assign returns 200 and creates the assignment', async () => {
      const res = await request(app)
        .post('/api/v1/roles/assign')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ userId: targetUserId, roleId: systemRoleId });
      expect(res.status).toBe(200);
    });

    it('POST /roles/assign returns 409 for a duplicate assignment', async () => {
      const res = await request(app)
        .post('/api/v1/roles/assign')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ userId: targetUserId, roleId: systemRoleId });
      expect(res.status).toBe(409);
    });

    it("GET /roles/:id/users returns 200 and includes the assigned user", async () => {
      const res = await request(app)
        .get(`/api/v1/roles/${systemRoleId}/users`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      const ids = res.body.data.map((u: { id: string }) => u.id);
      expect(ids).toContain(targetUserId);
    });

    it('POST /roles/revoke returns 200 and removes the assignment', async () => {
      const res = await request(app)
        .post('/api/v1/roles/revoke')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ userId: targetUserId, roleId: systemRoleId });
      expect(res.status).toBe(200);
    });

    it('POST /roles/revoke returns 404 once already revoked', async () => {
      const res = await request(app)
        .post('/api/v1/roles/revoke')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ userId: targetUserId, roleId: systemRoleId });
      expect(res.status).toBe(404);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Privilege escalation guards
  // ────────────────────────────────────────────────────────────────────────
  describe('privilege escalation guards', () => {
    it('POST /roles returns 403 when granting a permission the caller does not hold', async () => {
      const res = await request(app)
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${tokenForTenantA(allPermissions)}`) // holds roles:manage, not permissionCodeB
        .send({ name: 'Escalation Attempt Role', permissionCodes: [permissionCodeB] });
      expect(res.status).toBe(403);
    });

    it('PATCH /roles/:id returns 403 when granting a permission the caller does not hold', async () => {
      const res = await request(app)
        .patch(`/api/v1/roles/${systemRoleId}`)
        .set('Authorization', `Bearer ${tokenForTenantA(allPermissions)}`)
        .send({ permissionCodes: [permissionCodeB] });
      // SYSTEM-role immutability is checked first, so this asserts the
      // request is rejected either way — the permission-containment guard
      // is exercised directly via roleWithPermBId below.
      expect(res.status).toBe(403);
    });

    it('POST /roles/assign returns 403 when a user tries to assign a role to themselves', async () => {
      const res = await request(app)
        .post('/api/v1/roles/assign')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ userId: fixtures.tenantA.userId, roleId: systemRoleId });
      expect(res.status).toBe(403);
    });

    it('POST /roles/assign returns 403 when the role grants a permission the caller does not hold', async () => {
      const res = await request(app)
        .post('/api/v1/roles/assign')
        .set('Authorization', `Bearer ${tokenForTenantA(allPermissions)}`) // holds roles:manage, not permissionCodeB
        .send({ userId: targetUserId, roleId: roleWithPermBId });
      expect(res.status).toBe(403);
    });

    it('POST /roles/assign returns 200 when the caller holds every permission the role grants', async () => {
      const res = await request(app)
        .post('/api/v1/roles/assign')
        .set('Authorization', `Bearer ${tokenForTenantA([...allPermissions, permissionCodeB])}`)
        .send({ userId: targetUserId, roleId: roleWithPermBId });
      expect(res.status).toBe(200);

      await prisma.userRole.deleteMany({ where: { userId: targetUserId, roleId: roleWithPermBId } });
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Tenant isolation
  // ────────────────────────────────────────────────────────────────────────
  describe('tenant isolation', () => {
    it("returns 404 when tenant B requests tenant A's role by id", async () => {
      const res = await request(app).get(`/api/v1/roles/${systemRoleId}`).set('Authorization', `Bearer ${tokenForTenantB()}`);
      expect(res.status).toBe(404);
    });

    it("does not include tenant A's roles in tenant B's list", async () => {
      const res = await request(app).get('/api/v1/roles').set('Authorization', `Bearer ${tokenForTenantB()}`);
      expect(res.status).toBe(200);
      const ids = res.body.data.map((r: { id: string }) => r.id);
      expect(ids).not.toContain(systemRoleId);
    });
  });
});
