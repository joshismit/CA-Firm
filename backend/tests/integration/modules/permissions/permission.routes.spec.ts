import { randomUUID } from 'crypto';
import request from 'supertest';
import { Application } from 'express';
import { PermissionAction, RoleType } from '@prisma/client';
import { prisma } from '@config/database';
import { createPermissionTestApp } from '../../helpers/permission-test-app';
import { signAccessToken } from '../../helpers/jwt';
import { seedFixtures, cleanupFixtures, TestFixtures } from '../../helpers/fixtures';
import { ROLE_PERMISSIONS } from '@modules/roles';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Permissions API — Integration Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the full real request lifecycle against a real database:
 *   Request → authMiddleware (JWT) → tenantMiddleware → requirePermission →
 *   validate (Zod) → PermissionController → PermissionService (composing
 *   the real RoleService) → PermissionRepository → Postgres.
 *
 * Reuses `seedFixtures`/`cleanupFixtures`/`signAccessToken` from the Project
 * integration suite's helpers, and creates its own `Permission`/`Role` rows
 * directly via Prisma (not HTTP) — the permission catalog has no creation
 * endpoint, mirroring how the Roles suite directly seeds its own test
 * `Permission` rows.
 * ─────────────────────────────────────────────────────────────────────────────
 */
jest.setTimeout(30000);

