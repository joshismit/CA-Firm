import { PrismaClient, Prisma, Invoice, InvoiceStatus } from '@prisma/client';
import { BaseRepository, RepositoryOptions } from '@shared/base/base.repository';
import { PaginationQuery, PaginationMeta } from '@shared/types';

export interface InvoiceSearchFilters {
  /** Matches against invoiceNumber (case-insensitive). */
  search?: string;
  status?: InvoiceStatus;
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
  ): Promise<{ data: Invoice[]; meta: PaginationMeta }> {
    const where: Prisma.InvoiceWhereInput = {};

    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.search) {
      where.invoiceNumber = { contains: filters.search, mode: 'insensitive' };
    }

    return this.paginate(pagination, where, options);
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
