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
 * logic (report-type dispatch, tenant scoping, PENDING_DOCUMENTS/PDF/XLSX
 * NOT_IMPLEMENTED handling, CSV export serialization). Mirrors
 * `tests/unit/modules/contacts/contact.service.spec.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';
const USER_ID = 'user-22222222-2222-2222-2222-222222222222';

type MockedRepository = {
  [K in
    | 'findNewLeads'
    | 'findConvertedClients'
    | 'findPendingTasks'
    | 'findPendingPayments'
    | 'findDocumentActivity'
    | 'findStaffAssignmentSummary'
    | 'findMonthlyPendingWork']: jest.Mock;
};

function createMockRepository(): MockedRepository {
  return {
    findNewLeads: jest.fn(),
    findConvertedClients: jest.fn(),
    findPendingTasks: jest.fn(),
    findPendingPayments: jest.fn(),
    findDocumentActivity: jest.fn(),
    findStaffAssignmentSummary: jest.fn(),
    findMonthlyPendingWork: jest.fn(),
  };
}

function createFakeRequest(): Request {
  return {
    tenant: { id: TENANT_ID, slug: 'acme', name: 'Acme & Co', planCode: 'professional', isActive: true },
    user: { id: USER_ID, email: 'staff@acme.test', role: UserRole.TENANT_ADMIN, tenantId: TENANT_ID, permissions: [] },
    correlationId: 'test-correlation-id',
  } as unknown as Request;
}

function createService(repository: MockedRepository): ReportService {
  return new ReportService(createFakeRequest(), repository as unknown as ReportsRepository);
}

describe('ReportService', () => {
  describe('generateReport — dispatch per type', () => {
    const cases: Array<[string, keyof MockedRepository]> = [
      ['NEW_LEADS', 'findNewLeads'],
      ['CONVERTED_CLIENTS', 'findConvertedClients'],
      ['PENDING_TASKS', 'findPendingTasks'],
      ['PAYMENTS_PENDING', 'findPendingPayments'],
      ['DOCUMENT_ACTIVITY', 'findDocumentActivity'],
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

    it('throws NotImplementedError for PENDING_DOCUMENTS without touching the repository', async () => {
      const repo = createMockRepository();
      const service = createService(repo);

      await expect(service.generateReport('PENDING_DOCUMENTS', {})).rejects.toThrow(NotImplementedError);
      Object.values(repo).forEach((fn) => expect(fn).not.toHaveBeenCalled());
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
        { id: 'lead-1', title: 'Acme Corp', source: 'Referral', stage: 'Qualified', createdAt: '2026-01-01T00:00:00.000Z' },
      ]);

      const service = createService(repo);
      const result = await service.exportReport('NEW_LEADS', {}, 'CSV');

      expect(result.contentType).toContain('text/csv');
      expect(result.filename).toBe('new-leads-report.csv');
      expect(result.body).toBe(
        'id,title,source,stage,createdAt\nlead-1,Acme Corp,Referral,Qualified,2026-01-01T00:00:00.000Z',
      );
    });

    it('propagates PENDING_DOCUMENTS not-implemented even for CSV format', async () => {
      const repo = createMockRepository();
      const service = createService(repo);

      await expect(service.exportReport('PENDING_DOCUMENTS', {}, 'CSV')).rejects.toThrow(NotImplementedError);
    });
  });
});