describe('Permissions API — integration', () => {
  let app: Application;
  let fixtures: TestFixtures;
  let permissionId: string;
  let customRoleId: string;
  let systemRoleId: string;

  const allPermissions = Object.values(ROLE_PERMISSIONS);

  beforeAll(async () => {
    app = createPermissionTestApp();
    fixtures = await seedFixtures(prisma);

    const suffix = randomUUID().slice(0, 8);

    const permission = await prisma.permission.create({
      data: { code: `test:read:${suffix}`, name: 'Test Read', module: 'test', action: PermissionAction.READ, resource: 'test' },
    });
    permissionId = permission.id;

    const customRole = await prisma.role.create({
      data: { tenantId: fixtures.tenantA.tenantId, name: `Test Matrix Role ${suffix}`, type: RoleType.CUSTOM },
    });
    customRoleId = customRole.id;

    const systemRole = await prisma.role.create({
      data: { tenantId: fixtures.tenantA.tenantId, name: `Test System Role ${suffix}`, type: RoleType.SYSTEM },
    });
    systemRoleId = systemRole.id;
  });

  afterAll(async () => {
    await prisma.rolePermission.deleteMany({ where: { permissionId } });
    await prisma.role.deleteMany({ where: { tenantId: { in: [fixtures.tenantA.tenantId, fixtures.tenantB.tenantId] } } });
    await prisma.permission.delete({ where: { id: permissionId } });
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
      const res = await request(app).get('/api/v1/permissions');
      expect(res.status).toBe(401);
    });

    it('returns 403 when the caller lacks roles:read for the catalog', async () => {
      const res = await request(app).get('/api/v1/permissions').set('Authorization', `Bearer ${tokenForTenantA([])}`);
      expect(res.status).toBe(403);
    });

    it('returns 403 when the caller lacks roles:read for groups', async () => {
      const res = await request(app).get('/api/v1/permissions/groups').set('Authorization', `Bearer ${tokenForTenantA([])}`);
      expect(res.status).toBe(403);
    });

    it('returns 403 when the caller lacks roles:manage for the matrix update', async () => {
      const res = await request(app)
        .patch('/api/v1/permissions/matrix')
        .set('Authorization', `Bearer ${tokenForTenantA([ROLE_PERMISSIONS.READ])}`)
        .send({ roleId: customRoleId, permissionId, granted: true });
      expect(res.status).toBe(403);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Validation middleware
  // ────────────────────────────────────────────────────────────────────────
  describe('validation middleware', () => {
    it('returns 422 for an invalid roleId path param on the matrix GET', async () => {
      const res = await request(app).get('/api/v1/permissions/matrix/not-a-uuid').set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(422);
    });

    it('returns 422 when the matrix update body is missing granted', async () => {
      const res = await request(app)
        .patch('/api/v1/permissions/matrix')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ roleId: customRoleId, permissionId });
      expect(res.status).toBe(422);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Catalog reads
  // ────────────────────────────────────────────────────────────────────────
  describe('catalog reads', () => {
    it('GET /permissions returns 200 with the full catalog including the test permission', async () => {
      const res = await request(app).get('/api/v1/permissions').set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      const ids = res.body.data.map((p: { id: string }) => p.id);
      expect(ids).toContain(permissionId);
      const found = res.body.data.find((p: { id: string }) => p.id === permissionId);
      // action is stored uppercase (Prisma enum) but the mapper lowercases it for the frontend's filter vocabulary.
      expect(found.action).toBe('read');
    });

    it('GET /permissions/groups returns 200 with an array', async () => {
      const res = await request(app).get('/api/v1/permissions/groups').set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Matrix
  // ────────────────────────────────────────────────────────────────────────
  describe('permission matrix', () => {
    it('GET /permissions/matrix/:roleId returns 404 for an unknown role', async () => {
      const res = await request(app)
        .get(`/api/v1/permissions/matrix/${randomUUID()}`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(404);
    });

    it('GET /permissions/matrix/:roleId returns the test permission ungranted initially', async () => {
      const res = await request(app)
        .get(`/api/v1/permissions/matrix/${customRoleId}`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      const entry = res.body.data.find((e: { permissionId: string }) => e.permissionId === permissionId);
      expect(entry).toMatchObject({ roleId: customRoleId, permissionId, granted: false });
    });

    it('PATCH /permissions/matrix returns 404 for an unknown permissionId', async () => {
      const res = await request(app)
        .patch('/api/v1/permissions/matrix')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ roleId: customRoleId, permissionId: randomUUID(), granted: true });
      expect(res.status).toBe(404);
    });

    it('PATCH /permissions/matrix returns 403 for a SYSTEM role', async () => {
      const res = await request(app)
        .patch('/api/v1/permissions/matrix')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ roleId: systemRoleId, permissionId, granted: true });
      expect(res.status).toBe(403);
    });

    it('PATCH /permissions/matrix with granted: true returns 200 and grants the permission', async () => {
      const res = await request(app)
        .patch('/api/v1/permissions/matrix')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ roleId: customRoleId, permissionId, granted: true });
      expect(res.status).toBe(200);

      const matrixRes = await request(app)
        .get(`/api/v1/permissions/matrix/${customRoleId}`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`);
      const entry = matrixRes.body.data.find((e: { permissionId: string }) => e.permissionId === permissionId);
      expect(entry.granted).toBe(true);
    });

    it('PATCH /permissions/matrix with granted: true again is idempotent (no duplicate grant)', async () => {
      const res = await request(app)
        .patch('/api/v1/permissions/matrix')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ roleId: customRoleId, permissionId, granted: true });
      expect(res.status).toBe(200);

      const grants = await prisma.rolePermission.findMany({ where: { roleId: customRoleId, permissionId } });
      expect(grants).toHaveLength(1);
    });

    it('PATCH /permissions/matrix with granted: false returns 200 and revokes the permission', async () => {
      const res = await request(app)
        .patch('/api/v1/permissions/matrix')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ roleId: customRoleId, permissionId, granted: false });
      expect(res.status).toBe(200);

      const matrixRes = await request(app)
        .get(`/api/v1/permissions/matrix/${customRoleId}`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`);
      const entry = matrixRes.body.data.find((e: { permissionId: string }) => e.permissionId === permissionId);
      expect(entry.granted).toBe(false);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Tenant isolation
  // ────────────────────────────────────────────────────────────────────────
  describe('tenant isolation', () => {
    it("returns 404 when tenant B requests tenant A's role's matrix", async () => {
      const res = await request(app)
        .get(`/api/v1/permissions/matrix/${customRoleId}`)
        .set('Authorization', `Bearer ${tokenForTenantB()}`);
      expect(res.status).toBe(404);
    });

    it("returns 404 when tenant B tries to update a grant on tenant A's role", async () => {
      const res = await request(app)
        .patch('/api/v1/permissions/matrix')
        .set('Authorization', `Bearer ${tokenForTenantB()}`)
        .send({ roleId: customRoleId, permissionId, granted: true });
      expect(res.status).toBe(404);
    });
  });
});
