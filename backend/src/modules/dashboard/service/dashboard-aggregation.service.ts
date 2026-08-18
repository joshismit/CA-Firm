import { Request } from 'express';
import { prisma } from '@config/database';
import { InvoiceStatus, ComplianceFilingStatus, TaskStatus, TaskPriority } from '@prisma/client';
import { UserRole } from '@shared/enums';
import { BaseService } from '@shared/base';
import { PaginationQuery } from '@shared/types';
import { TaskService, TERMINAL_STATUSES } from '@modules/tasks';
import { InvoiceService, InvoiceWithBusiness } from '@modules/client-billing';
import { LeadService, ClientWithBusiness } from '@modules/crm';
import { ComplianceDashboardReader } from '@modules/compliance';
import { AuditTimelineReader } from '@modules/audit';
import { ReportService } from '@modules/reports';
import { BusinessAssignmentRepository } from '@modules/business/repository/business-assignment.repository';
import { DashboardWidgetDataId } from '../constants/dashboard-widget-ids';
import {
  DashboardOverviewResponseDto,
  DashboardWidgetDataResponseDto,
  DashboardWidgetDataEntry,
  TaskSummaryItem,
  InvoiceSummaryItem,
  ComplianceFilingSummaryItem,
  ClientSummaryItem,
  DashboardCalendarResponseDto,
  CalendarEntry,
  DashboardActivityResponseDto,
  DashboardPerformanceResponseDto,
} from '../dto/dashboard.res.dto';

/** Non-terminal task statuses — reuses `TaskRepository.TERMINAL_STATUSES` (via `@modules/tasks`)
 * rather than inventing a third "open work" definition alongside it and `ReportsRepository
 * .OPEN_TASK_STATUSES`. */
const OPEN_TASK_STATUSES: TaskStatus[] = Object.values(TaskStatus).filter(
  (status) => !TERMINAL_STATUSES.includes(status),
);

/**
 * Non-terminal invoice statuses that still represent money owed. Deliberately excludes
 * DRAFT (never sent) and VOID/PAID (settled). Known limitation (see this class's header
 * comment): `InvoiceStatus.OVERDUE` is never actually set by any write path in this
 * codebase today, so in practice this only ever matches `SENT` invoices until that gap
 * closes — included anyway so the query is already correct once it does.
 */
const OUTSTANDING_INVOICE_STATUSES: InvoiceStatus[] = [InvoiceStatus.SENT, InvoiceStatus.OVERDUE];

/** Not-yet-filed compliance statuses — "deadlines still ahead of us." Mirrors
 * `ReportsRepository.findMonthlyPendingWork()`'s own "not-FILED" definition. */
const OPEN_COMPLIANCE_STATUSES: ComplianceFilingStatus[] = [ComplianceFilingStatus.DRAFT, ComplianceFilingStatus.PENDING];

/**
 * Mirrors `DocumentAccessScopeService.UNRESTRICTED_COARSE_ROLES` (`modules/documents`) —
 * same small, intentional duplication as `TaskRepository.TERMINAL_STATUSES` vs
 * `ReportsRepository.OPEN_TASK_STATUSES` elsewhere in this codebase; not worth a shared
 * constants module for one three-value array reused twice.
 */
const UNRESTRICTED_COARSE_ROLES: UserRole[] = [UserRole.TENANT_ADMIN, UserRole.MASTER_ADMIN, UserRole.MANAGER];

