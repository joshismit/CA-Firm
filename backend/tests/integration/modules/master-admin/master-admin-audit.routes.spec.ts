import bcrypt from 'bcryptjs';
import request from 'supertest';
import { Application } from 'express';
import { randomUUID } from 'crypto';
import { AuditEventType } from '@prisma/client';
import { prisma } from '@config/database';
import { UserRole } from '@shared/enums';
import { createMasterAdminTestApp } from '../../helpers/master-admin-test-app';
import { createAuditTestApp } from '../../helpers/audit-test-app';
import { signAccessToken } from '../../helpers/jwt';
import { seedFixtures, cleanupFixtures, TestFixtures } from '../../helpers/fixtures';
import { AUDIT_PERMISSIONS } from '@modules/audit/constants/audit.permissions';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Master Admin — System-Level Audit Monitoring API — Integration Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the full real request lifecycle against a real database:
 *   Request → authMiddleware (JWT) → requireRole(MASTER_ADMIN) → validate
 *   (Zod) → MasterAdminAuditController/TenantController →
 *   MasterAdminAuditService/TenantService → AuditLogRepository/TenantRepository
 *   → Postgres.
 *
 * Writes two real `AuditLog` rows directly (one per fixture tenant) — the
 * write path itself is already covered by
 * `tests/integration/modules/audit/audit-log.routes.spec.ts`; this suite's
 * job is proving the NEW cross-tenant read surface and its filters, plus
 * (see the last `describe` block) that the pre-existing tenant-scoped
 * `GET /audit-logs` endpoint is completely unaffected by the repository
 * change this feature relied on.
 * ─────────────────────────────────────────────────────────────────────────────
 */
jest.setTimeout(30000);

