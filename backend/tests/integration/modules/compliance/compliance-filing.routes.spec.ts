import { randomUUID } from 'crypto';
import request from 'supertest';
import { Application } from 'express';
import { prisma } from '@config/database';
import { createComplianceTestApp } from '../../helpers/compliance-test-app';
import { signAccessToken } from '../../helpers/jwt';
import { seedFixtures, cleanupFixtures, TestFixtures } from '../../helpers/fixtures';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Compliance API — Integration Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the full real request lifecycle against a real database:
 *   Request → authMiddleware (JWT) → tenantMiddleware → validate (Zod) →
 *   ComplianceFilingController → ComplianceFilingService →
 *   ComplianceFilingRepository → Postgres.
 *
 * Deliberately never asserts a 403 anywhere — per this module's explicit,
 * audited product decision, there is no `requirePermission()` call on any
 * route (no compliance permission resource exists on either side of the
 * app). The "no gating" describe block below positively verifies that
 * decision: a caller with an empty `permissions` array still succeeds.
 *
 * Reuses `seedFixtures`/`cleanupFixtures`/`signAccessToken` from the
 * Project integration suite's helpers. Mirrors
 * `tests/integration/modules/contacts/contact.routes.spec.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
jest.setTimeout(30000);

describe('Compliance API — integration', () => {
  let app: Application;
  let fixtures: TestFixtures;

  beforeAll(async () => {
    app = createComplianceTestApp();
    fixtures = await seedFixtures(prisma);
  });

  afterAll(async () => {
    await prisma.complianceFiling.deleteMany({ where: { tenantId: { in: [fixtures.tenantA.tenantId, fixtures.tenantB.tenantId] } } });
    await cleanupFixtures(prisma, fixtures);
    await prisma.$disconnect();
  });

  function tokenForTenantA(permissions: string[] = []): string {
    return signAccessToken({ userId: fixtures.tenantA.userId, tenantId: fixtures.tenantA.tenantId, permissions });
  }

  function tokenForTenantB(permissions: string[] = []): string {
    return signAccessToken({ userId: fixtures.tenantB.userId, tenantId: fixtures.tenantB.tenantId, permissions });
  }

  // ────────────────────────────────────────────────────────────────────────
  // Authentication middleware
  // ────────────────────────────────────────────────────────────────────────
  describe('authentication middleware', () => {
    it('returns 401 when no Authorization header is present', async () => {
      const res = await request(app).get('/api/v1/gst');
      expect(res.status).toBe(401);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // No permission gating (explicit product decision)
  // ────────────────────────────────────────────────────────────────────────
  describe('no permission gating', () => {
    it('succeeds on GET /gst for a token with zero permissions', async () => {
      const res = await request(app).get('/api/v1/gst').set('Authorization', `Bearer ${tokenForTenantA([])}`);
      expect(res.status).toBe(200);
    });

    it('succeeds on POST /gst for a token with zero permissions', async () => {
      const res = await request(app)
        .post('/api/v1/gst')
        .set('Authorization', `Bearer ${tokenForTenantA([])}`)
        .send({ reference: 'No Permission Filing', period: 'Q1 FY26' });
      expect(res.status).toBe(201);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Validation middleware
  // ────────────────────────────────────────────────────────────────────────
  describe('validation middleware', () => {
    it('returns 422 when creating without a reference', async () => {
      const res = await request(app)
        .post('/api/v1/gst')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ period: 'Q1 FY26' });
      expect(res.status).toBe(422);
    });

    it('returns 422 for an invalid path param (non-UUID id)', async () => {
      const res = await request(app).get('/api/v1/gst/not-a-uuid').set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(422);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Full lifecycle
  // ────────────────────────────────────────────────────────────────────────
  describe('full lifecycle', () => {
    let filingId: string;

    it('POST /gst returns 201 and creates the filing as DRAFT', async () => {
      const res = await request(app)
        .post('/api/v1/gst')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ reference: 'GSTR-3B', period: 'Q1 FY26', dueDate: '2026-04-20', notes: 'Initial filing' });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({ reference: 'GSTR-3B', period: 'Q1 FY26', status: 'DRAFT', filedDate: null });
      filingId = res.body.data.id;
    });

    it('GET /gst/:id returns 200 with the filing', async () => {
      const res = await request(app).get(`/api/v1/gst/${filingId}`).set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(filingId);
    });

    it('GET /gst/:id returns 404 for a well-formed but unknown id', async () => {
      const res = await request(app).get(`/api/v1/gst/${randomUUID()}`).set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(404);
    });

    it('PATCH /gst/:id returns 200 and updates the filing', async () => {
      const res = await request(app)
        .patch(`/api/v1/gst/${filingId}`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ notes: 'Updated notes' });
      expect(res.status).toBe(200);
      expect(res.body.data.notes).toBe('Updated notes');
    });

    it('DELETE /gst/:id returns 200 and soft-deletes the filing', async () => {
      const res = await request(app).delete(`/api/v1/gst/${filingId}`).set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
    });

    it('GET /gst/:id returns 404 once soft-deleted (excluded by default)', async () => {
      const res = await request(app).get(`/api/v1/gst/${filingId}`).set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(404);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Cross-category isolation
  // ────────────────────────────────────────────────────────────────────────
  describe('cross-category isolation', () => {
    it('a filing created via /gst is not reachable via /itr/:id (same tenant, same id)', async () => {
      const createRes = await request(app)
        .post('/api/v1/gst')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ reference: 'GST-Only Filing', period: 'Q2 FY26' });
      const gstFilingId = createRes.body.data.id;

      const crossRes = await request(app).get(`/api/v1/itr/${gstFilingId}`).set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(crossRes.status).toBe(404);

      const listRes = await request(app).get('/api/v1/itr').set('Authorization', `Bearer ${tokenForTenantA()}`);
      const ids = listRes.body.data.map((f: { id: string }) => f.id);
      expect(ids).not.toContain(gstFilingId);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Filtering / search / pagination
  // ────────────────────────────────────────────────────────────────────────
  describe('filtering, search, and pagination', () => {
    beforeAll(async () => {
      const token = tokenForTenantA();
      for (let i = 1; i <= 3; i++) {
        // eslint-disable-next-line no-await-in-loop
        const res = await request(app)
          .post('/api/v1/gst')
          .set('Authorization', `Bearer ${token}`)
          .send({ reference: `FilterSearchFiling${i}`, period: 'Q3 FY26' });
        expect(res.status).toBe(201);
      }
    });

    it('honors page/limit and reports correct pagination metadata', async () => {
      const res = await request(app)
        .get('/api/v1/gst')
        .query({ page: 1, limit: 2, search: 'FilterSearchFiling' })
        .set('Authorization', `Bearer ${tokenForTenantA()}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta).toMatchObject({ page: 1, limit: 2, total: 3, totalPages: 2, hasNextPage: true });
    });

    it('filters by status', async () => {
      const res = await request(app)
        .get('/api/v1/gst')
        .query({ status: 'DRAFT', search: 'FilterSearchFiling' })
        .set('Authorization', `Bearer ${tokenForTenantA()}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);
      expect(res.body.data.every((f: { status: string }) => f.status === 'DRAFT')).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Tenant isolation
  // ────────────────────────────────────────────────────────────────────────
  describe('tenant isolation', () => {
    let tenantAFilingId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/gst')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ reference: 'Tenant A Only', period: 'Q4 FY26' });
      tenantAFilingId = res.body.data.id;
    });

    it("returns 404 when tenant B requests tenant A's filing by id", async () => {
      const res = await request(app).get(`/api/v1/gst/${tenantAFilingId}`).set('Authorization', `Bearer ${tokenForTenantB()}`);
      expect(res.status).toBe(404);
    });

    it("does not include tenant A's filing in tenant B's list", async () => {
      const res = await request(app).get('/api/v1/gst').set('Authorization', `Bearer ${tokenForTenantB()}`);
      expect(res.status).toBe(200);
      const ids = res.body.data.map((f: { id: string }) => f.id);
      expect(ids).not.toContain(tenantAFilingId);
    });
  });
});