const DUE_DATES_LOOKAHEAD_DAYS = 7;

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Dashboard Aggregation Service
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * PRD §10.5 — the dashboard's aggregation layer. Composes exclusively through
 * other modules' exported Services (`TaskService`, `InvoiceService`,
 * `LeadService`, `ComplianceDashboardReader`, `AuditTimelineReader`,
 * `ReportService`) — never a raw repository — mirroring
 * `LeadService.getDashboardStats()`'s own cross-module composition style,
 * with one precedented exception: `BusinessAssignmentRepository` is reached
 * directly, exactly as `DocumentAccessScopeService` already does for the
 * same "which Businesses is this user assigned to" question. This service
 * never runs its own Prisma queries — every number it returns traces back to
 * an existing module's own repository.
 *
 * PRD §10.11 — every method here enforces its own "my X only" scoping,
 * because the underlying repos/services don't: `requirePermission()` only
 * gates all-tenant visibility, there's no built-in "assignee-only" filter.
 * `isUnrestricted()` decides between "tenant-wide" and "scoped to me."
 * `ComplianceFiling` has no assignee/business column at all (PRD finding),
 * so Compliance Deadlines are tenant-wide for every role — not a bug.
 *
 * Known limitation: `InvoiceStatus.OVERDUE` and `PaymentStatus.COMPLETED`
 * are never set by any write path in this codebase today (grep-confirmed
 * zero matches outside their enum declarations) — Outstanding Payments /
 * Performance's revenue figures are structurally correct but will only ever
 * reflect `DRAFT`/`SENT` invoices until the billing module's
 * status-transition gap closes. Not fixed here — a pre-existing, separate
 * issue outside this feature's scope.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class DashboardAggregationService extends BaseService {
  constructor(
    req: Request,
    private readonly taskService: TaskService = new TaskService(req),
    private readonly invoiceService: InvoiceService = new InvoiceService(req),
    private readonly leadService: LeadService = new LeadService(req),
    private readonly complianceDashboardReader: ComplianceDashboardReader = new ComplianceDashboardReader(),
    private readonly auditTimelineReader: AuditTimelineReader = new AuditTimelineReader(),
    private readonly reportService: ReportService = new ReportService(req),
    private readonly businessAssignmentRepository: BusinessAssignmentRepository = new BusinessAssignmentRepository(prisma),
  ) {
    super(req);
  }

  async getOverview(): Promise<DashboardOverviewResponseDto> {
    const tenantId = this.tenantId as string;
    const unrestricted = this.isUnrestricted();
    const assigneeId = unrestricted ? undefined : this.userId;
    const businessIdIn = await this.resolveAssignedBusinessIds();
    const now = new Date();
    const dueDatesUntil = new Date(now.getTime() + DUE_DATES_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);

    const [pendingWorks, dueDates, complianceDeadlines, assignedClientsCount, outstanding] = await Promise.all([
      this.taskService.searchForDashboard({ statusIn: OPEN_TASK_STATUSES, assigneeId }, { page: 1, limit: 1 }),
      this.taskService.searchForDashboard(
        { statusIn: OPEN_TASK_STATUSES, assigneeId, dueBefore: dueDatesUntil },
        { page: 1, limit: 1 },
      ),
      this.complianceDashboardReader.listUpcomingDeadlines(tenantId, { dueBefore: dueDatesUntil }, { page: 1, limit: 1 }),
      this.countAssignedClients(unrestricted, businessIdIn),
      this.invoiceService.sumOutstanding({ statusIn: OUTSTANDING_INVOICE_STATUSES, businessIdIn }),
    ]);

    return {
      pendingWorksCount: pendingWorks.meta.total,
      dueDatesCount: dueDates.meta.total,
      paymentRemindersCount: outstanding.count,
      complianceDeadlinesCount: complianceDeadlines.meta.total,
      assignedClientsCount,
      outstandingPaymentsCount: outstanding.count,
      outstandingPaymentsTotal: outstanding.totalAmount,
      generatedAt: now.toISOString(),
    };
  }

  async getWidgetData(ids: DashboardWidgetDataId[], limit: number): Promise<DashboardWidgetDataResponseDto> {
    const result: DashboardWidgetDataResponseDto = {};

    await Promise.all(
      ids.map(async (id) => {
        result[id] = await this.getSingleWidgetData(id, limit);
      }),
    );

    return result;
  }

  async getCalendar(from: Date, to: Date): Promise<DashboardCalendarResponseDto> {
    const tenantId = this.tenantId as string;
    const assigneeId = this.isUnrestricted() ? undefined : this.userId;
    const businessIdIn = await this.resolveAssignedBusinessIds();
    const pagination: PaginationQuery = { page: 1, limit: 100 };

    const [tasks, invoices, compliance] = await Promise.all([
      this.taskService.searchForDashboard({ assigneeId, dueAfter: from, dueBefore: to }, pagination),
      this.invoiceService.searchForDashboard({ businessIdIn, dueAfter: from, dueBefore: to }, pagination),
      this.complianceDashboardReader.listUpcomingDeadlines(tenantId, { dueAfter: from, dueBefore: to }, pagination),
    ]);

    const items: CalendarEntry[] = [
      ...tasks.data
        .filter((task) => task.dueDate)
        .map((task) => ({
          id: task.id,
          type: 'task' as const,
          title: task.title,
          date: task.dueDate!.toISOString(),
          href: `/tasks/${task.id}`,
        })),
      ...invoices.data
        .filter((invoice) => invoice.dueDate)
        .map((invoice) => ({
          id: invoice.id,
          type: 'invoice' as const,
          title: `Invoice ${invoice.invoiceNumber}`,
          date: invoice.dueDate!.toISOString(),
          href: `/billing/invoices/${invoice.id}`,
        })),
      ...compliance.data
        .filter((filing) => filing.dueDate)
        .map((filing) => ({
          id: filing.id,
          type: 'compliance' as const,
          title: `${filing.category} — ${filing.reference}`,
          date: filing.dueDate as string,
          href: `/${filing.category.toLowerCase()}/${filing.id}`,
        })),
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return { items };
  }

  async getActivity(limit: number): Promise<DashboardActivityResponseDto> {
    const tenantId = this.tenantId as string;
    const actorId = this.isUnrestricted() ? undefined : this.userId;

    const { data } = await this.auditTimelineReader.getRecentActivity(tenantId, { actorId }, { page: 1, limit });

    return {
      items: data.map((entry) => ({
        id: entry.id,
        eventType: entry.eventType,
        description: entry.description,
        actorName: entry.actorName,
        targetType: entry.targetType,
        targetId: entry.targetId,
        createdAt: entry.createdAt,
      })),
    };
  }

  async getPerformance(from?: Date, to?: Date): Promise<DashboardPerformanceResponseDto> {
    const unrestricted = this.isUnrestricted();
    const range = this.resolveMonthRange(from, to);
    const staffId = unrestricted ? undefined : this.userId;

    const [summary, completed, overdue] = await Promise.all([
      this.reportService.getDashboardPerformanceSummary({ from: range.from, to: range.to, staffId }),
      this.taskService.searchForDashboard({ statusIn: [TaskStatus.COMPLETED], assigneeId: staffId }, { page: 1, limit: 1 }),
      this.taskService.searchForDashboard(
        { statusIn: OPEN_TASK_STATUSES, assigneeId: staffId, dueBefore: new Date() },
        { page: 1, limit: 1 },
      ),
    ]);

    return {
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      tasks: {
        completed: completed.meta.total,
        pending: summary.pendingTasks.length,
        overdue: overdue.meta.total,
      },
      documentsUploaded: summary.documentsUploadedCount,
      pendingPayments: summary.pendingPaymentsCount,
      staffBreakdown: unrestricted ? summary.staffAssignmentSummary : null,
    };
  }

  // ── Per-widget dispatch (GET /dashboard/widgets) ─────────────────────────

  private async getSingleWidgetData(id: DashboardWidgetDataId, limit: number): Promise<DashboardWidgetDataEntry> {
    switch (id) {
      case 'pending-works':
        return this.pendingWorksWidget(limit);
      case 'due-dates':
        return this.dueDatesWidget(limit);
      case 'payment-reminders':
        return this.paymentRemindersWidget(limit);
      case 'compliance-deadlines':
        return this.complianceDeadlinesWidget(limit);
      case 'assigned-clients':
        return this.assignedClientsWidget(limit);
      case 'outstanding-payments':
        return this.outstandingPaymentsWidget(limit);
      default: {
        const exhaustiveCheck: never = id;
        throw new Error(`Unknown dashboard widget id: ${String(exhaustiveCheck)}`);
      }
    }
  }

  private async pendingWorksWidget(limit: number): Promise<DashboardWidgetDataEntry> {
    const assigneeId = this.isUnrestricted() ? undefined : this.userId;
    const { data, meta } = await this.taskService.searchForDashboard(
      { statusIn: OPEN_TASK_STATUSES, assigneeId },
      { page: 1, limit, sortBy: 'dueDate', sortOrder: 'asc' },
    );
    return { items: data.map((task) => this.toTaskSummaryItem(task)), total: meta.total };
  }

  private async dueDatesWidget(limit: number): Promise<DashboardWidgetDataEntry> {
    const assigneeId = this.isUnrestricted() ? undefined : this.userId;
    const dueBefore = new Date(Date.now() + DUE_DATES_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);
    const { data, meta } = await this.taskService.searchForDashboard(
      { statusIn: OPEN_TASK_STATUSES, assigneeId, dueBefore },
      { page: 1, limit, sortBy: 'dueDate', sortOrder: 'asc' },
    );
    return { items: data.map((task) => this.toTaskSummaryItem(task)), total: meta.total };
  }

  private async paymentRemindersWidget(limit: number): Promise<DashboardWidgetDataEntry> {
    const businessIdIn = await this.resolveAssignedBusinessIds();
    const { data, meta } = await this.invoiceService.searchForDashboard(
      { statusIn: OUTSTANDING_INVOICE_STATUSES, businessIdIn },
      { page: 1, limit, sortBy: 'dueDate', sortOrder: 'asc' },
    );
    return { items: data.map((invoice) => this.toInvoiceSummaryItem(invoice)), total: meta.total };
  }

  private async complianceDeadlinesWidget(limit: number): Promise<DashboardWidgetDataEntry> {
    const tenantId = this.tenantId as string;
    const { data, meta } = await this.complianceDashboardReader.listUpcomingDeadlines(
      tenantId,
      { statusIn: OPEN_COMPLIANCE_STATUSES },
      { page: 1, limit },
    );
    const items: ComplianceFilingSummaryItem[] = data.map((filing) => ({
      id: filing.id,
      category: filing.category,
      reference: filing.reference,
      period: filing.period,
      status: filing.status,
      dueDate: filing.dueDate,
    }));
    return { items, total: meta.total };
  }

  private async assignedClientsWidget(limit: number): Promise<DashboardWidgetDataEntry> {
    if (this.isUnrestricted()) {
      // No dedicated paginated "all tenant clients" finder exists on `ClientRepository`
      // (deliberately scoped to Lead-conversion needs, see that repository's header
      // comment) — unrestricted roles get an honest count with no item list here; the
      // full tenant Client list already exists at `/crm`.
      return { items: [], total: await this.leadService.countAllClients() };
    }

    const businessIdIn = (await this.resolveAssignedBusinessIds()) ?? [];
    const clients = await this.leadService.listAssignedClients(businessIdIn);
    const items: ClientSummaryItem[] = clients.slice(0, limit).map((client) => this.toClientSummaryItem(client));
    return { items, total: clients.length };
  }

  private async outstandingPaymentsWidget(limit: number): Promise<DashboardWidgetDataEntry> {
    const businessIdIn = await this.resolveAssignedBusinessIds();
    const [{ data, meta }, totals] = await Promise.all([
      this.invoiceService.searchForDashboard(
        { statusIn: OUTSTANDING_INVOICE_STATUSES, businessIdIn },
        { page: 1, limit, sortBy: 'amount', sortOrder: 'desc' },
      ),
      this.invoiceService.sumOutstanding({ statusIn: OUTSTANDING_INVOICE_STATUSES, businessIdIn }),
    ]);
    return { items: data.map((invoice) => this.toInvoiceSummaryItem(invoice)), total: meta.total, totalAmount: totals.totalAmount };
  }

  // ── Shared mapping helpers ────────────────────────────────────────────────

  private toTaskSummaryItem(task: {
    id: string;
    title: string;
    status: TaskStatus;
    priority: TaskPriority | null;
    dueDate: Date | null;
  }): TaskSummaryItem {
    return {
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate ? task.dueDate.toISOString() : null,
      isOverdue: !!task.dueDate && task.dueDate < new Date() && !TERMINAL_STATUSES.includes(task.status),
    };
  }

  private toInvoiceSummaryItem(invoice: InvoiceWithBusiness): InvoiceSummaryItem {
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      businessName: invoice.business?.name ?? null,
      amount: invoice.amount.toNumber(),
      dueDate: invoice.dueDate ? invoice.dueDate.toISOString() : null,
      status: invoice.status,
    };
  }

  private toClientSummaryItem(client: ClientWithBusiness): ClientSummaryItem {
    return {
      id: client.id,
      businessId: client.businessId,
      businessName: client.business?.name ?? null,
      status: client.status,
    };
  }

  // ── RBAC scoping (PRD §10.11) ─────────────────────────────────────────────

  private isUnrestricted(): boolean {
    const role = this.req.user?.role;
    return !role || UNRESTRICTED_COARSE_ROLES.includes(role);
  }

  /** `undefined` = no Business restriction (unrestricted role). Otherwise the caller's real — possibly empty — assigned Business ids. */
  private async resolveAssignedBusinessIds(): Promise<string[] | undefined> {
    if (this.isUnrestricted()) return undefined;
    return this.businessAssignmentRepository.findBusinessIdsForUser(this.userId as string, this.tenantId as string);
  }

  private async countAssignedClients(unrestricted: boolean, businessIdIn: string[] | undefined): Promise<number> {
    if (unrestricted) return this.leadService.countAllClients();
    const clients = await this.leadService.listAssignedClients(businessIdIn ?? []);
    return clients.length;
  }

  private resolveMonthRange(from?: Date, to?: Date): { from: Date; to: Date } {
    if (from && to) return { from, to };
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { from: from ?? start, to: to ?? end };
  }
}
