import { PrismaClient, Prisma, Expense, ExpenseStatus } from '@prisma/client';
import { BaseRepository, RepositoryOptions } from '@shared/base/base.repository';
import { PaginationQuery, PaginationMeta } from '@shared/types';

export interface ExpenseSearchFilters {
  /** Matches against expenseNumber or vendor (case-insensitive). */
  search?: string;
  status?: ExpenseStatus;
  category?: string;
}

/**
 * Data access for `Expense`. Inherits tenant scoping and standard
 * CRUD/pagination from `BaseRepository`, but overrides `delete()` — same
 * "no `deletedBy` column" situation as `InvoiceRepository`.
 */
export class ExpenseRepository extends BaseRepository<Prisma.ExpenseDelegate, Expense> {
  constructor(prisma: PrismaClient) {
    super(prisma.expense, prisma);
  }

  async search(
    filters: ExpenseSearchFilters,
    pagination: PaginationQuery,
    options: RepositoryOptions = {},
  ): Promise<{ data: Expense[]; meta: PaginationMeta }> {
    const where: Prisma.ExpenseWhereInput = {};

    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.category) {
      where.category = filters.category;
    }
    if (filters.search) {
      where.OR = [
        { expenseNumber: { contains: filters.search, mode: 'insensitive' } },
        { vendor: { contains: filters.search, mode: 'insensitive' } },
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
