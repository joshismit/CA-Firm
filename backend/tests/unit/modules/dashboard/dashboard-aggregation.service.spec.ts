import { Request } from 'express';

/** See the identical comment in tests/unit/modules/documents/document.service.spec.ts for why @config/database is stubbed. */
jest.mock('@config/database', () => ({ prisma: {} }));

import { UserRole } from '@shared/enums';
import { DashboardAggregationService } from '@modules/dashboard/service/dashboard-aggregation.service';
import { TaskService } from '@modules/tasks';
import { InvoiceService } from '@modules/client-billing';
import { LeadService } from '@modules/crm';
import { ComplianceDashboardReader } from '@modules/compliance';
import { AuditTimelineReader } from '@modules/audit';
import { ReportService } from '@modules/reports';
import { BusinessAssignmentRepository } from '@modules/business/repository/business-assignment.repository';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * DashboardAggregationService — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 * Every composed Service/Repository is fully mocked, injected via constructor
 * DI — mirrors `tests/unit/modules/dashboard/dashboard-preference.service.spec.ts`.
 * Focus: PRD §10.11 RBAC scoping (STAFF vs unrestricted roles) and that
 * `getWidgetData()`/`getOverview()`/`getPerformance()`/`getActivity()` compose
 * exactly the mocked collaborators, never a raw repository.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';
const USER_ID = 'user-22222222-2222-2222-2222-222222222222';

function paginatedTasks(total = 0) {
  return { data: [], meta: { page: 1, limit: 1, total, totalPages: 1, hasNextPage: false, hasPrevPage: false } };
}

function paginatedInvoices(total = 0) {
  return { data: [], meta: { page: 1, limit: 1, total, totalPages: 1, hasNextPage: false, hasPrevPage: false } };
}

function paginatedCompliance(total = 0) {
  return { data: [], meta: { page: 1, limit: 1, total, totalPages: 1, hasNextPage: false, hasPrevPage: false } };
}

function createFakeRequest(role: UserRole): Request {
  return {
    tenant: { id: TENANT_ID, slug: 'acme', name: 'Acme & Co', planCode: 'professional', isActive: true },
    user: { id: USER_ID, email: 'staff@acme.test', role, tenantId: TENANT_ID, permissions: [] },
    correlationId: 'test-correlation-id',
  } as unknown as Request;
}

function createMocks() {
  const taskService = { searchForDashboard: jest.fn().mockResolvedValue(paginatedTasks()) } as unknown as jest.Mocked<TaskService>;
  const invoiceService = {
    searchForDashboard: jest.fn().mockResolvedValue(paginatedInvoices()),
    sumOutstanding: jest.fn().mockResolvedValue({ count: 0, totalAmount: 0 }),
  } as unknown as jest.Mocked<InvoiceService>;
  const leadService = {
    listAssignedClients: jest.fn().mockResolvedValue([]),
    countAllClients: jest.fn().mockResolvedValue(0),
  } as unknown as jest.Mocked<LeadService>;
  const complianceDashboardReader = {
    listUpcomingDeadlines: jest.fn().mockResolvedValue(paginatedCompliance()),
  } as unknown as jest.Mocked<ComplianceDashboardReader>;
  const auditTimelineReader = {
    getRecentActivity: jest.fn().mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1, hasNextPage: false, hasPrevPage: false } }),
  } as unknown as jest.Mocked<AuditTimelineReader>;
  const reportService = {
    getDashboardPerformanceSummary: jest.fn().mockResolvedValue({
      pendingTasks: [],
      pendingPaymentsCount: 0,
      documentsUploadedCount: 0,
      staffAssignmentSummary: [{ staffId: 'x' }],
    }),
  } as unknown as jest.Mocked<ReportService>;
  const businessAssignmentRepository = {
    findBusinessIdsForUser: jest.fn().mockResolvedValue(['biz-1']),
  } as unknown as jest.Mocked<BusinessAssignmentRepository>;

  return { taskService, invoiceService, leadService, complianceDashboardReader, auditTimelineReader, reportService, businessAssignmentRepository };
}

function createService(role: UserRole, mocks = createMocks()) {
  const req = createFakeRequest(role);
  const service = new DashboardAggregationService(
    req,
    mocks.taskService,
    mocks.invoiceService,
    mocks.leadService,
    mocks.complianceDashboardReader,
    mocks.auditTimelineReader,
    mocks.reportService,
    mocks.businessAssignmentRepository,
  );
  return { service, mocks };
}

