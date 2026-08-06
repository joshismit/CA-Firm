import { PrismaClient, Prisma, Invoice, InvoiceStatus } from '@prisma/client';
import { BaseRepository, RepositoryOptions } from '@shared/base/base.repository';
import { PaginationQuery, PaginationMeta } from '@shared/types';

export interface InvoiceSearchFilters {
  /** Matches against invoiceNumber (case-insensitive). */
  search?: string;
  status?: InvoiceStatus;
  /** PRD §10.5 — dashboard "Outstanding Payments"/"Payment Reminders" widgets. Takes precedence over `status` when both are given. */
  statusIn?: InvoiceStatus[];
  /** PRD §10.11 — scopes results to the caller's assigned Businesses (staff who aren't tenant-wide unrestricted). */
  businessIdIn?: string[];
  dueBefore?: Date;
  dueAfter?: Date;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Invoice Repository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Data access for `Invoice`. Inherits tenant scoping and standard
 * CRUD/pagination from `BaseRepository`, but overrides `delete()` —
 * `Invoice` has `deletedAt` but no `deletedBy` column (same situation as
 * `ContactRepository`/`RoleRepository`/`ComplianceFilingRepository`).
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class InvoiceRepository extends BaseRepository<Prisma.InvoiceDelegate, Invoice> {
  constructor(prisma: PrismaClient) {
    super(prisma.invoice, prisma);
  }

  async search(
    filters: InvoiceSearchFilters,
    pagination: PaginationQuery,
    options: RepositoryOptions = {},
    include?: Prisma.InvoiceInclude,
  ): Promise<{ data: Invoice[]; meta: PaginationMeta }> {
    const where: Prisma.InvoiceWhereInput = this.buildWhere(filters);

    return this.paginate(pagination, where, options, include);
  }

  private buildWhere(filters: InvoiceSearchFilters): Prisma.InvoiceWhereInput {
    const where: Prisma.InvoiceWhereInput = {};

    if (filters.statusIn) where.status = { in: filters.statusIn };
    else if (filters.status) where.status = filters.status;

    if (filters.search) {
      where.invoiceNumber = { contains: filters.search, mode: 'insensitive' };
    }
    if (filters.businessIdIn) {
      where.businessId = { in: filters.businessIdIn };
    }
    if (filters.dueBefore || filters.dueAfter) {
      where.dueDate = {
        ...(filters.dueBefore && { lte: filters.dueBefore }),
        ...(filters.dueAfter && { gte: filters.dueAfter }),
      };
    }

    return where;
  }

  /**
   * PRD §10.7/§10.5 — "Outstanding Payments"/Performance's revenue rollups. Bespoke
   * `aggregate()` call (same precedent as this file's overridden `delete()` above) —
   * `BaseRepository` has no sum/aggregate helper.
   *
   * Known limitation (see `DashboardAggregationService`'s header comment): no write
   * path in this codebase currently ever sets `InvoiceStatus.OVERDUE`, so this will
   * only ever reflect whatever statuses are actually reachable today (DRAFT/SENT/PAID).
   */
  async sumAmountByStatus(
    filters: { statusIn: InvoiceStatus[]; businessIdIn?: string[] },
    options: RepositoryOptions = {},
  ): Promise<{ count: number; totalAmount: number }> {
    const where = this.applyFilters(this.buildWhere(filters), options);
    const client = this.getClient(options.tx);
    const result = await client.aggregate({ where, _count: { _all: true }, _sum: { amount: true } });
    return { count: result._count._all, totalAmount: Number(result._sum.amount ?? 0) };
  }

  /** Existence check scoped to this tenant — used to reject a `clientId` that belongs to another tenant (the FK alone would not catch it: the Client row exists, just elsewhere). */
  async clientExistsInTenant(clientId: string, tenantId: string): Promise<boolean> {
    const client = await this.prisma.client.findFirst({ where: { id: clientId, tenantId, deletedAt: null }, select: { id: true } });
    return !!client;
  }

  /** Same cross-tenant existence guard as `clientExistsInTenant`, for `businessId`. */
  async businessExistsInTenant(businessId: string, tenantId: string): Promise<boolean> {
    const business = await this.prisma.business.findFirst({ where: { id: businessId, tenantId, deletedAt: null }, select: { id: true } });
    return !!business;
  }

  /**
   * PRD §11.12 — candidates for `BillingReminderService`'s payment reminder scan. Excludes
   * `DRAFT` (never sent to the client, nothing to remind about yet) and the two terminal
   * statuses (`PAID`/`VOID`), and requires a non-null `businessId` — a reminder needs
   * `BusinessAssignmentRepository.findByBusiness()` to resolve a recipient, so an invoice with
   * no business link is simply not a reminder candidate at all.
   */
  async findReminderCandidates(dueDateRange: { gte?: Date; lt?: Date }, options: RepositoryOptions = {}): Promise<Invoice[]> {
    return this.findMany(
      {
        dueDate: dueDateRange,
        status: { notIn: [InvoiceStatus.DRAFT, InvoiceStatus.PAID, InvoiceStatus.VOID] },
        businessId: { not: null },
      },
      options,
    );
  }

  /**
   * `Invoice` has no `deletedBy` column — BaseRepository.delete()
   * unconditionally includes `deletedBy` in its update payload, which
   * Prisma rejects as an unknown field for this model. Overridden here with
   * identical soft-delete semantics minus that field.
   */
  async delete(id: string, options: RepositoryOptions = {}): Promise<boolean> {
    const where = this.applyFilters({ id }, options);
    const client = this.getClient(options.tx);
    const result = (await client.updateMany({ where, data: { deletedAt: new Date() } })) as { count: number };
    return result.count > 0;
  }
}
