import { randomUUID } from 'crypto';
import request from 'supertest';
import { Application } from 'express';
import { BusinessStatus } from '@prisma/client';
import { prisma } from '@config/database';
import { createBusinessTestApp } from '../../helpers/business-test-app';
import { signAccessToken } from '../../helpers/jwt';
import { seedFixtures, cleanupFixtures, TestFixtures } from '../../helpers/fixtures';
import { BUSINESS_PERMISSIONS } from '@modules/business/constants/business.permissions';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Business API — Integration Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the full real request lifecycle against a real database:
 *   Request → authMiddleware (JWT) → tenantMiddleware → requirePermission →
 *   validate (Zod) → BusinessController → BusinessService → BusinessRepository
 *   → Postgres
 *
 * Reuses `seedFixtures`/`cleanupFixtures`/`signAccessToken` from the Project
 * integration suite's helpers (tenant/user-agnostic) and creates its own
 * `BusinessType` row directly via Prisma (not HTTP) — `BusinessType` is a
 * shared, cross-tenant reference table with no create endpoint of its own,
 * mirroring how the Task suite directly seeds a `Project` row it needs.
 * ─────────────────────────────────────────────────────────────────────────────
 */
jest.setTimeout(30000);

describe('Business API — integration', () => {
  let app: Application;
  let fixtures: TestFixtures;
  let typeId: string;

  const allPermissions = Object.values(BUSINESS_PERMISSIONS);

  beforeAll(async () => {
    app = createBusinessTestApp();
    fixtures = await seedFixtures(prisma);

    const type = await prisma.businessType.create({
      data: { code: `TEST-BIZ-TYPE-${randomUUID().slice(0, 8)}`, name: 'Integration Test Type' },
    });
    typeId = type.id;
  });

  afterAll(async () => {
    await prisma.business.deleteMany({ where: { typeId } });
    await prisma.businessType.delete({ where: { id: typeId } });
    await cleanupFixtures(prisma, fixtures);
    await prisma.$disconnect();
  });

  function tokenForTenantA(permissions: string[] = allPermissions): string {
    return signAccessToken({
      userId: fixtures.tenantA.userId,
      tenantId: fixtures.tenantA.tenantId,
      permissions,
    });
  }

  function tokenForTenantB(permissions: string[] = allPermissions): string {
    return signAccessToken({
      userId: fixtures.tenantB.userId,
      tenantId: fixtures.tenantB.tenantId,
      permissions,
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // Authentication middleware — 401
  // ────────────────────────────────────────────────────────────────────────
  describe('authentication middleware', () => {
    it('returns 401 when no Authorization header is present', async () => {
      const res = await request(app).get('/api/v1/business');
      expect(res.status).toBe(401);
    });

    it('returns 401 for a malformed/invalid token', async () => {
      const res = await request(app)
        .get('/api/v1/business')
        .set('Authorization', 'Bearer not-a-real-token');
      expect(res.status).toBe(401);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Permission middleware — 403
  // ────────────────────────────────────────────────────────────────────────
  describe('permission middleware', () => {
    it('returns 403 when the caller is authenticated but lacks business:create', async () => {
      const token = tokenForTenantA([]); // valid tenant/user, zero permissions
      const res = await request(app)
        .post('/api/v1/business')
        .set('Authorization', `Bearer ${token}`)
        .send({ typeId, name: 'No Permission Co' });

      expect(res.status).toBe(403);
    });

    it('returns 403 when the caller lacks business:delete', async () => {
      const token = tokenForTenantA([BUSINESS_PERMISSIONS.READ]);
      const res = await request(app)
        .delete(`/api/v1/business/${randomUUID()}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Validation middleware
  // ────────────────────────────────────────────────────────────────────────
  describe('validation middleware', () => {
    it('returns 422 when required fields are missing from the body', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .post('/api/v1/business')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Missing typeId' });

      expect(res.status).toBe(422);
    });

    it('returns 422 for an invalid PAN format', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .post('/api/v1/business')
        .set('Authorization', `Bearer ${token}`)
        .send({ typeId, name: 'Bad PAN Co', pan: 'not-a-pan' });

      expect(res.status).toBe(422);
    });

    it('returns 422 for an invalid path param (non-UUID id)', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .get('/api/v1/business/not-a-uuid')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(422);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Full lifecycle — 201, 200, 404
  // ────────────────────────────────────────────────────────────────────────
  describe('full lifecycle', () => {
    let businessId: string;

    it('POST /business returns 201, creates the business in ACTIVE with normalized PAN/GSTIN', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .post('/api/v1/business')
        .set('Authorization', `Bearer ${token}`)
        .send({
          typeId,
          name: 'Lifecycle Business',
          pan: 'abcde1234f',
          gstin: '27abcde1234f1z5',
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        name: 'Lifecycle Business',
        status: BusinessStatus.ACTIVE,
        pan: 'ABCDE1234F',
        gstin: '27ABCDE1234F1Z5',
        financialYearStart: 4,
      });
      businessId = res.body.data.id;
    });

    it('POST /business accepts tradeName/din/tan/phone/email (PRD §8.3)', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .post('/api/v1/business')
        .set('Authorization', `Bearer ${token}`)
        .send({
          typeId,
          name: 'Fields Test Business',
          tradeName: 'Acme Trading Co',
          din: '01234567',
          tan: 'ABCD12345E',
          phone: '+91-9876543210',
          email: 'accounts@acme.example.com',
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        tradeName: 'Acme Trading Co',
        din: '01234567',
        tan: 'ABCD12345E',
        phone: '+91-9876543210',
        email: 'accounts@acme.example.com',
      });
    });

    it('POST /business returns 409 for a typeId that does not exist (foreign key violation)', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .post('/api/v1/business')
        .set('Authorization', `Bearer ${token}`)
        .send({ typeId: randomUUID(), name: 'Orphan Business' });

      expect(res.status).toBe(409);
    });

    it('GET /business/:id returns 200 with the business', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .get(`/api/v1/business/${businessId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(businessId);
    });

    it('GET /business/:id returns 404 for a well-formed but unknown id', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .get(`/api/v1/business/${randomUUID()}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('PATCH /business/:id returns 200 and updates the business', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .patch(`/api/v1/business/${businessId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Lifecycle Business (renamed)', industry: 'Manufacturing' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Lifecycle Business (renamed)');
      expect(res.body.data.industry).toBe('Manufacturing');
    });

    it('PATCH /business/:id returns 404 for a well-formed but unknown id', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .patch(`/api/v1/business/${randomUUID()}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Ghost' });

      expect(res.status).toBe(404);
    });

    it('PATCH /business/:id can clear a nullable field by sending null', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .patch(`/api/v1/business/${businessId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ industry: null });

      expect(res.status).toBe(200);
      expect(res.body.data.industry).toBeNull();
    });

    it('DELETE /business/:id returns 200 and soft-deletes the business', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .delete(`/api/v1/business/${businessId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it('GET /business/:id returns 404 once soft-deleted (excluded by default)', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .get(`/api/v1/business/${businessId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('DELETE /business/:id returns 404 when deleting an already-deleted business', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .delete(`/api/v1/business/${businessId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Storage quota (PRD §7.4)
  // ────────────────────────────────────────────────────────────────────────
  describe('storage quota', () => {
    let quotaBusinessId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/business')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ typeId, name: 'Storage Quota Business' });
      expect(res.status).toBe(201);
      quotaBusinessId = res.body.data.id;
    });

    it('GET /business/:id includes a storageUsage summary (0 used, quota from the 500 MB global default)', async () => {
      const res = await request(app)
        .get(`/api/v1/business/${quotaBusinessId}`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`);

      expect(res.status).toBe(200);
      expect(res.body.data.storageQuotaMb).toBeNull();
      expect(res.body.data.storageUsage).toMatchObject({
        usedBytes: 0,
        quotaBytes: 500 * 1024 * 1024,
        remainingBytes: 500 * 1024 * 1024,
      });
    });

    it('GET /business (list) omits storageUsage — kept cheap, no per-row aggregate', async () => {
      const res = await request(app)
        .get('/api/v1/business')
        .query({ search: 'Storage Quota Business' })
        .set('Authorization', `Bearer ${tokenForTenantA()}`);

      expect(res.status).toBe(200);
      expect(res.body.data[0].storageUsage).toBeUndefined();
    });

    it('PATCH /business/:id sets a storageQuotaMb override, reflected in the next GET and audit-logged', async () => {
      const patchRes = await request(app)
        .patch(`/api/v1/business/${quotaBusinessId}`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ storageQuotaMb: 100 });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.storageQuotaMb).toBe(100);

      const getRes = await request(app)
        .get(`/api/v1/business/${quotaBusinessId}`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(getRes.body.data.storageQuotaMb).toBe(100);
      expect(getRes.body.data.storageUsage.quotaBytes).toBe(100 * 1024 * 1024);

      const auditEntry = await prisma.auditLog.findFirst({
        where: { tenantId: fixtures.tenantA.tenantId, eventType: 'SETTINGS_UPDATE', targetType: 'Business', targetId: quotaBusinessId },
        orderBy: { createdAt: 'desc' },
      });
      expect(auditEntry).not.toBeNull();
    });

    it('PATCH /business/:id rejects a storageQuotaMb below the 1 MB minimum with 422', async () => {
      const res = await request(app)
        .patch(`/api/v1/business/${quotaBusinessId}`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ storageQuotaMb: 0 });

      expect(res.status).toBe(422);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Staff Assignment (PRD §8.5)
  // ────────────────────────────────────────────────────────────────────────
  describe('staff assignment', () => {
    let assignmentBusinessId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/business')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ typeId, name: 'Assignment Test Business' });
      expect(res.status).toBe(201);
      assignmentBusinessId = res.body.data.id;
    });

    it('GET /business/:id/assignments returns 200 with an empty list before any assignment', async () => {
      const res = await request(app)
        .get(`/api/v1/business/${assignmentBusinessId}/assignments`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('POST /business/:id/assignments returns 201, assigns the user with a role, and audit-logs BUSINESS_ASSIGNMENT_CHANGED', async () => {
      const res = await request(app)
        .post(`/api/v1/business/${assignmentBusinessId}/assignments`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ userId: fixtures.tenantA.userId, role: 'Relationship Manager' });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        businessId: assignmentBusinessId,
        userId: fixtures.tenantA.userId,
        role: 'Relationship Manager',
      });

      const auditEntry = await prisma.auditLog.findFirst({
        where: {
          tenantId: fixtures.tenantA.tenantId,
          eventType: 'BUSINESS_ASSIGNMENT_CHANGED',
          targetType: 'Business',
          targetId: assignmentBusinessId,
        },
      });
      expect(auditEntry).not.toBeNull();
    });

    it('GET /business/:id/assignments now includes the assignment', async () => {
      const res = await request(app)
        .get(`/api/v1/business/${assignmentBusinessId}/assignments`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].userId).toBe(fixtures.tenantA.userId);
    });

    it('POST /business/:id/assignments returns 409 when the user is already assigned', async () => {
      const res = await request(app)
        .post(`/api/v1/business/${assignmentBusinessId}/assignments`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ userId: fixtures.tenantA.userId, role: 'Auditor' });

      expect(res.status).toBe(409);
    });

    it('DELETE /business/:id/assignments/:userId returns 200 and removes the assignment', async () => {
      const res = await request(app)
        .delete(`/api/v1/business/${assignmentBusinessId}/assignments/${fixtures.tenantA.userId}`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`);

      expect(res.status).toBe(200);

      const listRes = await request(app)
        .get(`/api/v1/business/${assignmentBusinessId}/assignments`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(listRes.body.data).toEqual([]);
    });

    it('DELETE /business/:id/assignments/:userId returns 404 when the user is not assigned', async () => {
      const res = await request(app)
        .delete(`/api/v1/business/${assignmentBusinessId}/assignments/${fixtures.tenantA.userId}`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`);

      expect(res.status).toBe(404);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Notes (PRD §8.6)
  // ────────────────────────────────────────────────────────────────────────
  describe('notes', () => {
    let notesBusinessId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/business')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ typeId, name: 'Notes Test Business' });
      expect(res.status).toBe(201);
      notesBusinessId = res.body.data.id;
    });

    it('GET /business/:id/notes returns 200 with an empty list before any note', async () => {
      const res = await request(app)
        .get(`/api/v1/business/${notesBusinessId}/notes`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('POST /business/:id/notes returns 201, stamps the author, and audit-logs BUSINESS_NOTE_ADDED', async () => {
      const res = await request(app)
        .post(`/api/v1/business/${notesBusinessId}/notes`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ content: 'Client requested a call back next week.' });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        businessId: notesBusinessId,
        authorId: fixtures.tenantA.userId,
        content: 'Client requested a call back next week.',
        documentId: null,
      });

      const auditEntry = await prisma.auditLog.findFirst({
        where: {
          tenantId: fixtures.tenantA.tenantId,
          eventType: 'BUSINESS_NOTE_ADDED',
          targetType: 'Business',
          targetId: notesBusinessId,
        },
      });
      expect(auditEntry).not.toBeNull();
    });

    it('GET /business/:id/notes now includes the note, newest first', async () => {
      const res = await request(app)
        .get(`/api/v1/business/${notesBusinessId}/notes`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].content).toBe('Client requested a call back next week.');
    });

    it('POST /business/:id/notes returns 422 for empty content', async () => {
      const res = await request(app)
        .post(`/api/v1/business/${notesBusinessId}/notes`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ content: '' });

      expect(res.status).toBe(422);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Timeline (PRD §8.11) — reuses AuditLog, not a second history table
  // ────────────────────────────────────────────────────────────────────────
  describe('timeline', () => {
    let timelineBusinessId: string;

    beforeAll(async () => {
      const createRes = await request(app)
        .post('/api/v1/business')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ typeId, name: 'Timeline Test Business' });
      expect(createRes.status).toBe(201);
      timelineBusinessId = createRes.body.data.id;

      const patchRes = await request(app)
        .patch(`/api/v1/business/${timelineBusinessId}`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ pan: 'ABCDE1234F' });
      expect(patchRes.status).toBe(200);
    });

    it('GET /business/:id/timeline returns 200 including the BUSINESS_PAN_UPDATED entry, paginated', async () => {
      const res = await request(app)
        .get(`/api/v1/business/${timelineBusinessId}/timeline`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`);

      expect(res.status).toBe(200);
      expect(res.body.meta).toMatchObject({ page: 1, limit: 20 });
      const eventTypes = res.body.data.map((entry: { eventType: string }) => entry.eventType);
      expect(eventTypes).toContain('BUSINESS_PAN_UPDATED');
    });

    it('GET /business/:id/timeline returns 404 for a well-formed but unknown id', async () => {
      const res = await request(app)
        .get(`/api/v1/business/${randomUUID()}/timeline`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`);

      expect(res.status).toBe(404);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Search expansion (PRD §8.9) — phone/email/assigned staff
  // ────────────────────────────────────────────────────────────────────────
  describe('search expansion', () => {
    let searchBusinessId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/business')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ typeId, name: 'Search Expansion Co', phone: '+91-9000011111', email: 'search-target@acme.example.com' });
      expect(res.status).toBe(201);
      searchBusinessId = res.body.data.id;

      const assignRes = await request(app)
        .post(`/api/v1/business/${searchBusinessId}/assignments`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ userId: fixtures.tenantA.userId, role: 'Accountant' });
      expect(assignRes.status).toBe(201);
    });

    it('GET /business?search matches by email', async () => {
      const res = await request(app)
        .get('/api/v1/business')
        .query({ search: 'search-target@acme.example.com' })
        .set('Authorization', `Bearer ${tokenForTenantA()}`);

      expect(res.status).toBe(200);
      expect(res.body.data.map((b: { id: string }) => b.id)).toContain(searchBusinessId);
    });

    it('GET /business?search matches by phone', async () => {
      const res = await request(app)
        .get('/api/v1/business')
        .query({ search: '9000011111' })
        .set('Authorization', `Bearer ${tokenForTenantA()}`);

      expect(res.status).toBe(200);
      expect(res.body.data.map((b: { id: string }) => b.id)).toContain(searchBusinessId);
    });

    it('GET /business?assignedStaffUserId restricts to businesses assigned to that user', async () => {
      const res = await request(app)
        .get('/api/v1/business')
        .query({ assignedStaffUserId: fixtures.tenantA.userId })
        .set('Authorization', `Bearer ${tokenForTenantA()}`);

      expect(res.status).toBe(200);
      expect(res.body.data.map((b: { id: string }) => b.id)).toContain(searchBusinessId);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Business Types
  // ────────────────────────────────────────────────────────────────────────
  describe('GET /business/types', () => {
    it('returns 200 with the active business type catalog, including the seeded test type', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .get('/api/v1/business/types')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((t: { id: string }) => t.id);
      expect(ids).toContain(typeId);
    });

    it('returns the same catalog for a different tenant (BusinessType is shared, not tenant-scoped)', async () => {
      const token = tokenForTenantB();
      const res = await request(app)
        .get('/api/v1/business/types')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((t: { id: string }) => t.id);
      expect(ids).toContain(typeId);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Tenant isolation
  // ────────────────────────────────────────────────────────────────────────
  describe('tenant isolation', () => {
    let tenantABusinessId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/business')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ typeId, name: 'Tenant A Only' });
      expect(res.status).toBe(201);
      tenantABusinessId = res.body.data.id;
    });

    it("returns 404 when tenant B requests tenant A's business by id", async () => {
      const res = await request(app)
        .get(`/api/v1/business/${tenantABusinessId}`)
        .set('Authorization', `Bearer ${tokenForTenantB()}`);

      expect(res.status).toBe(404);
    });

    it("does not include tenant A's business in tenant B's list", async () => {
      const res = await request(app)
        .get('/api/v1/business')
        .set('Authorization', `Bearer ${tokenForTenantB()}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((b: { id: string }) => b.id);
      expect(ids).not.toContain(tenantABusinessId);
    });

    it("tenant A can still fetch its own business", async () => {
      const res = await request(app)
        .get(`/api/v1/business/${tenantABusinessId}`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`);

      expect(res.status).toBe(200);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Pagination
  // ────────────────────────────────────────────────────────────────────────
  describe('pagination', () => {
    beforeAll(async () => {
      const token = tokenForTenantA();
      for (let i = 1; i <= 3; i++) {
        // eslint-disable-next-line no-await-in-loop
        const res = await request(app)
          .post('/api/v1/business')
          .set('Authorization', `Bearer ${token}`)
          .send({ typeId, name: `Pagination Business ${i}` });
        expect(res.status).toBe(201);
      }
    });

    it('honors page/limit and reports correct pagination metadata', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .get('/api/v1/business')
        .query({ page: 1, limit: 2, search: 'Pagination Business' })
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta).toMatchObject({ page: 1, limit: 2, total: 3, totalPages: 2, hasNextPage: true });
    });

    it('returns the remaining record on page 2', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .get('/api/v1/business')
        .query({ page: 2, limit: 2, search: 'Pagination Business' })
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta).toMatchObject({ page: 2, hasNextPage: false, hasPrevPage: true });
    });
  });
});
