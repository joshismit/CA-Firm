import { PrismaClient, Prisma, TaskStatus, PaymentStatus, ComplianceFilingStatus, InvoiceStatus, DocumentRequestStatus, AuditEventType } from '@prisma/client';

export type ReportGroupBy = 'SOURCE' | 'OWNER' | 'STAFF' | 'PRIORITY' | 'STATUS' | 'DUE_DATE' | 'BUSINESS' | 'DATE';

export interface ReportFilters {
  from?: Date;
  to?: Date;
  staffId?: string;
  /** PRD §13.2 — when set, a report returns aggregated `{groupKey, groupLabel, count, amount?}` rows instead of raw entity rows. Each report method only honors the `ReportGroupBy` values relevant to it; others fall through to the flat (ungrouped) shape. */
  groupBy?: ReportGroupBy;
}

type ReportRow = Record<string, unknown>;

/**
 * PRD §9 — "open" task statuses across both lifecycles (simple flow's
 * TODO/IN_PROGRESS/REVIEW plus the approval workflow's REQUESTED/SUBMITTED/
 * UNDER_REVIEW/APPROVED). COMPLETED/CANCELLED/REJECTED are excluded — the
 * three ways a task's work is actually done or abandoned, mirroring
 * `TaskRepository`'s own `TERMINAL_STATUSES` distinction between "still open"
 * and "no longer counts as open/overdue-eligible work", except REJECTED is
 * additionally excluded here since a rejected task isn't "pending work" until
 * it's reopened back to REQUESTED.
 */
const OPEN_TASK_STATUSES: TaskStatus[] = [
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.REVIEW,
  TaskStatus.REQUESTED,
  TaskStatus.SUBMITTED,
  TaskStatus.UNDER_REVIEW,
  TaskStatus.APPROVED,
];

/**
 * Non-terminal invoice statuses that still represent money owed. Mirrors
 * `dashboard-aggregation.service.ts`'s identical `OUTSTANDING_INVOICE_STATUSES`
 * constant exactly (same small, intentional duplication as `OPEN_TASK_STATUSES`
 * vs `TaskRepository.TERMINAL_STATUSES` elsewhere in this codebase — not worth
 * a shared constants module for one two-value array reused twice). Deliberately
 * excludes DRAFT (never sent) and VOID/PAID (settled).
 */
const OUTSTANDING_INVOICE_STATUSES: InvoiceStatus[] = [InvoiceStatus.SENT, InvoiceStatus.OVERDUE];

/** PRD §13.2 report #6 — the `AuditEventType` values that count as "document activity" (reused, never fabricated: all four already exist and are already written by `DocumentService`). */
const DOCUMENT_ACTIVITY_EVENT_TYPES: AuditEventType[] = [
  AuditEventType.UPLOAD,
  AuditEventType.DOWNLOAD,
  AuditEventType.SHARE,
  AuditEventType.VERSION_CREATE,
];

/** The `AuditLog.targetType` value `DocumentService` stamps on every document-activity event — mirrors `document.service.ts`'s own literal (that module deliberately doesn't export it; see its "go through DocumentService, never around it" barrel comment). */
const DOCUMENT_TARGET_TYPE = 'Document';