describe('DashboardAggregationService', () => {
  describe('RBAC scoping (PRD §10.11)', () => {
    it('STAFF: scopes tasks by assigneeId=me and resolves assigned Business ids via BusinessAssignmentRepository', async () => {
      const { service, mocks } = createService(UserRole.STAFF);

      await service.getOverview();

      expect(mocks.businessAssignmentRepository.findBusinessIdsForUser).toHaveBeenCalledWith(USER_ID, TENANT_ID);
      const [firstCallFilters] = mocks.taskService.searchForDashboard.mock.calls[0];
      expect(firstCallFilters.assigneeId).toBe(USER_ID);
    });

    it('TENANT_ADMIN: does not scope tasks by assignee and never resolves assigned Business ids', async () => {
      const { service, mocks } = createService(UserRole.TENANT_ADMIN);

      await service.getOverview();

      expect(mocks.businessAssignmentRepository.findBusinessIdsForUser).not.toHaveBeenCalled();
      const [firstCallFilters] = mocks.taskService.searchForDashboard.mock.calls[0];
      expect(firstCallFilters.assigneeId).toBeUndefined();
    });

    it('MANAGER is unrestricted, same as TENANT_ADMIN/MASTER_ADMIN', async () => {
      const { service, mocks } = createService(UserRole.MANAGER);

      await service.getOverview();

      expect(mocks.businessAssignmentRepository.findBusinessIdsForUser).not.toHaveBeenCalled();
    });

    it('getActivity: STAFF passes actorId=me; unrestricted roles pass no actorId (tenant-wide)', async () => {
      const staff = createService(UserRole.STAFF);
      await staff.service.getActivity(20);
      expect(staff.mocks.auditTimelineReader.getRecentActivity).toHaveBeenCalledWith(TENANT_ID, { actorId: USER_ID }, { page: 1, limit: 20 });

      const admin = createService(UserRole.TENANT_ADMIN);
      await admin.service.getActivity(20);
      expect(admin.mocks.auditTimelineReader.getRecentActivity).toHaveBeenCalledWith(TENANT_ID, { actorId: undefined }, { page: 1, limit: 20 });
    });

    it('getPerformance: staffBreakdown is null for STAFF, populated for unrestricted roles', async () => {
      const staff = createService(UserRole.STAFF);
      const staffResult = await staff.service.getPerformance();
      expect(staffResult.staffBreakdown).toBeNull();

      const admin = createService(UserRole.TENANT_ADMIN);
      const adminResult = await admin.service.getPerformance();
      expect(adminResult.staffBreakdown).toEqual([{ staffId: 'x' }]);
    });
  });

  describe('getWidgetData', () => {
    it('only populates the requested widget ids', async () => {
      const { service } = createService(UserRole.TENANT_ADMIN);

      const result = await service.getWidgetData(['pending-works', 'due-dates'], 5);

      expect(Object.keys(result).sort()).toEqual(['due-dates', 'pending-works']);
    });

    it('assigned-clients: unrestricted role gets a total-only count (no per-user Business scoping call)', async () => {
      const { service, mocks } = createService(UserRole.TENANT_ADMIN);
      mocks.leadService.countAllClients.mockResolvedValue(42);

      const result = await service.getWidgetData(['assigned-clients'], 5);

      expect(result['assigned-clients']?.total).toBe(42);
      expect(mocks.leadService.listAssignedClients).not.toHaveBeenCalled();
    });

    it('assigned-clients: STAFF resolves via listAssignedClients(businessIds)', async () => {
      const { service, mocks } = createService(UserRole.STAFF);
      mocks.leadService.listAssignedClients.mockResolvedValue([
        { id: 'c1', businessId: 'biz-1', status: 'ACTIVE', business: { id: 'biz-1', name: 'Acme Co' } } as never,
      ]);

      const result = await service.getWidgetData(['assigned-clients'], 5);

      expect(mocks.leadService.listAssignedClients).toHaveBeenCalledWith(['biz-1']);
      expect(result['assigned-clients']?.total).toBe(1);
    });

    it('outstanding-payments: includes totalAmount from sumOutstanding', async () => {
      const { service, mocks } = createService(UserRole.TENANT_ADMIN);
      mocks.invoiceService.sumOutstanding.mockResolvedValue({ count: 3, totalAmount: 1500 });

      const result = await service.getWidgetData(['outstanding-payments'], 5);

      expect(result['outstanding-payments']?.totalAmount).toBe(1500);
      expect(result['outstanding-payments']?.total).toBe(0); // from the mocked searchForDashboard meta.total default
    });
  });

  describe('getCalendar', () => {
    it('composes tasks, invoices, and compliance filings into one sorted feed', async () => {
      const { service, mocks } = createService(UserRole.TENANT_ADMIN);
      const now = new Date('2026-08-10T00:00:00.000Z');
      mocks.taskService.searchForDashboard.mockResolvedValue({
        data: [{ id: 't1', title: 'Task 1', dueDate: new Date('2026-08-12T00:00:00.000Z') } as never],
        meta: { page: 1, limit: 100, total: 1, totalPages: 1, hasNextPage: false, hasPrevPage: false },
      });
      mocks.invoiceService.searchForDashboard.mockResolvedValue({
        data: [{ id: 'i1', invoiceNumber: 'INV-1', dueDate: new Date('2026-08-11T00:00:00.000Z') } as never],
        meta: { page: 1, limit: 100, total: 1, totalPages: 1, hasNextPage: false, hasPrevPage: false },
      });

      const result = await service.getCalendar(now, new Date('2026-09-01T00:00:00.000Z'));

      expect(result.items.map((i) => i.type)).toEqual(['invoice', 'task']);
    });
  });
});
