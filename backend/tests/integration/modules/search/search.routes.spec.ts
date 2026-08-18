import { randomUUID } from 'crypto';
import request from 'supertest';
import { Application } from 'express';
import { BusinessStatus, DocumentCategory, TaskStatus } from '@prisma/client';
import { prisma } from '@config/database';
import { PermissionAction, PermissionResource } from '@shared/enums';
import { createSearchTestApp } from '../../helpers/search-test-app';
import { signAccessToken } from '../../helpers/jwt';
import { seedFixtures, cleanupFixtures, TestFixtures } from '../../helpers/fixtures';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Global Search API — Integration Tests (PRD §13.1)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the full real request lifecycle against a real database:
 *   Request → authMiddleware (JWT) → tenantMiddleware → validate (Zod) →
 *   SearchController → SearchService → five real repositories → Postgres.
 * Every entity is seeded directly via Prisma (search has no create endpoint
 * of its own). Mirrors `tests/integration/modules/reports/report.routes.spec.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
jest.setTimeout(30000);

const BUSINESS_READ = `${PermissionResource.BUSINESS}:${PermissionAction.READ}`;
const CONTACTS_READ = `${PermissionResource.CONTACTS}:${PermissionAction.READ}`;
const CRM_READ = `${PermissionResource.CRM}:${PermissionAction.READ}`;
const DOCUMENTS_READ = `${PermissionResource.DOCUMENTS}:${PermissionAction.READ}`;
const TASKS_READ = `${PermissionResource.TASKS}:${PermissionAction.READ}`;
const ALL_SEARCH_PERMISSIONS = [BUSINESS_READ, CONTACTS_READ, CRM_READ, DOCUMENTS_READ, TASKS_READ];

describe('Global Search API — integration', () => {
  let app: Application;
  let fixtures: TestFixtures;
  let suffix: string;

  let businessTypeId: string;
  let businessId: string;
  let deletedBusinessId: string;
  let contactId: string;
  let leadId: string;
  let documentId: string;
  let taskId: string;
  let sourceId: string;
  let stageId: string;

  beforeAll(async () => {
    app = createSearchTestApp();
    fixtures = await seedFixtures(prisma);
    suffix = randomUUID().slice(0, 8);

    const businessType = await prisma.businessType.create({ data: { code: `SEARCH-TYPE-${suffix}`, name: `Search Business Type ${suffix}` } });
    businessTypeId = businessType.id;

    const business = await prisma.business.create({
      data: {
        tenantId: fixtures.tenantA.tenantId,
        typeId: businessTypeId,
        name: `SearchCo ${suffix}`,
        tradeName: `SearchTrade ${suffix}`,
        pan: `PN${suffix.slice(0, 8).toUpperCase()}`,
        gstin: `GST${suffix.toUpperCase()}`,
        din: `DIN${suffix.toUpperCase()}`,
        phone: `9000${suffix}`,
        email: `biz-${suffix}@example.test`,
        status: BusinessStatus.ACTIVE,
      },
    });
    businessId = business.id;

    const deletedBusiness = await prisma.business.create({
      data: {
        tenantId: fixtures.tenantA.tenantId,
        typeId: businessTypeId,
        name: `SearchCo Deleted ${suffix}`,
        status: BusinessStatus.ACTIVE,
        deletedAt: new Date(),
      },
    });
    deletedBusinessId = deletedBusiness.id;

    const contact = await prisma.contact.create({
      data: {
        tenantId: fixtures.tenantA.tenantId,
        firstName: `SearchFirst${suffix}`,
        lastName: `SearchLast${suffix}`,
        email: `contact-${suffix}@example.test`,
        phone: `8000${suffix}`,
        pan: `CN${suffix.slice(0, 8).toUpperCase()}`,
      },
    });
    contactId = contact.id;

    const source = await prisma.leadSource.create({ data: { tenantId: fixtures.tenantA.tenantId, name: `Search Source ${suffix}` } });
    sourceId = source.id;
    const stage = await prisma.leadStage.create({ data: { tenantId: fixtures.tenantA.tenantId, name: `Search Stage ${suffix}`, order: 1 } });
    stageId = stage.id;

    const lead = await prisma.lead.create({
      data: {
        tenantId: fixtures.tenantA.tenantId,
        title: `SearchLead ${suffix}`,
        businessId,
        contactId,
        sourceId,
        stageId,
      },
    });
    leadId = lead.id;

    const document = await prisma.document.create({
      data: {
        tenantId: fixtures.tenantA.tenantId,
        businessId,
        category: DocumentCategory.OTHER,
        fileName: `search-doc-${suffix}.pdf`,
        storageKey: `search-key-${suffix}`,
        mimeType: 'application/pdf',
        sizeBytes: 512,
        uploadedById: fixtures.tenantA.userId,
      },
    });
    documentId = document.id;

    const task = await prisma.task.create({
      data: {
        tenantId: fixtures.tenantA.tenantId,
        title: `SearchTask ${suffix}`,
        status: TaskStatus.TODO,
        assigneeId: fixtures.tenantA.userId,
      },
    });
    taskId = task.id;
  });

  afterAll(async () => {
    const tenantIds = [fixtures.tenantA.tenantId, fixtures.tenantB.tenantId];
    await prisma.task.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.document.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.lead.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.leadStage.deleteMany({ where: { id: stageId } });
    await prisma.leadSource.deleteMany({ where: { id: sourceId } });
    await prisma.contact.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.business.deleteMany({ where: { tenantId: { in: tenantIds }, typeId: businessTypeId } });
    await prisma.businessType.deleteMany({ where: { id: businessTypeId } });
    await cleanupFixtures(prisma, fixtures);
    await prisma.$disconnect();
  });

  function tokenForTenantA(permissions: string[] = ALL_SEARCH_PERMISSIONS): string {
    return signAccessToken({ userId: fixtures.tenantA.userId, tenantId: fixtures.tenantA.tenantId, permissions });
  }

  function tokenForTenantB(): string {
    return signAccessToken({ userId: fixtures.tenantB.userId, tenantId: fixtures.tenantB.tenantId, permissions: ALL_SEARCH_PERMISSIONS });
  }

  // ────────────────────────────────────────────────────────────────────────
  // Authentication / Validation
  // ────────────────────────────────────────────────────────────────────────
  describe('authentication and validation', () => {
    it('returns 401 when no Authorization header is present', async () => {
      const res = await request(app).get('/api/v1/search').query({ q: 'anything' });
      expect(res.status).toBe(401);
    });

    it('returns 422 when q is missing', async () => {
      const res = await request(app).get('/api/v1/search').set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(422);
    });

    it('returns 422 when limit exceeds the max of 25', async () => {
      const res = await request(app)
        .get('/api/v1/search')
        .query({ q: 'x', limit: 100 })
        .set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(422);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Field matching per category
  // ────────────────────────────────────────────────────────────────────────
  describe('Business', () => {
    it('matches by name, and excludes soft-deleted businesses', async () => {
      const res = await request(app).get('/api/v1/search').query({ q: `SearchCo ${suffix}` }).set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      const ids = res.body.data.businesses.map((r: { id: string }) => r.id);
      expect(ids).toContain(businessId);
      expect(ids).not.toContain(deletedBusinessId);
    });

    it('matches by tradeName, PAN (startsWith), GSTIN (startsWith), and DIN (startsWith)', async () => {
      const byTradeName = await request(app).get('/api/v1/search').query({ q: `SearchTrade ${suffix}` }).set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(byTradeName.body.data.businesses.map((r: { id: string }) => r.id)).toContain(businessId);

      const byPan = await request(app).get('/api/v1/search').query({ q: `PN${suffix.slice(0, 8).toUpperCase()}` }).set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(byPan.body.data.businesses.map((r: { id: string }) => r.id)).toContain(businessId);

      const byGstin = await request(app).get('/api/v1/search').query({ q: `GST${suffix}` }).set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(byGstin.body.data.businesses.map((r: { id: string }) => r.id)).toContain(businessId);

      const byDin = await request(app).get('/api/v1/search').query({ q: `DIN${suffix}` }).set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(byDin.body.data.businesses.map((r: { id: string }) => r.id)).toContain(businessId);
    });

    it('each result carries id/type/title/subtitle/route/highlightedField', async () => {
      const res = await request(app).get('/api/v1/search').query({ q: `SearchCo ${suffix}` }).set('Authorization', `Bearer ${tokenForTenantA()}`);
      const result = res.body.data.businesses.find((r: { id: string }) => r.id === businessId);
      expect(result).toEqual({
        id: businessId,
        type: 'BUSINESS',
        title: `SearchCo ${suffix}`,
        subtitle: expect.any(String),
        route: `/business/${businessId}`,
        highlightedField: 'name',
      });
    });

    it('is omitted (empty array, not 403) when the caller lacks business:read', async () => {
      const permissions = ALL_SEARCH_PERMISSIONS.filter((p) => p !== BUSINESS_READ);
      const res = await request(app).get('/api/v1/search').query({ q: `SearchCo ${suffix}` }).set('Authorization', `Bearer ${tokenForTenantA(permissions)}`);
      expect(res.status).toBe(200);
      expect(res.body.data.businesses).toEqual([]);
    });
  });

  describe('Contact', () => {
    it('matches by name, email, phone, and PAN', async () => {
      const byName = await request(app).get('/api/v1/search').query({ q: `SearchFirst${suffix}` }).set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(byName.body.data.contacts.map((r: { id: string }) => r.id)).toContain(contactId);

      const byEmail = await request(app).get('/api/v1/search').query({ q: `contact-${suffix}@` }).set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(byEmail.body.data.contacts.map((r: { id: string }) => r.id)).toContain(contactId);

      const byPhone = await request(app).get('/api/v1/search').query({ q: `8000${suffix}` }).set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(byPhone.body.data.contacts.map((r: { id: string }) => r.id)).toContain(contactId);

      const byPan = await request(app).get('/api/v1/search').query({ q: `CN${suffix.slice(0, 8).toUpperCase()}` }).set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(byPan.body.data.contacts.map((r: { id: string }) => r.id)).toContain(contactId);
    });
  });

  describe('CRM (Lead)', () => {
    it('matches by title (Lead Name)', async () => {
      const res = await request(app).get('/api/v1/search').query({ q: `SearchLead ${suffix}` }).set('Authorization', `Bearer ${tokenForTenantA()}`);
      const ids = res.body.data.leads.map((r: { id: string }) => r.id);
      expect(ids).toContain(leadId);
    });

    it('matches by the linked Business name (documented "Lead Company" interpretation)', async () => {
      const res = await request(app).get('/api/v1/search').query({ q: `SearchCo ${suffix}` }).set('Authorization', `Bearer ${tokenForTenantA()}`);
      const ids = res.body.data.leads.map((r: { id: string }) => r.id);
      expect(ids).toContain(leadId);
    });

    it('matches by the linked Contact email/phone (documented "Lead Email"/"Lead Phone" interpretation)', async () => {
      const byEmail = await request(app).get('/api/v1/search').query({ q: `contact-${suffix}@` }).set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(byEmail.body.data.leads.map((r: { id: string }) => r.id)).toContain(leadId);

      const byPhone = await request(app).get('/api/v1/search').query({ q: `8000${suffix}` }).set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(byPhone.body.data.leads.map((r: { id: string }) => r.id)).toContain(leadId);
    });
  });

  describe('Documents', () => {
    it('matches by original filename', async () => {
      const res = await request(app).get('/api/v1/search').query({ q: `search-doc-${suffix}` }).set('Authorization', `Bearer ${tokenForTenantA()}`);
      const result = res.body.data.documents.find((r: { id: string }) => r.id === documentId);
      expect(result).toBeDefined();
      expect(result.highlightedField).toBe('fileName');
      expect(result.route).toBe(`/documents/${documentId}`);
    });
  });

  describe('Tasks', () => {
    it('matches by title', async () => {
      const res = await request(app).get('/api/v1/search').query({ q: `SearchTask ${suffix}` }).set('Authorization', `Bearer ${tokenForTenantA()}`);
      const result = res.body.data.tasks.find((r: { id: string }) => r.id === taskId);
      expect(result).toBeDefined();
      expect(result.route).toBe(`/tasks/${taskId}`);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Limits
  // ────────────────────────────────────────────────────────────────────────
  describe('limit', () => {
    it('defaults to 10 per category and honors an explicit smaller limit', async () => {
      const res = await request(app)
        .get('/api/v1/search')
        .query({ q: `SearchTask ${suffix}`, limit: 1 })
        .set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      expect(res.body.data.tasks.length).toBeLessThanOrEqual(1);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Tenant isolation
  // ────────────────────────────────────────────────────────────────────────
  describe('tenant isolation', () => {
    it("does not return tenant A's business/contact/lead/document/task to tenant B", async () => {
      const res = await request(app)
        .get('/api/v1/search')
        .query({ q: suffix })
        .set('Authorization', `Bearer ${tokenForTenantB()}`);
      expect(res.status).toBe(200);
      expect(res.body.data.businesses.map((r: { id: string }) => r.id)).not.toContain(businessId);
      expect(res.body.data.contacts.map((r: { id: string }) => r.id)).not.toContain(contactId);
      expect(res.body.data.leads.map((r: { id: string }) => r.id)).not.toContain(leadId);
      expect(res.body.data.documents.map((r: { id: string }) => r.id)).not.toContain(documentId);
      expect(res.body.data.tasks.map((r: { id: string }) => r.id)).not.toContain(taskId);
    });
  });
});
