import { PrismaClient, Prisma, Payment, PaymentStatus } from '@prisma/client';
import { BaseRepository, RepositoryOptions } from '@shared/base/base.repository';
import { PaginationQuery, PaginationMeta } from '@shared/types';

export interface PaymentSearchFilters {
  /** Matches against paymentNumber or reference (case-insensitive). */
  search?: string;
  status?: PaymentStatus;
}

/**
 * Data access for `Payment`. Inherits tenant scoping and standard
 * CRUD/pagination from `BaseRepository`, but overrides `delete()` — same
 * "no `deletedBy` column" situation as `InvoiceRepository`.
 */
export class PaymentRepository extends BaseRepository<Prisma.PaymentDelegate, Payment> {
  constructor(prisma: PrismaClient) {
    super(prisma.payment, prisma);
  }

  async search(
    filters: PaymentSearchFilters,
    pagination: PaginationQuery,
    options: RepositoryOptions = {},
  ): Promise<{ data: Payment[]; meta: PaginationMeta }> {
    const where: Prisma.PaymentWhereInput = {};

    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.search) {
      where.OR = [
        { paymentNumber: { contains: filters.search, mode: 'insensitive' } },
        { reference: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.paginate(pagination, where, options);
  }

  async delete(id: string, options: RepositoryOptions = {}): Promise<boolean> {
    const where = this.applyFilters({ id }, options);
    const client = this.getClient(options.tx);
    const result = (await client.updateMany({ where, data: { deletedAt: new Date() } })) as { count: number };
    return result.count > 0;
  }
}
