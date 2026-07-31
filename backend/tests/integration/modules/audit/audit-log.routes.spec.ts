import request from 'supertest';
import { Application } from 'express';
import { AuditEventType } from '@prisma/client';
import { prisma } from '@config/database';
import { createAuditTestApp } from '../../helpers/audit-test-app';
import { signAccessToken } from '../../helpers/jwt';
import { seedFixtures, cleanupFixtures, TestFixtures } from '../../helpers/fixtures';
import { AUDIT_PERMISSIONS } from '@modules/audit/constants/audit.permissions';
import { ROLE_PERMISSIONS } from '@modules/roles/constants/role.permissions';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Audit Logs API — Integration Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the full real request lifecycle against a real database:
 *   Request → authMiddleware (JWT) → tenantMiddleware → requirePermission →
 *   validate (Zod) → AuditLogController/RoleController → AuditLogService/
 *   RoleService → AuditLogRepository/RoleRepository → Postgres.
 *
 * The write path is exercised through a REAL other module's route
 * (`POST /roles/assign`, `PATCH /roles/:id`), not by calling
 * `AuditLogRecorder` directly — proving the actual cross-module wiring
 * (`RoleService` → `AuditLogRecorder` → `AuditLogRepository` → DB) works,
 * not just the recorder in isolation (already covered by
 * `tests/unit/modules/audit/audit-log.recorder.spec.ts`).
 * ─────────────────────────────────────────────────────────────────────────────
 */
jest.setTimeout(30000);

