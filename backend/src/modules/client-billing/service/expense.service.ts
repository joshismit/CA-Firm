import { Request } from 'express';
import { Expense } from '@prisma/client';
import { prisma } from '@config/database';
import { BaseService } from '@shared/base';
import { PaginationMeta } from '@shared/types';
import { ExpenseRepository } from '../repository/expense.repository';
import { CreateExpenseDto, UpdateExpenseDto, ListExpensesQueryDto } from '../dto/expense.req.dto';

/**
 * Business logic for `Expense`. No cross-entity references to validate
 * (`category`/`vendor`/`paymentMethod` are free-text, not FKs) — otherwise
 * mirrors `modules/client-billing/service/invoice.service.ts` exactly.
 * `status` is stored (defaults DRAFT) but not user-settable — same known
 * limitation as Invoice/Compliance.
 */
export class ExpenseService extends BaseService {
  constructor(
    req: Request,
    private readonly repository: ExpenseRepository = new ExpenseRepository(prisma),
  ) {
    super(req);
  }

  async listExpenses(query: ListExpensesQueryDto): Promise<{ data: Expense[]; meta: PaginationMeta }> {
    return this.repository.search(
      { search: query.search, status: query.status, category: query.category },
      { page: query.page, limit: query.limit, sortBy: query.sortBy, sortOrder: query.sortOrder },
      { tenantId: this.tenantId },
    );
  }

  async getExpenseById(id: string): Promise<Expense> {
    const expense = await this.repository.findById(id, { tenantId: this.tenantId });
    this.validateExists(expense, 'Expense');
    return expense;
  }

  async createExpense(dto: CreateExpenseDto): Promise<Expense> {
    this.logger.info({ expenseNumber: dto.expenseNumber }, 'Creating expense');

    return this.repository.create(
      {
        expenseNumber: dto.expenseNumber,
        category: dto.category,
        vendor: dto.vendor ?? null,
        amount: dto.amount,
        date: dto.date ?? null,
        paymentMethod: dto.paymentMethod ?? null,
        notes: dto.notes ?? null,
      },
      { tenantId: this.tenantId },
    );
  }

  async updateExpense(id: string, dto: UpdateExpenseDto): Promise<Expense> {
    await this.getExpenseById(id);

    this.logger.info({ expenseId: id }, 'Updating expense');

    return this.repository.update(id, dto, { tenantId: this.tenantId });
  }

  async deleteExpense(id: string): Promise<void> {
    await this.getExpenseById(id);

    this.logger.info({ expenseId: id }, 'Deleting expense');

    await this.repository.delete(id, { tenantId: this.tenantId });
  }
}
