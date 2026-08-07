import { randomUUID } from 'crypto';
import request from 'supertest';
import { Application } from 'express';
import {
  TaskStatus,
  PaymentStatus,
  ComplianceCategory,
  ComplianceFilingStatus,
  DocumentCategory,
  BusinessStatus,
  InvoiceStatus,
  DocumentRequestStatus,
  AuditEventType,
} from '@prisma/client';
import { prisma } from '@config/database';
import { UserRole } from '@shared/enums';
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
 *   Postgres — across the real source entities (Lead, LeadConversion, Task,
 *   Document, DocumentRequest, Payment, Invoice, ComplianceFiling, AuditLog,
 *   BusinessAssignment), all seeded directly via Prisma (reports have no
 *   create endpoint of their own).
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
  let auditLogId: string;
  let paymentId: string;
  let invoiceId: string;
  let documentRequestId: string;
  let projectId: string;
  let sourceId: string;
  let stageId: string;
  let businessTypeId: string;
  let businessId: string;
  let otherStaffUserId: string;

  const allPermissions = Object.values(REPORT_PERMISSIONS);

  beforeAll(async () => {
    app = createReportTestApp();
    fixtures = await seedFixtures(prisma);
    const suffix = randomUUID().slice(0, 8);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const source = await prisma.leadSource.create({ data: { tenantId: fixtures.tenantA.tenantId, name: `Referral-${suffix}` } });
    sourceId = source.id;
    const stage = await prisma.leadStage.create({ data: { tenantId: fixtures.tenantA.tenantId, name: `Qualified-${suffix}`, order: 1 } });
    stageId = stage.id;

    const lead = await prisma.lead.create({
      data: { tenantId: fixtures.tenantA.tenantId, title: 'Acme Corp Lead', sourceId, stageId },
    });
    leadId = lead.id;
    await prisma.leadAssignment.create({
      data: { tenantId: fixtures.tenantA.tenantId, leadId, userId: fixtures.tenantA.userId, isPrimary: true },
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

    // A dedicated Business (+ Client, so it counts as an "assigned client" for STAFF_ASSIGNMENT_SUMMARY)
    // for the Invoice/DocumentRequest/BusinessAssignment fixtures below — `TestFixtures` doesn't
    // expose the business id its own `createTenantFixture()` creates internally.
    const businessType = await prisma.businessType.create({ data: { code: `TEST-BIZTYPE-${suffix}`, name: `Test Business Type ${suffix}` } });
    businessTypeId = businessType.id;
    const business = await prisma.business.create({
      data: { tenantId: fixtures.tenantA.tenantId, typeId: businessTypeId, name: `Test Reports Business ${suffix}`, status: BusinessStatus.ACTIVE },
    });
    businessId = business.id;
    await prisma.client.create({ data: { tenantId: fixtures.tenantA.tenantId, businessId, status: 'ACTIVE' } });
    await prisma.businessAssignment.create({
      data: { tenantId: fixtures.tenantA.tenantId, businessId, userId: fixtures.tenantA.userId, role: 'ACCOUNTANT' },
    });

    const document = await prisma.document.create({
      data: {
        tenantId: fixtures.tenantA.tenantId,
        businessId,
        category: DocumentCategory.OTHER,
        fileName: `test-${suffix}.pdf`,
        storageKey: `key-${suffix}`,
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        uploadedById: fixtures.tenantA.userId,
      },
    });
    documentId = document.id;

    // PRD §13.2 report #6 — Document Activity is now AuditLog-backed (reused, not Document.createdAt).
    const auditLog = await prisma.auditLog.create({
      data: {
        tenantId: fixtures.tenantA.tenantId,
        eventType: AuditEventType.UPLOAD,
        actorId: fixtures.tenantA.userId,
        actorName: 'Integration Test A',
        targetType: 'Document',
        targetId: documentId,
        description: `Uploaded document "${document.fileName}"`,
      },
    });
    auditLogId = auditLog.id;

    const payment = await prisma.payment.create({
      data: { tenantId: fixtures.tenantA.tenantId, paymentNumber: `PAY-${suffix}`, amount: 5000, status: PaymentStatus.PENDING },
    });
    paymentId = payment.id;

    // Outstanding invoice, overdue via a past dueDate (InvoiceStatus.OVERDUE is never actually set
    // by any write path in this codebase — see dashboard-aggregation.service.ts's own comment).
    const invoice = await prisma.invoice.create({
      data: { tenantId: fixtures.tenantA.tenantId, invoiceNumber: `INV-${suffix}`, businessId, amount: 7500, status: InvoiceStatus.SENT, dueDate: yesterday },
    });
    invoiceId = invoice.id;

    const documentRequest = await prisma.documentRequest.create({
      data: {
        tenantId: fixtures.tenantA.tenantId,
        businessId,
        category: DocumentCategory.PAN,
        status: DocumentRequestStatus.PENDING,
        requestedById: fixtures.tenantA.userId,
        dueDate: yesterday,
      },
    });
    documentRequestId = documentRequest.id;

    await prisma.complianceFiling.create({
      data: {
        tenantId: fixtures.tenantA.tenantId,
        category: ComplianceCategory.GST,
        reference: `GSTR-${suffix}`,
        period: 'Q1 FY26',
        status: ComplianceFilingStatus.DRAFT,
      },
    });

    const otherUser = await prisma.user.create({
      data: { tenantId: fixtures.tenantA.tenantId, email: `other.staff.${suffix}@example.test`, firstName: 'Other', lastName: 'Staff' },
    });
    otherStaffUserId = otherUser.id;
  });

  afterAll(async () => {
    const tenantIds = [fixtures.tenantA.tenantId, fixtures.tenantB.tenantId];
    await prisma.auditLog.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.documentRequest.deleteMany({ where: { businessId } });
    await prisma.invoice.deleteMany({ where: { businessId } });
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
    await prisma.businessAssignment.deleteMany({ where: { businessId } });
    await prisma.client.deleteMany({ where: { businessId } });
    await prisma.business.deleteMany({ where: { id: businessId } });
    await prisma.businessType.deleteMany({ where: { id: businessTypeId } });
    await cleanupFixtures(prisma, fixtures);
    await prisma.$disconnect();
  });

  function tokenForTenantA(permissions: string[] = allPermissions, role: UserRole = UserRole.TENANT_ADMIN, userId: string = fixtures.tenantA.userId): string {
    return signAccessToken({ userId, tenantId: fixtures.tenantA.tenantId, role, permissions });
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

    it('returns 422 for an invalid groupBy value', async () => {
      const res = await request(app)
        .get('/api/v1/reports/NEW_LEADS')
        .query({ groupBy: 'REGION' })
        .set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(422);
    });

    it('returns 422 for export without a format', async () => {
      const res = await request(app).get('/api/v1/reports/NEW_LEADS/export').set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(422);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Report generation — one describe per report type
  // ────────────────────────────────────────────────────────────────────────
  describe('NEW_LEADS', () => {
    it('returns leads with source/stage/owner names, and generatedAt', async () => {
      const res = await request(app).get('/api/v1/reports/NEW_LEADS').set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      expect(res.body.data.type).toBe('NEW_LEADS');
      expect(typeof res.body.data.generatedAt).toBe('string');
      const row = res.body.data.rows.find((r: { id: string }) => r.id === leadId);
      expect(row).toBeDefined();
      expect(row.source).toContain('Referral-');
      expect(row.stage).toContain('Qualified-');
      expect(row.owner).toEqual(expect.any(String));
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

    it('groupBy=SOURCE returns aggregated counts instead of raw rows', async () => {
      const res = await request(app)
        .get('/api/v1/reports/NEW_LEADS')
        .query({ groupBy: 'SOURCE' })
        .set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      const row = res.body.data.rows.find((r: { groupKey: string }) => r.groupKey === sourceId);
      expect(row).toBeDefined();
      expect(row.count).toBeGreaterThanOrEqual(2); // leadId + convertedLeadId share this source
      expect(row.id).toBeUndefined();
    });

    it('groupBy=OWNER returns aggregated counts', async () => {
      const res = await request(app)
        .get('/api/v1/reports/NEW_LEADS')
        .query({ groupBy: 'OWNER' })
        .set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      const row = res.body.data.rows.find((r: { groupKey: string }) => r.groupKey === fixtures.tenantA.userId);
      expect(row).toBeDefined();
      expect(row.count).toBeGreaterThanOrEqual(1);
    });
  });

  describe('CONVERTED_CLIENTS', () => {
    it('returns the lead-to-client conversion, with a conversion-ratio meta', async () => {
      const res = await request(app).get('/api/v1/reports/CONVERTED_CLIENTS').set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      const row = res.body.data.rows.find((r: { leadTitle: string }) => r.leadTitle === 'Beta Co Lead');
      expect(row).toBeDefined();
      expect(row.convertedBy).toEqual(expect.any(String));

      expect(res.body.data.meta).toBeDefined();
      expect(res.body.data.meta.totalLeads).toBeGreaterThanOrEqual(2);
      expect(res.body.data.meta.convertedLeads).toBeGreaterThanOrEqual(1);
      expect(typeof res.body.data.meta.conversionRatio).toBe('number');
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

    it('groupBy=STATUS returns aggregated counts', async () => {
      const res = await request(app)
        .get('/api/v1/reports/PENDING_TASKS')
        .query({ groupBy: 'STATUS' })
        .set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      const row = res.body.data.rows.find((r: { groupKey: string }) => r.groupKey === 'TODO');
      expect(row).toBeDefined();
      expect(row.count).toBeGreaterThanOrEqual(1);
    });
  });

  describe('PENDING_DOCUMENTS', () => {
    it('returns pending document requests with overdue tracking and business/staff names', async () => {
      const res = await request(app).get('/api/v1/reports/PENDING_DOCUMENTS').set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      const row = res.body.data.rows.find((r: { id: string }) => r.id === documentRequestId);
      expect(row).toBeDefined();
      expect(row.isOverdue).toBe(true);
      expect(row.businessName).toContain('Test Reports Business');
      expect(row.requestedBy).toEqual(expect.any(String));
    });

    it('groupBy=BUSINESS returns aggregated counts', async () => {
      const res = await request(app)
        .get('/api/v1/reports/PENDING_DOCUMENTS')
        .query({ groupBy: 'BUSINESS' })
        .set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      const row = res.body.data.rows.find((r: { groupKey: string }) => r.groupKey === businessId);
      expect(row).toBeDefined();
      expect(row.count).toBeGreaterThanOrEqual(1);
    });

    it("does not include tenant A's document request in tenant B's report", async () => {
      const res = await request(app).get('/api/v1/reports/PENDING_DOCUMENTS').set('Authorization', `Bearer ${tokenForTenantB()}`);
      expect(res.status).toBe(200);
      const ids = res.body.data.rows.map((r: { id: string }) => r.id);
      expect(ids).not.toContain(documentRequestId);
    });
  });

  describe('PAYMENTS_PENDING', () => {
    it('returns pending payments and outstanding invoices (with overdue tracking)', async () => {
      const res = await request(app).get('/api/v1/reports/PAYMENTS_PENDING').set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);

      const paymentRow = res.body.data.rows.find((r: { id: string }) => r.id === paymentId);
      expect(paymentRow).toBeDefined();
      expect(paymentRow.recordType).toBe('PAYMENT');
      expect(paymentRow.amount).toBe(5000);

      const invoiceRow = res.body.data.rows.find((r: { id: string }) => r.id === invoiceId);
      expect(invoiceRow).toBeDefined();
      expect(invoiceRow.recordType).toBe('INVOICE');
      expect(invoiceRow.amount).toBe(7500);
      expect(invoiceRow.isOverdue).toBe(true);
    });

    it('groupBy=BUSINESS sums outstanding invoice amounts per business', async () => {
      const res = await request(app)
        .get('/api/v1/reports/PAYMENTS_PENDING')
        .query({ groupBy: 'BUSINESS' })
        .set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      const row = res.body.data.rows.find((r: { groupKey: string }) => r.groupKey === businessId);
      expect(row).toBeDefined();
      expect(row.amount).toBeGreaterThanOrEqual(7500);
    });

    it('groupBy=STAFF approximates via assigned-staff-of-the-invoiced-business', async () => {
      const res = await request(app)
        .get('/api/v1/reports/PAYMENTS_PENDING')
        .query({ groupBy: 'STAFF' })
        .set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      const row = res.body.data.rows.find((r: { groupKey: string }) => r.groupKey === fixtures.tenantA.userId);
      expect(row).toBeDefined();
      expect(row.amount).toBeGreaterThanOrEqual(7500);
    });
  });

  describe('DOCUMENT_ACTIVITY', () => {
    it('returns audit-log-backed activity (uploads/downloads/versions/shares), not just Document.createdAt', async () => {
      const res = await request(app).get('/api/v1/reports/DOCUMENT_ACTIVITY').set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      const row = res.body.data.rows.find((r: { id: string }) => r.id === auditLogId);
      expect(row).toBeDefined();
      expect(row.activityType).toBe('UPLOAD');
      expect(row.fileName).toContain('test-');
      expect(row.businessName).toContain('Test Reports Business');
    });

    it('groupBy=BUSINESS returns aggregated counts', async () => {
      const res = await request(app)
        .get('/api/v1/reports/DOCUMENT_ACTIVITY')
        .query({ groupBy: 'BUSINESS' })
        .set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      const row = res.body.data.rows.find((r: { groupKey: string }) => r.groupKey === businessId);
      expect(row).toBeDefined();
    });
  });

  describe('STAFF_ASSIGNMENT_SUMMARY', () => {
    it('returns one row per assignee with task counts, assigned clients/leads, and pending/completed totals', async () => {
      const res = await request(app).get('/api/v1/reports/STAFF_ASSIGNMENT_SUMMARY').set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      const row = res.body.data.rows.find((r: { staffId: string }) => r.staffId === fixtures.tenantA.userId);
      expect(row).toBeDefined();
      expect(row.totalTasks).toBeGreaterThanOrEqual(1);
      expect(row.todo).toBeGreaterThanOrEqual(1);
      expect(row.pendingWork).toBeGreaterThanOrEqual(1);
      expect(row.assignedClients).toBeGreaterThanOrEqual(1);
      expect(row.assignedLeads).toBeGreaterThanOrEqual(1);
    });
  });

  describe('MONTHLY_PENDING_WORK', () => {
    it('returns a monthly rollup combining tasks, invoices, filings, and document requests', async () => {
      const res = await request(app).get('/api/v1/reports/MONTHLY_PENDING_WORK').set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      expect(res.body.data.rows.length).toBeGreaterThanOrEqual(1);
      const totals = res.body.data.rows.reduce(
        (sum: number, r: { totalOutstanding: number }) => sum + r.totalOutstanding,
        0,
      );
      // at least the task + invoice + filing + document request seeded above
      expect(totals).toBeGreaterThanOrEqual(4);
      expect(res.body.data.rows[0]).toHaveProperty('pendingInvoices');
      expect(res.body.data.rows[0]).toHaveProperty('pendingFilings');
      expect(res.body.data.rows[0]).toHaveProperty('pendingDocumentRequests');
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
      expect(res.text.split('\n')[0]).toBe('id,title,source,stage,owner,createdAt');
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

    it('exports PENDING_DOCUMENTS as a real CSV file now that it is implemented', async () => {
      const res = await request(app)
        .get('/api/v1/reports/PENDING_DOCUMENTS/export')
        .query({ format: 'CSV' })
        .set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      expect(res.text).toContain(documentRequestId);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Permission scoping (PRD §13.2 — Staff: only own; Manager/Tenant Admin/
  // Master Admin: entire firm)
  // ────────────────────────────────────────────────────────────────────────
  describe('permission scoping', () => {
    it('STAFF sees their own rows even when staffId is omitted', async () => {
      const res = await request(app)
        .get('/api/v1/reports/PENDING_TASKS')
        .set('Authorization', `Bearer ${tokenForTenantA(allPermissions, UserRole.STAFF, fixtures.tenantA.userId)}`);
      expect(res.status).toBe(200);
      const ids = res.body.data.rows.map((r: { id: string }) => r.id);
      expect(ids).toContain(taskId);
    });

    it('STAFF cannot see another staff member\'s rows even by spoofing staffId in the query', async () => {
      const res = await request(app)
        .get('/api/v1/reports/PENDING_TASKS')
        .query({ staffId: fixtures.tenantA.userId })
        .set('Authorization', `Bearer ${tokenForTenantA(allPermissions, UserRole.STAFF, otherStaffUserId)}`);
      expect(res.status).toBe(200);
      const ids = res.body.data.rows.map((r: { id: string }) => r.id);
      expect(ids).not.toContain(taskId);
    });

    it('MANAGER sees tenant-wide rows regardless of staffId (no team-membership concept exists)', async () => {
      const res = await request(app)
        .get('/api/v1/reports/PENDING_TASKS')
        .set('Authorization', `Bearer ${tokenForTenantA(allPermissions, UserRole.MANAGER, otherStaffUserId)}`);
      expect(res.status).toBe(200);
      const ids = res.body.data.rows.map((r: { id: string }) => r.id);
      expect(ids).toContain(taskId);
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

    it("does not include tenant A's audit-log document activity in tenant B's report", async () => {
      const res = await request(app).get('/api/v1/reports/DOCUMENT_ACTIVITY').set('Authorization', `Bearer ${tokenForTenantB()}`);
      expect(res.status).toBe(200);
      const ids = res.body.data.rows.map((r: { id: string }) => r.id);
      expect(ids).not.toContain(auditLogId);
    });
  });
});
