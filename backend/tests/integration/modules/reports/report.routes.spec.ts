import { randomUUID } from 'crypto';
import request from 'supertest';
import { Application } from 'express';
import {
  TaskStatus,
  PaymentStatus,
  ComplianceCategory,
  ComplianceFilingStatus,
  DocumentCategory,
} from '@prisma/client';
import { prisma } from '@config/database';
import { createReportTestApp } from '../../helpers/report-test-app';
import { signAccessToken } from '../../helpers/jwt';
import { seedFixtures, cleanupFixtures, TestFixtures } from '../../helpers/fixtures';
import { REPORT_PERMISSIONS } from '@modules/reports/constants/report.permissions';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Reports API — Integration Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the full real request lifecycle against a real database:
 *   Request → authMiddleware (JWT) → tenantMiddleware → requirePermission →
 *   validate (Zod) → ReportController → ReportService → ReportsRepository →
 *   Postgres — across six real source entities (Lead, LeadConversion, Task,
 *   Document, Payment, ComplianceFiling), all seeded directly via Prisma
 *   (reports have no create endpoint of their own).
 * ─────────────────────────────────────────────────────────────────────────────
 */
jest.setTimeout(30000);

describe('Reports API — integration', () => {
  let app: Application;
  let fixtures: TestFixtures;

  let leadId: string;
  let convertedLeadId: string;
  let taskId: string;
  let documentId: string;
  let paymentId: string;
  let filingId: string;
  let projectId: string;
  let sourceId: string;
  let stageId: string;

  const allPermissions = Object.values(REPORT_PERMISSIONS);

  beforeAll(async () => {
    app = createReportTestApp();
    fixtures = await seedFixtures(prisma);
    const suffix = randomUUID().slice(0, 8);

    const source = await prisma.leadSource.create({ data: { tenantId: fixtures.tenantA.tenantId, name: `Referral-${suffix}` } });
    sourceId = source.id;
    const stage = await prisma.leadStage.create({ data: { tenantId: fixtures.tenantA.tenantId, name: `Qualified-${suffix}`, order: 1 } });
    stageId = stage.id;

    const lead = await prisma.lead.create({
      data: { tenantId: fixtures.tenantA.tenantId, title: 'Acme Corp Lead', sourceId, stageId },
    });
    leadId = lead.id;
    await prisma.leadAssignment.create({
      data: { tenantId: fixtures.tenantA.tenantId, leadId, userId: fixtures.tenantA.userId },
    });

    const convertedLead = await prisma.lead.create({
      data: { tenantId: fixtures.tenantA.tenantId, title: 'Beta Co Lead', sourceId, stageId },
    });
    convertedLeadId = convertedLead.id;
    await prisma.leadConversion.create({
      data: {
        tenantId: fixtures.tenantA.tenantId,
        leadId: convertedLeadId,
        clientId: fixtures.tenantA.clientId,
        convertedById: fixtures.tenantA.userId,
      },
    });

    const project = await prisma.project.create({
      data: { tenantId: fixtures.tenantA.tenantId, clientId: fixtures.tenantA.clientId, code: `PRJ-${suffix}`, name: 'Test Project' },
    });
    projectId = project.id;

    const task = await prisma.task.create({
      data: {
        tenantId: fixtures.tenantA.tenantId,
        projectId,
        assigneeId: fixtures.tenantA.userId,
        title: 'Prepare GST filing',
        status: TaskStatus.TODO,
        dueDate: new Date('2026-02-15'),
      },
    });
    taskId = task.id;

    const document = await prisma.document.create({
      data: {
        tenantId: fixtures.tenantA.tenantId,
        category: DocumentCategory.OTHER,
        fileName: `test-${suffix}.pdf`,
        storageKey: `key-${suffix}`,
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        uploadedById: fixtures.tenantA.userId,
      },
    });
    documentId = document.id;

    const payment = await prisma.payment.create({
      data: { tenantId: fixtures.tenantA.tenantId, paymentNumber: `PAY-${suffix}`, amount: 5000, status: PaymentStatus.PENDING },
    });
    paymentId = payment.id;

    const filing = await prisma.complianceFiling.create({
      data: {
        tenantId: fixtures.tenantA.tenantId,
        category: ComplianceCategory.GST,
        reference: `GSTR-${suffix}`,
        period: 'Q1 FY26',
        status: ComplianceFilingStatus.DRAFT,
      },
    });
    filingId = filing.id;
  });

  afterAll(async () => {
    const tenantIds = [fixtures.tenantA.tenantId, fixtures.tenantB.tenantId];
    await prisma.leadConversion.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.leadAssignment.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.task.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.project.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.lead.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.leadStage.deleteMany({ where: { id: stageId } });
    await prisma.leadSource.deleteMany({ where: { id: sourceId } });
    await prisma.document.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.payment.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.complianceFiling.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await cleanupFixtures(prisma, fixtures);
    await prisma.$disconnect();
  });

  function tokenForTenantA(permissions: string[] = allPermissions): string {
    return signAccessToken({ userId: fixtures.tenantA.userId, tenantId: fixtures.tenantA.tenantId, permissions });
  }

  function tokenForTenantB(): string {
    return signAccessToken({ userId: fixtures.tenantB.userId, tenantId: fixtures.tenantB.tenantId, permissions: allPermissions });
  }

  // ────────────────────────────────────────────────────────────────────────
  // Authentication / Permission middleware
  // ────────────────────────────────────────────────────────────────────────
  describe('authentication and permission middleware', () => {
    it('returns 401 when no Authorization header is present', async () => {
      const res = await request(app).get('/api/v1/reports/NEW_LEADS');
      expect(res.status).toBe(401);
    });

    it('returns 403 when the caller lacks reports:read', async () => {
      const res = await request(app).get('/api/v1/reports/NEW_LEADS').set('Authorization', `Bearer ${tokenForTenantA([])}`);
      expect(res.status).toBe(403);
    });

    it('returns 403 when the caller lacks reports:export', async () => {
      const res = await request(app)
        .get('/api/v1/reports/NEW_LEADS/export')
        .query({ format: 'CSV' })
        .set('Authorization', `Bearer ${tokenForTenantA([REPORT_PERMISSIONS.READ])}`);
      expect(res.status).toBe(403);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Validation middleware
  // ────────────────────────────────────────────────────────────────────────
  describe('validation middleware', () => {
    it('returns 422 for an unknown report type', async () => {
      const res = await request(app).get('/api/v1/reports/NOT_A_REPORT').set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(422);
    });

    it('returns 422 for an invalid staffId', async () => {
      const res = await request(app)
        .get('/api/v1/reports/NEW_LEADS')
        .query({ staffId: 'not-a-uuid' })
        .set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(422);
    });

    it('returns 422 for export without a format', async () => {
      const res = await request(app).get('/api/v1/reports/NEW_LEADS/export').set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(422);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Report generation — one describe per fully-implemented report type
  // ────────────────────────────────────────────────────────────────────────
  describe('NEW_LEADS', () => {
    it('returns leads with source/stage names, and generatedAt', async () => {
      const res = await request(app).get('/api/v1/reports/NEW_LEADS').set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      expect(res.body.data.type).toBe('NEW_LEADS');
      expect(typeof res.body.data.generatedAt).toBe('string');
      const row = res.body.data.rows.find((r: { id: string }) => r.id === leadId);
      expect(row).toBeDefined();
      expect(row.source).toContain('Referral-');
      expect(row.stage).toContain('Qualified-');
    });

    it('filters by staffId (LeadAssignment)', async () => {
      const res = await request(app)
        .get('/api/v1/reports/NEW_LEADS')
        .query({ staffId: fixtures.tenantA.userId })
        .set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      const ids = res.body.data.rows.map((r: { id: string }) => r.id);
      expect(ids).toContain(leadId);
      // convertedLeadId was never assigned via LeadAssignment
      expect(ids).not.toContain(convertedLeadId);
    });
  });

  describe('CONVERTED_CLIENTS', () => {
    it('returns the lead-to-client conversion', async () => {
      const res = await request(app).get('/api/v1/reports/CONVERTED_CLIENTS').set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      const row = res.body.data.rows.find((r: { leadTitle: string }) => r.leadTitle === 'Beta Co Lead');
      expect(row).toBeDefined();
      expect(row.convertedBy).toEqual(expect.any(String));
    });
  });

  describe('PENDING_TASKS', () => {
    it('returns open tasks with assignee/project names', async () => {
      const res = await request(app).get('/api/v1/reports/PENDING_TASKS').set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      const row = res.body.data.rows.find((r: { id: string }) => r.id === taskId);
      expect(row).toBeDefined();
      expect(row.project).toBe('Test Project');
      expect(row.status).toBe('TODO');
    });

    it('filters by staffId (assigneeId)', async () => {
      const res = await request(app)
        .get('/api/v1/reports/PENDING_TASKS')
        .query({ staffId: randomUUID() })
        .set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      const ids = res.body.data.rows.map((r: { id: string }) => r.id);
      expect(ids).not.toContain(taskId);
    });
  });

  describe('PAYMENTS_PENDING', () => {
    it('returns pending payments', async () => {
      const res = await request(app).get('/api/v1/reports/PAYMENTS_PENDING').set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      const row = res.body.data.rows.find((r: { id: string }) => r.id === paymentId);
      expect(row).toBeDefined();
      expect(row.amount).toBe(5000);
    });
  });

  describe('DOCUMENT_ACTIVITY', () => {
    it('returns document uploads with activityType UPLOAD', async () => {
      const res = await request(app).get('/api/v1/reports/DOCUMENT_ACTIVITY').set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      const row = res.body.data.rows.find((r: { id: string }) => r.id === documentId);
      expect(row).toBeDefined();
      expect(row.activityType).toBe('UPLOAD');
    });
  });

  describe('STAFF_ASSIGNMENT_SUMMARY', () => {
    it('returns one row per assignee with task counts by status', async () => {
      const res = await request(app).get('/api/v1/reports/STAFF_ASSIGNMENT_SUMMARY').set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      const row = res.body.data.rows.find((r: { staffId: string }) => r.staffId === fixtures.tenantA.userId);
      expect(row).toBeDefined();
      expect(row.totalTasks).toBeGreaterThanOrEqual(1);
      expect(row.todo).toBeGreaterThanOrEqual(1);
    });
  });

  describe('MONTHLY_PENDING_WORK', () => {
    it('returns a monthly rollup combining tasks, payments, and compliance filings', async () => {
      const res = await request(app).get('/api/v1/reports/MONTHLY_PENDING_WORK').set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      expect(res.body.data.rows.length).toBeGreaterThanOrEqual(1);
      const totalOutstanding = res.body.data.rows.reduce((sum: number, r: { totalOutstanding: number }) => sum + r.totalOutstanding, 0);
      expect(totalOutstanding).toBeGreaterThanOrEqual(3); // at least the task + payment + filing seeded above
    });
  });

  describe('PENDING_DOCUMENTS (not implemented)', () => {
    it('returns 501 with a precise reason', async () => {
      const res = await request(app).get('/api/v1/reports/PENDING_DOCUMENTS').set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(501);
      expect(res.body.error.code).toBe('NOT_IMPLEMENTED');
      expect(res.body.message.toLowerCase()).toContain('document');
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Export
  // ────────────────────────────────────────────────────────────────────────
  describe('export', () => {
    it('returns a real CSV file for format=CSV', async () => {
      const res = await request(app)
        .get('/api/v1/reports/NEW_LEADS/export')
        .query({ format: 'CSV' })
        .set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('new-leads-report.csv');
      expect(res.text.split('\n')[0]).toBe('id,title,source,stage,createdAt');
      expect(res.text).toContain(leadId);
    });

    it('returns 501 for format=PDF', async () => {
      const res = await request(app)
        .get('/api/v1/reports/NEW_LEADS/export')
        .query({ format: 'PDF' })
        .set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(501);
    });

    it('returns 501 for format=XLSX', async () => {
      const res = await request(app)
        .get('/api/v1/reports/NEW_LEADS/export')
        .query({ format: 'XLSX' })
        .set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(501);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Tenant isolation
  // ────────────────────────────────────────────────────────────────────────
  describe('tenant isolation', () => {
    it("does not include tenant A's lead in tenant B's NEW_LEADS report", async () => {
      const res = await request(app).get('/api/v1/reports/NEW_LEADS').set('Authorization', `Bearer ${tokenForTenantB()}`);
      expect(res.status).toBe(200);
      const ids = res.body.data.rows.map((r: { id: string }) => r.id);
      expect(ids).not.toContain(leadId);
    });

    it("does not include tenant A's task in tenant B's PENDING_TASKS report", async () => {
      const res = await request(app).get('/api/v1/reports/PENDING_TASKS').set('Authorization', `Bearer ${tokenForTenantB()}`);
      expect(res.status).toBe(200);
      const ids = res.body.data.rows.map((r: { id: string }) => r.id);
      expect(ids).not.toContain(taskId);
    });
  });
});