interface StaffAssignmentEntry {
  staffName: string;
  assignedClients: number;
  assignedLeads: number;
  total: number;
  todo: number;
  inProgress: number;
  review: number;
  completed: number;
  cancelled: number;
  requested: number;
  submitted: number;
  underReview: number;
  approved: number;
  rejected: number;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Reports Repository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Read-only projections over existing entities (`Lead`, `LeadConversion`,
 * `Task`, `Document`, `DocumentRequest`, `Payment`, `Invoice`,
 * `ComplianceFiling`, `AuditLog`, `BusinessAssignment`, `LeadAssignment`) —
 * reports have no Prisma model of their own (per explicit product direction:
 * "reports are generated views over existing data", not a reporting
 * database). Every method is a plain, synchronous read: no caching, no OLAP,
 * no background jobs, no raw SQL.
 *
 * Deliberately NOT a `BaseRepository<TDelegate, TEntity>` subclass — that
 * base class assumes a single tenant-scoped entity with one delegate; this
 * repository spans many different, unrelated models, each with its own
 * scoping and shape. Composes each source module's own Prisma model directly
 * rather than importing another module's repository/service — this is a
 * read-only cross-cutting concern, not a write operation that needs another
 * module's business rules.
 *
 * `findPendingPayments()`, `findDocumentActivity()`, and
 * `findStaffAssignmentSummary()` are also consumed by
 * `ReportService.getDashboardPerformanceSummary()` (PRD §10.7, the
 * Dashboard's "Performance" widget) — their existing return shapes/semantics
 * are preserved exactly (Payment-only, Document-upload-only, task-breakdown
 * respectively) so that widget never changes behavior. The fuller PRD §13.2
 * versions of Payments Pending and Document Activity (which pull in
 * Invoice/AuditLog data the dashboard was never built to expect) are
 * deliberately separate methods (`findPaymentsPendingReport()`,
 * `findDocumentActivityReport()`) rather than edits to those two shared
 * methods, so the dashboard's existing call path is never touched.
 *
 * Every query is scoped by `tenantId` and excludes soft-deleted rows,
 * matching each source entity's own established convention exactly.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class ReportsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /** `undefined` (not `{}`) when neither bound is given, so the Prisma `where` clause omits the field entirely rather than filtering on an empty range. */
  private dateRange(filters: ReportFilters): { gte?: Date; lte?: Date } | undefined {
    if (!filters.from && !filters.to) return undefined;
    return { gte: filters.from, lte: filters.to };
  }

  /** Generic "group + count (+ optional sum)" reducer shared by every `groupBy` branch below — keeps the aggregation logic (not the domain query) in exactly one place. */
  private static aggregate<T>(
    items: T[],
    keyOf: (item: T) => string,
    labelOf: (item: T) => string,
    amountOf?: (item: T) => number,
  ): ReportRow[] {
    const buckets = new Map<string, { label: string; count: number; amount: number }>();

    for (const item of items) {
      const key = keyOf(item);
      if (!buckets.has(key)) buckets.set(key, { label: labelOf(item), count: 0, amount: 0 });
      const bucket = buckets.get(key) as { label: string; count: number; amount: number };
      bucket.count += 1;
      if (amountOf) bucket.amount += amountOf(item);
    }

    return Array.from(buckets.entries()).map(([groupKey, v]) => ({
      groupKey,
      groupLabel: v.label,
      count: v.count,
      ...(amountOf ? { amount: v.amount } : {}),
    }));
  }

  /**
   * NEW_LEADS — Leads created within the date range, with their source/stage/
   * primary-assignee ("owner", PRD §8.4's `LeadAssignment.isPrimary` — "lead
   * owner") names. `staffId` filters to leads assigned to that user via
   * `LeadAssignment`. `groupBy: 'SOURCE' | 'OWNER'` returns aggregated count
   * rows instead (PRD §13.2 "Grouped by source" / "Grouped by owner").
   */
  async findNewLeads(tenantId: string, filters: ReportFilters): Promise<ReportRow[]> {
    const leads = await this.prisma.lead.findMany({
      where: {
        tenantId,
        deletedAt: null,
        createdAt: this.dateRange(filters),
        ...(filters.staffId ? { assignments: { some: { userId: filters.staffId } } } : {}),
      },
      include: {
        source: { select: { name: true } },
        stage: { select: { name: true } },
        assignments: {
          where: { isPrimary: true },
          take: 1,
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (filters.groupBy === 'SOURCE') {
      return ReportsRepository.aggregate(
        leads,
        (lead) => lead.sourceId,
        (lead) => lead.source.name,
      );
    }

    if (filters.groupBy === 'OWNER') {
      return ReportsRepository.aggregate(
        leads,
        (lead) => lead.assignments[0]?.userId ?? 'unassigned',
        (lead) => (lead.assignments[0] ? `${lead.assignments[0].user.firstName} ${lead.assignments[0].user.lastName}` : 'Unassigned'),
      );
    }

    return leads.map((lead) => ({
      id: lead.id,
      title: lead.title,
      source: lead.source.name,
      stage: lead.stage.name,
      owner: lead.assignments[0] ? `${lead.assignments[0].user.firstName} ${lead.assignments[0].user.lastName}` : null,
      createdAt: lead.createdAt.toISOString(),
    }));
  }

  /** CONVERTED_CLIENTS — Leads that converted to clients within the date range. `staffId` filters to conversions performed by that user. */
  async findConvertedClients(tenantId: string, filters: ReportFilters): Promise<ReportRow[]> {
    const conversions = await this.prisma.leadConversion.findMany({
      where: {
        tenantId,
        convertedAt: this.dateRange(filters),
        ...(filters.staffId ? { convertedById: filters.staffId } : {}),
      },
      include: {
        lead: { select: { title: true } },
        convertedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { convertedAt: 'desc' },
    });

    return conversions.map((conversion) => ({
      id: conversion.id,
      leadTitle: conversion.lead.title,
      convertedBy: `${conversion.convertedBy.firstName} ${conversion.convertedBy.lastName}`,
      convertedAt: conversion.convertedAt.toISOString(),
    }));
  }

  /**
   * PRD §13.2 report #2 — "Conversion ratio" scalar accompanying
   * `findConvertedClients()`'s rows (exposed via `ReportResultResponseDto.meta`,
   * never folded into `rows` since it isn't a row itself). Ratio is windowed
   * consistently: leads *created* in `[from, to]` vs conversions that
   * happened in that same window — not "ever converted", so the ratio always
   * reflects the same period the rest of the report is scoped to.
   */
  async getConvertedClientsSummary(
    tenantId: string,
    filters: ReportFilters,
  ): Promise<{ totalLeads: number; convertedLeads: number; conversionRatio: number }> {
    const dateRange = this.dateRange(filters);

    const [totalLeads, convertedLeads] = await Promise.all([
      this.prisma.lead.count({ where: { tenantId, deletedAt: null, createdAt: dateRange } }),
      this.prisma.leadConversion.count({
        where: { tenantId, convertedAt: dateRange, ...(filters.staffId ? { convertedById: filters.staffId } : {}) },
      }),
    ]);

    return { totalLeads, convertedLeads, conversionRatio: totalLeads === 0 ? 0 : convertedLeads / totalLeads };
  }

  /**
   * PENDING_TASKS — Open tasks (see `OPEN_TASK_STATUSES`) across all
   * projects. `from`/`to` filter by `dueDate`; `staffId` filters by assignee.
   * `groupBy: 'STAFF' | 'PRIORITY' | 'STATUS' | 'DUE_DATE'` returns
   * aggregated count rows instead (PRD §13.2 report #3).
   */
  async findPendingTasks(tenantId: string, filters: ReportFilters): Promise<ReportRow[]> {
    const tasks = await this.prisma.task.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: OPEN_TASK_STATUSES },
        dueDate: this.dateRange(filters),
        ...(filters.staffId ? { assigneeId: filters.staffId } : {}),
      },
      include: {
        assignee: { select: { firstName: true, lastName: true } },
        project: { select: { name: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    if (filters.groupBy === 'STAFF') {
      return ReportsRepository.aggregate(
        tasks,
        (task) => task.assigneeId ?? 'unassigned',
        (task) => (task.assignee ? `${task.assignee.firstName} ${task.assignee.lastName}` : 'Unassigned'),
      );
    }
    if (filters.groupBy === 'PRIORITY') {
      return ReportsRepository.aggregate(
        tasks,
        (task) => task.priority ?? 'NONE',
        (task) => task.priority ?? 'None',
      );
    }
    if (filters.groupBy === 'STATUS') {
      return ReportsRepository.aggregate(tasks, (task) => task.status, (task) => task.status);
    }
    if (filters.groupBy === 'DUE_DATE') {
      return ReportsRepository.aggregate(
        tasks,
        (task) => (task.dueDate ? task.dueDate.toISOString().slice(0, 10) : 'no-due-date'),
        (task) => (task.dueDate ? task.dueDate.toISOString().slice(0, 10) : 'No due date'),
      );
    }

    return tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      assignee: task.assignee ? `${task.assignee.firstName} ${task.assignee.lastName}` : null,
      project: task.project?.name ?? null,
      dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    }));
  }

  /**
   * PENDING_DOCUMENTS — `DocumentRequest` rows still `PENDING` (which is both
   * "Requested" and "Not Uploaded" in this data model — a request only ever
   * leaves `PENDING` by becoming `FULFILLED` or `CANCELLED`, so there is no
   * separate "not uploaded" sub-state to distinguish). `isOverdue` flags
   * `dueDate < now`. `staffId` filters by `requestedById`. `groupBy: 'BUSINESS'
   * | 'STAFF'` returns aggregated count rows instead (PRD §13.2 report #4).
   */
  async findPendingDocuments(tenantId: string, filters: ReportFilters): Promise<ReportRow[]> {
    const requests = await this.prisma.documentRequest.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: DocumentRequestStatus.PENDING,
        createdAt: this.dateRange(filters),
        ...(filters.staffId ? { requestedById: filters.staffId } : {}),
      },
      include: {
        business: { select: { name: true } },
        requestedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    if (filters.groupBy === 'BUSINESS') {
      return ReportsRepository.aggregate(requests, (r) => r.businessId, (r) => r.business.name);
    }
    if (filters.groupBy === 'STAFF') {
      return ReportsRepository.aggregate(
        requests,
        (r) => r.requestedById,
        (r) => `${r.requestedBy.firstName} ${r.requestedBy.lastName}`,
      );
    }

    const now = new Date();
    return requests.map((request) => ({
      id: request.id,
      businessName: request.business.name,
      category: request.category,
      status: request.status,
      requestedBy: `${request.requestedBy.firstName} ${request.requestedBy.lastName}`,
      dueDate: request.dueDate ? request.dueDate.toISOString() : null,
      isOverdue: !!request.dueDate && request.dueDate < now,
      createdAt: request.createdAt.toISOString(),
    }));
  }

  /**
   * PAYMENTS_PENDING — Payments with status PENDING. `from`/`to` filter by
   * `createdAt` (`paidDate` is null for pending payments by definition, so
   * it cannot be the range field). `staffId` has no effect — `Payment` has
   * no staff/user reference to filter by (known limitation, documented in
   * this module's final report rather than silently ignored).
   *
   * Also consumed by `ReportService.getDashboardPerformanceSummary()` — kept
   * exactly as before (Payment-only) so that widget's `pendingPaymentsCount`
   * never changes meaning. See `findPaymentsPendingReport()` for the fuller
   * PRD §13.2 version (Invoice-inclusive) used by the actual report.
   */
  async findPendingPayments(tenantId: string, filters: ReportFilters): Promise<ReportRow[]> {
    const payments = await this.prisma.payment.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: PaymentStatus.PENDING,
        createdAt: this.dateRange(filters),
      },
      orderBy: { createdAt: 'desc' },
    });

    return payments.map((payment) => ({
      id: payment.id,
      paymentNumber: payment.paymentNumber,
      invoiceId: payment.invoiceId,
      amount: payment.amount.toNumber(),
      method: payment.method,
      createdAt: payment.createdAt.toISOString(),
    }));
  }

  /**
   * PRD §13.2 report #5 — "Outstanding invoices / Overdue invoices / Amount
   * due", plus the still-pending `Payment` rows `findPendingPayments()`
   * already surfaces. `groupBy: 'BUSINESS'` sums invoice amount per Business
   * (a real column, `Invoice.businessId`). `groupBy: 'STAFF'` is a documented
   * **approximation**: neither `Invoice` nor `Payment` has a staff/user
   * column, so it's derived via each invoice's Business's assigned staff
   * (`BusinessAssignment`) — a Business with multiple assigned staff has its
   * invoice counted under each of them.
   */
  async findPaymentsPendingReport(tenantId: string, filters: ReportFilters): Promise<ReportRow[]> {
    const dateRange = this.dateRange(filters);

    const [payments, invoices] = await Promise.all([
      this.prisma.payment.findMany({
        where: { tenantId, deletedAt: null, status: PaymentStatus.PENDING, createdAt: dateRange },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.invoice.findMany({
        where: { tenantId, deletedAt: null, status: { in: OUTSTANDING_INVOICE_STATUSES }, createdAt: dateRange },
        include: { business: { select: { name: true } } },
        orderBy: { dueDate: 'asc' },
      }),
    ]);

    if (filters.groupBy === 'BUSINESS') {
      const withBusiness = invoices.filter((invoice): invoice is typeof invoice & { businessId: string } => !!invoice.businessId);
      return ReportsRepository.aggregate(
        withBusiness,
        (invoice) => invoice.businessId,
        (invoice) => invoice.business?.name ?? 'Unknown',
        (invoice) => invoice.amount.toNumber(),
      );
    }
    if (filters.groupBy === 'STAFF') {
      return this.groupInvoicesByAssignedStaff(tenantId, invoices);
    }

    const now = new Date();
    return [
      ...payments.map((payment) => ({
        id: payment.id,
        recordType: 'PAYMENT' as const,
        paymentNumber: payment.paymentNumber,
        invoiceId: payment.invoiceId,
        amount: payment.amount.toNumber(),
        method: payment.method,
        createdAt: payment.createdAt.toISOString(),
      })),
      ...invoices.map((invoice) => ({
        id: invoice.id,
        recordType: 'INVOICE' as const,
        invoiceNumber: invoice.invoiceNumber,
        businessName: invoice.business?.name ?? null,
        amount: invoice.amount.toNumber(),
        status: invoice.status,
        dueDate: invoice.dueDate ? invoice.dueDate.toISOString() : null,
        isOverdue: !!invoice.dueDate && invoice.dueDate < now,
        createdAt: invoice.createdAt.toISOString(),
      })),
    ];
  }

  /** See `findPaymentsPendingReport()`'s `groupBy: 'STAFF'` doc comment for the approximation this implements. */
  private async groupInvoicesByAssignedStaff(
    tenantId: string,
    invoices: Array<{ id: string; businessId: string | null; amount: Prisma.Decimal }>,
  ): Promise<ReportRow[]> {
    const businessIds = [...new Set(invoices.map((invoice) => invoice.businessId).filter((id): id is string => !!id))];
    if (businessIds.length === 0) return [];

    const assignments = await this.prisma.businessAssignment.findMany({
      where: { tenantId, businessId: { in: businessIds } },
      include: { user: { select: { firstName: true, lastName: true } } },
    });

    const assignmentsByBusiness = new Map<string, typeof assignments>();
    for (const assignment of assignments) {
      if (!assignmentsByBusiness.has(assignment.businessId)) assignmentsByBusiness.set(assignment.businessId, []);
      (assignmentsByBusiness.get(assignment.businessId) as typeof assignments).push(assignment);
    }

    const buckets = new Map<string, { label: string; count: number; amount: number }>();
    for (const invoice of invoices) {
      const staffForBusiness = invoice.businessId ? (assignmentsByBusiness.get(invoice.businessId) ?? []) : [];
      for (const assignment of staffForBusiness) {
        if (!buckets.has(assignment.userId)) {
          buckets.set(assignment.userId, { label: `${assignment.user.firstName} ${assignment.user.lastName}`, count: 0, amount: 0 });
        }
        const bucket = buckets.get(assignment.userId) as { label: string; count: number; amount: number };
        bucket.count += 1;
        bucket.amount += invoice.amount.toNumber();
      }
    }

    return Array.from(buckets.entries()).map(([groupKey, v]) => ({ groupKey, groupLabel: v.label, count: v.count, amount: v.amount }));
  }

  /**
   * DOCUMENT_ACTIVITY — Document uploads within the date range. Only
   * uploads are tracked (`Document` itself has no download/share log —
   * see `findDocumentActivityReport()` for the AuditLog-backed version that
   * does). `staffId` filters by uploader.
   *
   * Also consumed by `ReportService.getDashboardPerformanceSummary()` — kept
   * exactly as before (upload-count-only) so that widget's
   * `documentsUploadedCount` never changes meaning.
   */
  async findDocumentActivity(tenantId: string, filters: ReportFilters): Promise<ReportRow[]> {
    const documents = await this.prisma.document.findMany({
      where: {
        tenantId,
        deletedAt: null,
        createdAt: this.dateRange(filters),
        ...(filters.staffId ? { uploadedById: filters.staffId } : {}),
      },
      include: { uploadedBy: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return documents.map((document) => ({
      id: document.id,
      fileName: document.fileName,
      category: document.category,
      activityType: 'UPLOAD',
      uploadedBy: `${document.uploadedBy.firstName} ${document.uploadedBy.lastName}`,
      activityAt: document.createdAt.toISOString(),
    }));
  }

  /**
   * PRD §13.2 report #6 — "Reuse audit logs wherever possible": `AuditLog`
   * already records `UPLOAD`/`DOWNLOAD`/`SHARE`/`VERSION_CREATE` events for
   * every `Document` (written by `DocumentService`, `targetType: 'Document'`,
   * `targetId: document.id`) — this is that reuse. `AuditLog` has no
   * `businessId` column of its own, so Business grouping resolves each
   * event's `targetId` back to `Document.businessId` in a second batched
   * query. `staffId` filters by `actorId`.
   */
  async findDocumentActivityReport(tenantId: string, filters: ReportFilters): Promise<ReportRow[]> {
    const events = await this.prisma.auditLog.findMany({
      where: {
        tenantId,
        eventType: { in: DOCUMENT_ACTIVITY_EVENT_TYPES },
        targetType: DOCUMENT_TARGET_TYPE,
        createdAt: this.dateRange(filters),
        ...(filters.staffId ? { actorId: filters.staffId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    const documentIds = [...new Set(events.map((event) => event.targetId).filter((id): id is string => !!id))];
    const documents = documentIds.length
      ? await this.prisma.document.findMany({
          where: { id: { in: documentIds } },
          select: { id: true, fileName: true, businessId: true, business: { select: { name: true } } },
        })
      : [];
    const documentById = new Map(documents.map((document) => [document.id, document]));

    if (filters.groupBy === 'BUSINESS') {
      const withBusiness = events.filter((event) => event.targetId && documentById.get(event.targetId)?.businessId);
      return ReportsRepository.aggregate(
        withBusiness,
        (event) => documentById.get(event.targetId as string)?.businessId as string,
        (event) => documentById.get(event.targetId as string)?.business?.name ?? 'Unknown',
      );
    }
    if (filters.groupBy === 'STAFF') {
      return ReportsRepository.aggregate(events, (event) => event.actorId, (event) => event.actorName);
    }
    if (filters.groupBy === 'DATE') {
      return ReportsRepository.aggregate(
        events,
        (event) => event.createdAt.toISOString().slice(0, 10),
        (event) => event.createdAt.toISOString().slice(0, 10),
      );
    }

    return events.map((event) => {
      const document = event.targetId ? documentById.get(event.targetId) : undefined;
      return {
        id: event.id,
        activityType: event.eventType,
        fileName: document?.fileName ?? null,
        businessName: document?.business?.name ?? null,
        actorName: event.actorName,
        activityAt: event.createdAt.toISOString(),
      };
    });
  }

  /**
   * STAFF_ASSIGNMENT_SUMMARY — Per-staff workload: assigned clients (a
   * `BusinessAssignment` whose `Business` has converted to a `Client`),
   * assigned leads (`LeadAssignment`), assigned tasks + pending/completed
   * work breakdown (`Task`, unchanged from before — see the class header
   * comment on why this method's task-derived fields are also relied on by
   * the Dashboard's Performance widget). `staffId` narrows to a single
   * staff member's row across all three; `from`/`to` filter the Task portion
   * by `createdAt` only (Business/Lead assignment has no date range concept
   * of its own — "assigned" is a present-tense fact, not a dated event).
   */
  async findStaffAssignmentSummary(tenantId: string, filters: ReportFilters): Promise<ReportRow[]> {
    const [tasks, businessAssignments, leadAssignments] = await Promise.all([
      this.prisma.task.findMany({
        where: {
          tenantId,
          deletedAt: null,
          assigneeId: filters.staffId ?? { not: null },
          createdAt: this.dateRange(filters),
        },
        select: {
          assigneeId: true,
          status: true,
          assignee: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.businessAssignment.findMany({
        where: { tenantId, userId: filters.staffId, business: { client: { isNot: null } } },
        select: { userId: true, user: { select: { firstName: true, lastName: true } } },
      }),
      this.prisma.leadAssignment.findMany({
        where: { tenantId, userId: filters.staffId },
        select: { userId: true, user: { select: { firstName: true, lastName: true } } },
      }),
    ]);

    const byAssignee = new Map<string, StaffAssignmentEntry>();

    const ensureEntry = (userId: string, firstName: string, lastName: string): StaffAssignmentEntry => {
      if (!byAssignee.has(userId)) {
        byAssignee.set(userId, {
          staffName: `${firstName} ${lastName}`,
          assignedClients: 0,
          assignedLeads: 0,
          total: 0,
          todo: 0,
          inProgress: 0,
          review: 0,
          completed: 0,
          cancelled: 0,
          requested: 0,
          submitted: 0,
          underReview: 0,
          approved: 0,
          rejected: 0,
        });
      }
      return byAssignee.get(userId) as StaffAssignmentEntry;
    };

    for (const task of tasks) {
      if (!task.assigneeId || !task.assignee) continue;

      const entry = ensureEntry(task.assigneeId, task.assignee.firstName, task.assignee.lastName);
      entry.total += 1;
      if (task.status === TaskStatus.TODO) entry.todo += 1;
      else if (task.status === TaskStatus.IN_PROGRESS) entry.inProgress += 1;
      else if (task.status === TaskStatus.REVIEW) entry.review += 1;
      else if (task.status === TaskStatus.COMPLETED) entry.completed += 1;
      else if (task.status === TaskStatus.CANCELLED) entry.cancelled += 1;
      else if (task.status === TaskStatus.REQUESTED) entry.requested += 1;
      else if (task.status === TaskStatus.SUBMITTED) entry.submitted += 1;
      else if (task.status === TaskStatus.UNDER_REVIEW) entry.underReview += 1;
      else if (task.status === TaskStatus.APPROVED) entry.approved += 1;
      else if (task.status === TaskStatus.REJECTED) entry.rejected += 1;
    }

    for (const assignment of businessAssignments) {
      ensureEntry(assignment.userId, assignment.user.firstName, assignment.user.lastName).assignedClients += 1;
    }
    for (const assignment of leadAssignments) {
      ensureEntry(assignment.userId, assignment.user.firstName, assignment.user.lastName).assignedLeads += 1;
    }

    return Array.from(byAssignee.entries()).map(([staffId, v]) => ({
      staffId,
      staffName: v.staffName,
      assignedClients: v.assignedClients,
      assignedLeads: v.assignedLeads,
      assignedTasks: v.total,
      /** PRD §13.2 report #7 — "Pending work"/"Completed work" scalars, derived from the per-status breakdown below (never a second query). */
      pendingWork: v.todo + v.inProgress + v.review + v.requested + v.submitted + v.underReview + v.approved,
      completedWork: v.completed,
      totalTasks: v.total,
      todo: v.todo,
      inProgress: v.inProgress,
      review: v.review,
      completed: v.completed,
      cancelled: v.cancelled,
      requested: v.requested,
      submitted: v.submitted,
      underReview: v.underReview,
      approved: v.approved,
      rejected: v.rejected,
    }));
  }

  /**
   * MONTHLY_PENDING_WORK — Monthly rollup of everything still outstanding
   * that this backend can actually determine: open Tasks + outstanding
   * Invoices (PRD §13.2 report #8 literally says "Pending invoices", not
   * "pending payments" — reuses `OUTSTANDING_INVOICE_STATUSES`, the same
   * status list `findPaymentsPendingReport()` uses) + not-yet-filed
   * Compliance filings (`status != FILED`, see the original comment on why
   * not literally `status = PENDING`) + pending Document Requests
   * (`DocumentRequest.status = PENDING`). `staffId` narrows the Task and
   * Document Request portions only (Invoice/ComplianceFiling have no staff
   * reference).
   */
  async findMonthlyPendingWork(tenantId: string, filters: ReportFilters): Promise<ReportRow[]> {
    const dateRange = this.dateRange(filters);

    const [tasks, invoices, filings, documentRequests] = await Promise.all([
      this.prisma.task.findMany({
        where: {
          tenantId,
          deletedAt: null,
          status: { in: OPEN_TASK_STATUSES },
          createdAt: dateRange,
          ...(filters.staffId ? { assigneeId: filters.staffId } : {}),
        },
        select: { createdAt: true },
      }),
      this.prisma.invoice.findMany({
        where: { tenantId, deletedAt: null, status: { in: OUTSTANDING_INVOICE_STATUSES }, createdAt: dateRange },
        select: { createdAt: true },
      }),
      this.prisma.complianceFiling.findMany({
        where: { tenantId, deletedAt: null, status: { not: ComplianceFilingStatus.FILED }, createdAt: dateRange },
        select: { createdAt: true },
      }),
      this.prisma.documentRequest.findMany({
        where: {
          tenantId,
          deletedAt: null,
          status: DocumentRequestStatus.PENDING,
          createdAt: dateRange,
          ...(filters.staffId ? { requestedById: filters.staffId } : {}),
        },
        select: { createdAt: true },
      }),
    ]);

    const buckets = new Map<
      string,
      { pendingTasks: number; pendingInvoices: number; pendingFilings: number; pendingDocumentRequests: number }
    >();

    const bump = (date: Date, key: 'pendingTasks' | 'pendingInvoices' | 'pendingFilings' | 'pendingDocumentRequests') => {
      const month = date.toISOString().slice(0, 7);
      if (!buckets.has(month)) {
        buckets.set(month, { pendingTasks: 0, pendingInvoices: 0, pendingFilings: 0, pendingDocumentRequests: 0 });
      }
      (buckets.get(month) as NonNullable<ReturnType<typeof buckets.get>>)[key] += 1;
    };

    tasks.forEach((task) => bump(task.createdAt, 'pendingTasks'));
    invoices.forEach((invoice) => bump(invoice.createdAt, 'pendingInvoices'));
    filings.forEach((filing) => bump(filing.createdAt, 'pendingFilings'));
    documentRequests.forEach((request) => bump(request.createdAt, 'pendingDocumentRequests'));

    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, counts]) => ({
        month,
        pendingTasks: counts.pendingTasks,
        pendingInvoices: counts.pendingInvoices,
        pendingFilings: counts.pendingFilings,
        pendingDocumentRequests: counts.pendingDocumentRequests,
        totalOutstanding:
          counts.pendingTasks + counts.pendingInvoices + counts.pendingFilings + counts.pendingDocumentRequests,
      }));
  }
}