describe('Audit Logs API — integration', () => {
  let app: Application;
  let fixtures: TestFixtures;
  /** The role created in the write-path test below — cleaned up before `cleanupFixtures` runs, since `roles.tenant_id_fkey` is RESTRICT and would otherwise block deleting the fixture tenants. */
  let createdRoleId: string | undefined;

  beforeAll(async () => {
    app = createAuditTestApp();
    fixtures = await seedFixtures(prisma);
  });

  afterAll(async () => {
    if (createdRoleId) {
      await prisma.userRole.deleteMany({ where: { roleId: createdRoleId } });
      await prisma.rolePermission.deleteMany({ where: { roleId: createdRoleId } });
      await prisma.role.delete({ where: { id: createdRoleId } });
    }
    await prisma.auditLog.deleteMany({
      where: { tenantId: { in: [fixtures.tenantA.tenantId, fixtures.tenantB.tenantId] } },
    });
    await cleanupFixtures(prisma, fixtures);
    await prisma.$disconnect();
  });

  function tokenForTenantA(permissions: string[]): string {
    return signAccessToken({ userId: fixtures.tenantA.userId, tenantId: fixtures.tenantA.tenantId, permissions });
  }

  function tokenForTenantB(permissions: string[]): string {
    return signAccessToken({ userId: fixtures.tenantB.userId, tenantId: fixtures.tenantB.tenantId, permissions });
  }

  describe('access control', () => {
    it('returns 401 with no Authorization header', async () => {
      const res = await request(app).get('/api/v1/audit-logs');
      expect(res.status).toBe(401);
    });

    it('returns 403 when the caller lacks audit_logs:read', async () => {
      const res = await request(app).get('/api/v1/audit-logs').set('Authorization', `Bearer ${tokenForTenantA([])}`);
      expect(res.status).toBe(403);
    });
  });

  describe('write path — a real role assignment records a real AuditLog row', () => {
    it('creates a ROLE_CHANGE entry visible through GET /audit-logs, and a PERMISSION_CHANGE entry on a permission update', async () => {
      const roleManageToken = tokenForTenantA([ROLE_PERMISSIONS.MANAGE, ROLE_PERMISSIONS.READ]);
      const auditReadToken = tokenForTenantA([AUDIT_PERMISSIONS.READ]);

      // A real, already-seeded permission code — guaranteed present regardless of seed order.
      const createRoleRes = await request(app)
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${roleManageToken}`)
        .send({ name: `Audit Test Role ${Date.now()}`, permissionCodes: ['roles:read'] });
      expect(createRoleRes.status).toBe(201);
      const roleId: string = createRoleRes.body.data.id;
      createdRoleId = roleId;

      const assignRes = await request(app)
        .post('/api/v1/roles/assign')
        .set('Authorization', `Bearer ${roleManageToken}`)
        .send({ userId: fixtures.tenantA.userId, roleId });
      expect(assignRes.status).toBe(200);

      const roleChangeList = await request(app)
        .get('/api/v1/audit-logs')
        .query({ eventType: AuditEventType.ROLE_CHANGE, actorId: fixtures.tenantA.userId })
        .set('Authorization', `Bearer ${auditReadToken}`);

      expect(roleChangeList.status).toBe(200);
      const roleChangeEntry = roleChangeList.body.data.find(
        (e: { targetId: string }) => e.targetId === fixtures.tenantA.userId,
      );
      expect(roleChangeEntry).toBeDefined();
      expect(roleChangeEntry).toMatchObject({
        eventType: AuditEventType.ROLE_CHANGE,
        actorId: fixtures.tenantA.userId,
        targetType: 'User',
        targetId: fixtures.tenantA.userId,
      });
      expect(roleChangeEntry.description).toEqual(expect.stringContaining('Assigned role'));

      const updateRes = await request(app)
        .patch(`/api/v1/roles/${roleId}`)
        .set('Authorization', `Bearer ${roleManageToken}`)
        .send({ permissionCodes: ['roles:read', 'audit_logs:read'] });
      expect(updateRes.status).toBe(200);

      const permissionChangeList = await request(app)
        .get('/api/v1/audit-logs')
        .query({ eventType: AuditEventType.PERMISSION_CHANGE, targetType: 'Role' })
        .set('Authorization', `Bearer ${auditReadToken}`);

      expect(permissionChangeList.status).toBe(200);
      const permissionChangeEntry = permissionChangeList.body.data.find(
        (e: { targetId: string }) => e.targetId === roleId,
      );
      expect(permissionChangeEntry).toBeDefined();
      expect(permissionChangeEntry.eventType).toBe(AuditEventType.PERMISSION_CHANGE);

      // GET /audit-logs/:id round-trips the same entry.
      const detailRes = await request(app)
        .get(`/api/v1/audit-logs/${roleChangeEntry.id}`)
        .set('Authorization', `Bearer ${auditReadToken}`);
      expect(detailRes.status).toBe(200);
      expect(detailRes.body.data.id).toBe(roleChangeEntry.id);
    });
  });

  describe('tenant isolation', () => {
    it("tenant B's token never sees tenant A's audit log entries", async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${tokenForTenantB([AUDIT_PERMISSIONS.READ])}`);

      expect(res.status).toBe(200);
      expect(res.body.data.every((e: { actorId: string }) => e.actorId !== fixtures.tenantA.userId)).toBe(true);
    });

    it('returns 404 when fetching tenant A entry with tenant B token', async () => {
      const listRes = await request(app)
        .get('/api/v1/audit-logs')
        .query({ actorId: fixtures.tenantA.userId })
        .set('Authorization', `Bearer ${tokenForTenantA([AUDIT_PERMISSIONS.READ])}`);
      const entryId = listRes.body.data[0].id;

      const res = await request(app)
        .get(`/api/v1/audit-logs/${entryId}`)
        .set('Authorization', `Bearer ${tokenForTenantB([AUDIT_PERMISSIONS.READ])}`);

      expect(res.status).toBe(404);
    });
  });

  describe('validation', () => {
    it('returns 422 for an invalid eventType', async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs')
        .query({ eventType: 'NOT_A_REAL_EVENT' })
        .set('Authorization', `Bearer ${tokenForTenantA([AUDIT_PERMISSIONS.READ])}`);
      expect(res.status).toBe(422);
    });

    it('returns 422 for a non-UUID id', async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs/not-a-uuid')
        .set('Authorization', `Bearer ${tokenForTenantA([AUDIT_PERMISSIONS.READ])}`);
      expect(res.status).toBe(422);
    });
  });
});
