import { Request } from 'express';

jest.mock('@config/database', () => ({ prisma: {} }));

import { UserRole } from '@shared/enums';
import { NotImplementedError } from '@shared/errors';
import { ReportService } from '@modules/reports/service/report.service';
import { ReportsRepository } from '@modules/reports/repository/reports.repository';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ReportService — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 * The repository is fully mocked — exercises only ReportService's business
 * logic (report-type dispatch, tenant scoping, PRD §13.2 staff-scoping
 * enforcement, CONVERTED_CLIENTS `meta`, PDF/XLSX NOT_IMPLEMENTED handling,
 * CSV export serialization). Mirrors `tests/unit/modules/contacts/contact
 * .service.spec.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';
const USER_ID = 'user-22222222-2222-2222-2222-222222222222';
const OTHER_USER_ID = 'user-33333333-3333-3333-3333-333333333333';

type MockedRepository = {
  [K in
    | 'findNewLeads'
    | 'findConvertedClients'
    | 'getConvertedClientsSummary'
    | 'findPendingTasks'
    | 'findPendingDocuments'
    | 'findPendingPayments'
    | 'findPaymentsPendingReport'
    | 'findDocumentActivity'
    | 'findDocumentActivityReport'
    | 'findStaffAssignmentSummary'
    | 'findMonthlyPendingWork']: jest.Mock;
};

function createMockRepository(): MockedRepository {
  return {
    findNewLeads: jest.fn(),
    findConvertedClients: jest.fn(),
    getConvertedClientsSummary: jest.fn(),
    findPendingTasks: jest.fn(),
    findPendingDocuments: jest.fn(),
    findPendingPayments: jest.fn(),
    findPaymentsPendingReport: jest.fn(),
    findDocumentActivity: jest.fn(),
    findDocumentActivityReport: jest.fn(),
    findStaffAssignmentSummary: jest.fn(),
    findMonthlyPendingWork: jest.fn(),
  };
}

function createFakeRequest(role: UserRole = UserRole.TENANT_ADMIN, userId: string = USER_ID): Request {
  return {
    tenant: { id: TENANT_ID, slug: 'acme', name: 'Acme & Co', planCode: 'professional', isActive: true },
    user: { id: userId, email: 'staff@acme.test', role, tenantId: TENANT_ID, permissions: [] },
    correlationId: 'test-correlation-id',
  } as unknown as Request;
}

function createService(repository: MockedRepository, role: UserRole = UserRole.TENANT_ADMIN, userId: string = USER_ID): ReportService {
  return new ReportService(createFakeRequest(role, userId), repository as unknown as ReportsRepository);
}

describe('ReportService', () => {
  describe('generateReport — dispatch per type', () => {
    const cases: Array<[string, keyof MockedRepository]> = [
      ['NEW_LEADS', 'findNewLeads'],
      ['CONVERTED_CLIENTS', 'findConvertedClients'],
      ['PENDING_TASKS', 'findPendingTasks'],
      ['PENDING_DOCUMENTS', 'findPendingDocuments'],
      ['PAYMENTS_PENDING', 'findPaymentsPendingReport'],
      ['DOCUMENT_ACTIVITY', 'findDocumentActivityReport'],
      ['STAFF_ASSIGNMENT_SUMMARY', 'findStaffAssignmentSummary'],
      ['MONTHLY_PENDING_WORK', 'findMonthlyPendingWork'],
    ];

    it.each(cases)('dispatches %s to repository.%s, scoped to this tenant', async (type, method) => {
      const repo = createMockRepository();
      const rows = [{ id: '1' }];
      repo[method].mockResolvedValue(rows);

      const service = createService(repo);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await service.generateReport(type as any, { staffId: undefined });

      expect(repo[method]).toHaveBeenCalledWith(TENANT_ID, { staffId: undefined });
      expect(result.type).toBe(type);
      expect(result.rows).toBe(rows);
      expect(typeof result.generatedAt).toBe('string');
    });

    it('never touches findPendingPayments/findDocumentActivity (the dashboard-only methods) when dispatching the report types', async () => {
      const repo = createMockRepository();
      repo.findPaymentsPendingReport.mockResolvedValue([]);
      repo.findDocumentActivityReport.mockResolvedValue([]);
      const service = createService(repo);

      await service.generateReport('PAYMENTS_PENDING', {});
      await service.generateReport('DOCUMENT_ACTIVITY', {});

      expect(repo.findPendingPayments).not.toHaveBeenCalled();
      expect(repo.findDocumentActivity).not.toHaveBeenCalled();
    });
  });

  describe('generateReport — PRD §13.2 staff scoping', () => {
    it('STAFF: forces filters.staffId to the caller\'s own id, ignoring any caller-supplied staffId', async () => {
      const repo = createMockRepository();
      repo.findPendingTasks.mockResolvedValue([]);
      const service = createService(repo, UserRole.STAFF, USER_ID);

      await service.generateReport('PENDING_TASKS', { staffId: OTHER_USER_ID });

      expect(repo.findPendingTasks).toHaveBeenCalledWith(TENANT_ID, { staffId: USER_ID });
    });

    it('STAFF: forces filters.staffId even when the query omitted it entirely', async () => {
      const repo = createMockRepository();
      repo.findPendingTasks.mockResolvedValue([]);
      const service = createService(repo, UserRole.STAFF, USER_ID);

      await service.generateReport('PENDING_TASKS', {});

      expect(repo.findPendingTasks).toHaveBeenCalledWith(TENANT_ID, { staffId: USER_ID });
    });

    it.each([UserRole.MANAGER, UserRole.TENANT_ADMIN, UserRole.MASTER_ADMIN])(
      '%s: is unrestricted — caller-supplied filters pass through unchanged',
      async (role) => {
        const repo = createMockRepository();
        repo.findPendingTasks.mockResolvedValue([]);
        const service = createService(repo, role, USER_ID);

        await service.generateReport('PENDING_TASKS', { staffId: OTHER_USER_ID });

        expect(repo.findPendingTasks).toHaveBeenCalledWith(TENANT_ID, { staffId: OTHER_USER_ID });
      },
    );
  });

  describe('generateReport — CONVERTED_CLIENTS meta (PRD §13.2 report #2 conversion ratio)', () => {
    it('includes meta from repository.getConvertedClientsSummary', async () => {
      const repo = createMockRepository();
      repo.findConvertedClients.mockResolvedValue([]);
      repo.getConvertedClientsSummary.mockResolvedValue({ totalLeads: 10, convertedLeads: 2, conversionRatio: 0.2 });
      const service = createService(repo);

      const result = await service.generateReport('CONVERTED_CLIENTS', {});

      expect(result.meta).toEqual({ totalLeads: 10, convertedLeads: 2, conversionRatio: 0.2 });
    });

    it('omits meta entirely for every other report type', async () => {
      const repo = createMockRepository();
      repo.findNewLeads.mockResolvedValue([]);
      const service = createService(repo);

      const result = await service.generateReport('NEW_LEADS', {});

      expect(result.meta).toBeUndefined();
      expect(repo.getConvertedClientsSummary).not.toHaveBeenCalled();
    });
  });

  describe('getDashboardPerformanceSummary (PRD §10.7 — must never change behavior for the Dashboard)', () => {
    it('calls only the four original dashboard-only finders, never the fuller §13.2 report versions', async () => {
      const repo = createMockRepository();
      repo.findPendingTasks.mockResolvedValue([{ id: 'task-1' }]);
      repo.findPendingPayments.mockResolvedValue([{ id: 'payment-1' }]);
      repo.findDocumentActivity.mockResolvedValue([{ id: 'doc-1' }]);
      repo.findStaffAssignmentSummary.mockResolvedValue([{ staffId: USER_ID }]);
      const service = createService(repo);

      const result = await service.getDashboardPerformanceSummary({});

      expect(repo.findPendingTasks).toHaveBeenCalledWith(TENANT_ID, {});
      expect(repo.findPendingPayments).toHaveBeenCalledWith(TENANT_ID, {});
      expect(repo.findDocumentActivity).toHaveBeenCalledWith(TENANT_ID, {});
      expect(repo.findStaffAssignmentSummary).toHaveBeenCalledWith(TENANT_ID, {});
      expect(repo.findPaymentsPendingReport).not.toHaveBeenCalled();
      expect(repo.findDocumentActivityReport).not.toHaveBeenCalled();

      expect(result.pendingPaymentsCount).toBe(1);
      expect(result.documentsUploadedCount).toBe(1);
    });
  });

  describe('exportReport', () => {
    it('throws NotImplementedError for PDF without touching the repository', async () => {
      const repo = createMockRepository();
      const service = createService(repo);

      await expect(service.exportReport('NEW_LEADS', {}, 'PDF')).rejects.toThrow(NotImplementedError);
      expect(repo.findNewLeads).not.toHaveBeenCalled();
    });

    it('throws NotImplementedError for XLSX without touching the repository', async () => {
      const repo = createMockRepository();
      const service = createService(repo);

      await expect(service.exportReport('NEW_LEADS', {}, 'XLSX')).rejects.toThrow(NotImplementedError);
      expect(repo.findNewLeads).not.toHaveBeenCalled();
    });

    it('generates a real CSV body for format=CSV', async () => {
      const repo = createMockRepository();
      repo.findNewLeads.mockResolvedValue([
        { id: 'lead-1', title: 'Acme Corp', source: 'Referral', stage: 'Qualified', owner: null, createdAt: '2026-01-01T00:00:00.000Z' },
      ]);

      const service = createService(repo);
      const result = await service.exportReport('NEW_LEADS', {}, 'CSV');

      expect(result.contentType).toContain('text/csv');
      expect(result.filename).toBe('new-leads-report.csv');
      expect(result.body).toBe(
        'id,title,source,stage,owner,createdAt\nlead-1,Acme Corp,Referral,Qualified,,2026-01-01T00:00:00.000Z',
      );
    });

    it('exports PENDING_DOCUMENTS as CSV now that it is implemented', async () => {
      const repo = createMockRepository();
      repo.findPendingDocuments.mockResolvedValue([{ id: 'req-1', businessName: 'Acme', isOverdue: true }]);

      const service = createService(repo);
      const result = await service.exportReport('PENDING_DOCUMENTS', {}, 'CSV');

      expect(result.filename).toBe('pending-documents-report.csv');
      expect(result.body).toContain('req-1');
    });
  });
});
