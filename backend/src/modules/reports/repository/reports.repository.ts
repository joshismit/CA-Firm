import { PrismaClient, TaskStatus, PaymentStatus, ComplianceFilingStatus } from '@prisma/client';

export interface ReportFilters {
  from?: Date;
  to?: Date;
  staffId?: string;
}

type ReportRow = Record<string, unknown>;

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Reports Repository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Read-only projections over existing entities (`Lead`, `LeadConversion`,
 * `Task`, `Document`, `Payment`, `ComplianceFiling`) — reports have no
 * Prisma model of their own (per explicit product direction: "reports are
 * generated views over existing data", not a reporting database). Every
 * method is a plain, synchronous read: no caching, no OLAP, no background
 * jobs, no raw SQL.
 *
 * Deliberately NOT a `BaseRepository<TDelegate, TEntity>` subclass — that
 * base class assumes a single tenant-scoped entity with one delegate; this
 * repository spans six different, unrelated models, each with its own
 * scoping and shape (mirrors `modules/auth/repository/auth.repository.ts`'s
 * identical "bespoke repository when the shape doesn't fit BaseRepository"
 * precedent). Composes each source module's own Prisma model directly
 * rather than importing another module's repository/service — this is a
 * read-only cross-cutting concern, not a write operation that needs another
 * module's business rules; querying its own Prisma model directly is the
 * same pattern `RoleRepository.userExistsInTenant()` already established
 * for a single existence check, applied here to full read projections.
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

  /** NEW_LEADS — Leads created within the date range, with their source/stage names. `staffId` filters to leads assigned to that user via `LeadAssignment`. */
  async findNewLeads(tenantId: string, filters: ReportFilters): Promise<ReportRow[]> {
    const leads = await this.prisma.lead.findMany({
      where: {
        tenantId,
        deletedAt: null,
        createdAt: this.dateRange(filters),
        ...(filters.staffId ? { assignments: { some: { userId: filters.staffId } } } : {}),
      },
      include: { source: { select: { name: true } }, stage: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return leads.map((lead) => ({
      id: lead.id,
      title: lead.title,
      source: lead.source.name,
      stage: lead.stage.name,
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

  /** PENDING_TASKS — Open tasks (TODO/IN_PROGRESS/REVIEW) across all projects. `from`/`to` filter by `dueDate`; `staffId` filters by assignee. */
  async findPendingTasks(tenantId: string, filters: ReportFilters): Promise<ReportRow[]> {
    const tasks = await this.prisma.task.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.REVIEW] },
        dueDate: this.dateRange(filters),
        ...(filters.staffId ? { assigneeId: filters.staffId } : {}),
      },
      include: {
        assignee: { select: { firstName: true, lastName: true } },
        project: { select: { name: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    return tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      assignee: task.assignee ? `${task.assignee.firstName} ${task.assignee.lastName}` : null,
      project: task.project?.name ?? null,
      dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    }));
  }

  /**
   * PAYMENTS_PENDING — Payments with status PENDING. `from`/`to` filter by
   * `createdAt` (`paidDate` is null for pending payments by definition, so
   * it cannot be the range field). `staffId` has no effect — `Payment` has
   * no staff/user reference to filter by (known limitation, documented in
   * this module's final report rather than silently ignored).
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
   * DOCUMENT_ACTIVITY — Document uploads within the date range. Only
   * uploads are tracked (`Document` has no download/share log — see
   * Documents module's own "deliberately minimal" schema comment); every
   * row's `activityType` is therefore always `"UPLOAD"`, never fabricated
   * as a download/share event. `staffId` filters by uploader.
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
   * STAFF_ASSIGNMENT_SUMMARY — Task workload distribution per assignee,
   * scoped to Tasks (the clearest, already-available "workload" signal —
   * deliberately does not also fold in Project-manager or Business/Client
   * assignment counts, to avoid inventing a cross-entity workload metric
   * nothing in this codebase already defines). `staffId` narrows to a
   * single assignee's row; `from`/`to` filter by `Task.createdAt`.
   */
  async findStaffAssignmentSummary(tenantId: string, filters: ReportFilters): Promise<ReportRow[]> {
    const tasks = await this.prisma.task.findMany({
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
    });

    const byAssignee = new Map<
      string,
      { staffName: string; total: number; todo: number; inProgress: number; review: number; completed: number; cancelled: number }
    >();

    for (const task of tasks) {
      if (!task.assigneeId || !task.assignee) continue;

      if (!byAssignee.has(task.assigneeId)) {
        byAssignee.set(task.assigneeId, {
          staffName: `${task.assignee.firstName} ${task.assignee.lastName}`,
          total: 0,
          todo: 0,
          inProgress: 0,
          review: 0,
          completed: 0,
          cancelled: 0,
        });
      }

      const entry = byAssignee.get(task.assigneeId) as NonNullable<ReturnType<typeof byAssignee.get>>;
      entry.total += 1;
      if (task.status === TaskStatus.TODO) entry.todo += 1;
      else if (task.status === TaskStatus.IN_PROGRESS) entry.inProgress += 1;
      else if (task.status === TaskStatus.REVIEW) entry.review += 1;
      else if (task.status === TaskStatus.COMPLETED) entry.completed += 1;
      else if (task.status === TaskStatus.CANCELLED) entry.cancelled += 1;
    }

    return Array.from(byAssignee.entries()).map(([staffId, v]) => ({
      staffId,
      staffName: v.staffName,
      totalTasks: v.total,
      todo: v.todo,
      inProgress: v.inProgress,
      review: v.review,
      completed: v.completed,
      cancelled: v.cancelled,
    }));
  }

  /**
   * MONTHLY_PENDING_WORK — Monthly rollup of everything still outstanding
   * that this backend can actually determine: open Tasks + pending
   * Payments + not-yet-filed Compliance filings (`status != FILED`, not
   * literally `status = PENDING` — every filing created via the Compliance
   * module defaults to and stays `DRAFT` today, since that module has no
   * status-transition endpoint either; filtering strictly on `PENDING`
   * would silently return zero rows forever). Deliberately excludes
   * "pending documents" — no document review/signature status exists
   * anywhere in this schema (see `PENDING_DOCUMENTS`'s NOT_IMPLEMENTED
   * handling in the service) — a genuine data gap, not an oversight.
   * `staffId` narrows only the Task portion (Payment/ComplianceFiling have
   * no staff reference).
   */
  async findMonthlyPendingWork(tenantId: string, filters: ReportFilters): Promise<ReportRow[]> {
    const [tasks, payments, filings] = await Promise.all([
      this.prisma.task.findMany({
        where: {
          tenantId,
          deletedAt: null,
          status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.REVIEW] },
          createdAt: this.dateRange(filters),
          ...(filters.staffId ? { assigneeId: filters.staffId } : {}),
        },
        select: { createdAt: true },
      }),
      this.prisma.payment.findMany({
        where: { tenantId, deletedAt: null, status: PaymentStatus.PENDING, createdAt: this.dateRange(filters) },
        select: { createdAt: true },
      }),
      this.prisma.complianceFiling.findMany({
        where: {
          tenantId,
          deletedAt: null,
          status: { not: ComplianceFilingStatus.FILED },
          createdAt: this.dateRange(filters),
        },
        select: { createdAt: true },
      }),
    ]);

    const buckets = new Map<string, { pendingTasks: number; pendingPayments: number; pendingCompliance: number }>();

    const bump = (date: Date, key: 'pendingTasks' | 'pendingPayments' | 'pendingCompliance') => {
      const month = date.toISOString().slice(0, 7);
      if (!buckets.has(month)) {
        buckets.set(month, { pendingTasks: 0, pendingPayments: 0, pendingCompliance: 0 });
      }
      (buckets.get(month) as NonNullable<ReturnType<typeof buckets.get>>)[key] += 1;
    };

    tasks.forEach((task) => bump(task.createdAt, 'pendingTasks'));
    payments.forEach((payment) => bump(payment.createdAt, 'pendingPayments'));
    filings.forEach((filing) => bump(filing.createdAt, 'pendingCompliance'));

    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, counts]) => ({
        month,
        pendingTasks: counts.pendingTasks,
        pendingPayments: counts.pendingPayments,
        pendingCompliance: counts.pendingCompliance,
        totalOutstanding: counts.pendingTasks + counts.pendingPayments + counts.pendingCompliance,
      }));
  }
}