describe('Master Admin — Audit Monitoring API — integration', () => {
  let app: Application;
  let fixtures: TestFixtures;
  let adminId: string;
  let adminEmail: string;
  let entryA: string;
  let entryB: string;

  beforeAll(async () => {
    app = createMasterAdminTestApp();
    fixtures = await seedFixtures(prisma);

    adminEmail = `audit.master.admin.${randomUUID().slice(0, 8)}@example.test`;
    const passwordHash = await bcrypt.hash('irrelevant-for-this-suite', 10);
    const admin = await prisma.masterAdmin.create({
      data: { email: adminEmail, passwordHash, firstName: 'Audit', lastName: 'Admin' },
    });
    adminId = admin.id;

    const entryARow = await prisma.auditLog.create({
      data: {
        tenantId: fixtures.tenantA.tenantId,
        eventType: AuditEventType.LOGIN,
        actorId: fixtures.tenantA.userId,
        actorName: 'Tenant A User',
        description: 'Tenant A user logged in',
        ipAddress: '10.0.0.1',
      },
    });
    entryA = entryARow.id;

    const entryBRow = await prisma.auditLog.create({
      data: {
        tenantId: fixtures.tenantB.tenantId,
        eventType: AuditEventType.UPLOAD,
        actorId: fixtures.tenantB.userId,
        actorName: 'Tenant B User',
        targetType: 'Document',
        targetId: randomUUID(),
        description: 'Tenant B user uploaded a document',
        ipAddress: '10.0.0.2',
      },
    });
    entryB = entryBRow.id;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { id: { in: [entryA, entryB] } } });
    await prisma.masterAdmin.delete({ where: { id: adminId } });
    await cleanupFixtures(prisma, fixtures);
    await prisma.$disconnect();
  });

  function masterAdminToken(): string {
    return signAccessToken({ userId: adminId, email: adminEmail, role: UserRole.MASTER_ADMIN, permissions: [] });
  }

  function tenantAUserToken(): string {
    return signAccessToken({
      userId: fixtures.tenantA.userId,
      tenantId: fixtures.tenantA.tenantId,
      role: UserRole.TENANT_ADMIN,
      permissions: [AUDIT_PERMISSIONS.READ],
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // Access control
  // ────────────────────────────────────────────────────────────────────────
  describe('access control', () => {
    it('returns 401 with no Authorization header', async () => {
      const res = await request(app).get('/api/v1/master-admin/audit-logs');
      expect(res.status).toBe(401);
    });

    it('returns 403 for a valid but non-MASTER_ADMIN token (a regular tenant user)', async () => {
      const res = await request(app).get('/api/v1/master-admin/audit-logs').set('Authorization', `Bearer ${tenantAUserToken()}`);
      expect(res.status).toBe(403);
    });

    it('returns 403 for GET /master-admin/tenants/:id/users with a tenant user token', async () => {
      const res = await request(app)
        .get(`/api/v1/master-admin/tenants/${fixtures.tenantA.tenantId}/users`)
        .set('Authorization', `Bearer ${tenantAUserToken()}`);
      expect(res.status).toBe(403);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // GET /master-admin/audit-logs — cross-tenant view + filters
  // ────────────────────────────────────────────────────────────────────────
  describe('GET /master-admin/audit-logs', () => {
    it('returns entries from every tenant, each carrying its tenantId and tenantName', async () => {
      const res = await request(app).get('/api/v1/master-admin/audit-logs').set('Authorization', `Bearer ${masterAdminToken()}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((entry: { id: string }) => entry.id);
      expect(ids).toContain(entryA);
      expect(ids).toContain(entryB);

      const tenantA = await prisma.tenant.findUniqueOrThrow({ where: { id: fixtures.tenantA.tenantId } });
      const tenantB = await prisma.tenant.findUniqueOrThrow({ where: { id: fixtures.tenantB.tenantId } });
      const rowA = res.body.data.find((entry: { id: string }) => entry.id === entryA);
      const rowB = res.body.data.find((entry: { id: string }) => entry.id === entryB);
      expect(rowA).toMatchObject({ tenantId: fixtures.tenantA.tenantId, tenantName: tenantA.name });
      expect(rowB).toMatchObject({ tenantId: fixtures.tenantB.tenantId, tenantName: tenantB.name });
    });

    it('filters by tenantId, excluding every other tenant', async () => {
      const res = await request(app)
        .get('/api/v1/master-admin/audit-logs')
        .query({ tenantId: fixtures.tenantA.tenantId })
        .set('Authorization', `Bearer ${masterAdminToken()}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((entry: { id: string }) => entry.id);
      expect(ids).toContain(entryA);
      expect(ids).not.toContain(entryB);
    });

    it('filters by actorId', async () => {
      const res = await request(app)
        .get('/api/v1/master-admin/audit-logs')
        .query({ actorId: fixtures.tenantB.userId })
        .set('Authorization', `Bearer ${masterAdminToken()}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((entry: { id: string }) => entry.id);
      expect(ids).toContain(entryB);
      expect(ids).not.toContain(entryA);
    });

    it('filters by eventType', async () => {
      const res = await request(app)
        .get('/api/v1/master-admin/audit-logs')
        .query({ eventType: 'UPLOAD', tenantId: fixtures.tenantB.tenantId })
        .set('Authorization', `Bearer ${masterAdminToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.data.every((entry: { eventType: string }) => entry.eventType === 'UPLOAD')).toBe(true);
      expect(res.body.data.map((entry: { id: string }) => entry.id)).toContain(entryB);
    });

    it('filters by search against description', async () => {
      const res = await request(app)
        .get('/api/v1/master-admin/audit-logs')
        .query({ search: 'uploaded a document' })
        .set('Authorization', `Bearer ${masterAdminToken()}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((entry: { id: string }) => entry.id);
      expect(ids).toContain(entryB);
      expect(ids).not.toContain(entryA);
    });

    it('returns 422 for an invalid tenantId (not a UUID)', async () => {
      const res = await request(app)
        .get('/api/v1/master-admin/audit-logs')
        .query({ tenantId: 'not-a-uuid' })
        .set('Authorization', `Bearer ${masterAdminToken()}`);
      expect(res.status).toBe(422);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // GET /master-admin/audit-logs/:id
  // ────────────────────────────────────────────────────────────────────────
  describe('GET /master-admin/audit-logs/:id', () => {
    it('returns the entry (from any tenant) including tenantId/tenantName', async () => {
      const res = await request(app)
        .get(`/api/v1/master-admin/audit-logs/${entryB}`)
        .set('Authorization', `Bearer ${masterAdminToken()}`);

      expect(res.status).toBe(200);
      const tenantB = await prisma.tenant.findUniqueOrThrow({ where: { id: fixtures.tenantB.tenantId } });
      expect(res.body.data).toMatchObject({ id: entryB, tenantId: fixtures.tenantB.tenantId, tenantName: tenantB.name });
    });

    it('returns 404 for a well-formed but unknown id', async () => {
      const res = await request(app)
        .get(`/api/v1/master-admin/audit-logs/${randomUUID()}`)
        .set('Authorization', `Bearer ${masterAdminToken()}`);
      expect(res.status).toBe(404);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // GET /master-admin/tenants/:id/users — audit filter's "User" selector
  // ────────────────────────────────────────────────────────────────────────
  describe('GET /master-admin/tenants/:id/users', () => {
    it('returns only that tenant\'s users', async () => {
      const res = await request(app)
        .get(`/api/v1/master-admin/tenants/${fixtures.tenantA.tenantId}/users`)
        .set('Authorization', `Bearer ${masterAdminToken()}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((user: { id: string }) => user.id);
      expect(ids).toContain(fixtures.tenantA.userId);
      expect(ids).not.toContain(fixtures.tenantB.userId);
    });

    it('returns 404 for a well-formed but unknown tenant id', async () => {
      const res = await request(app)
        .get(`/api/v1/master-admin/tenants/${randomUUID()}/users`)
        .set('Authorization', `Bearer ${masterAdminToken()}`);
      expect(res.status).toBe(404);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Regression: the pre-existing tenant-scoped /audit-logs endpoint must
  // keep behaving exactly as it did before AuditLogRepository.search()
  // gained the optional cross-tenant `tenantId` filter.
  // ────────────────────────────────────────────────────────────────────────
  describe('regression — tenant-scoped GET /audit-logs is unaffected', () => {
    it('still returns only the caller\'s own tenant\'s entries, never another tenant\'s', async () => {
      const tenantApp = createAuditTestApp();
      const res = await request(tenantApp).get('/api/v1/audit-logs').set('Authorization', `Bearer ${tenantAUserToken()}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((entry: { id: string }) => entry.id);
      expect(ids).toContain(entryA);
      expect(ids).not.toContain(entryB);
    });

    it('still 404s fetching another tenant\'s entry by id', async () => {
      const tenantApp = createAuditTestApp();
      const res = await request(tenantApp).get(`/api/v1/audit-logs/${entryB}`).set('Authorization', `Bearer ${tenantAUserToken()}`);
      expect(res.status).toBe(404);
    });
  });
});
