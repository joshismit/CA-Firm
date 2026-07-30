import { Request } from 'express';
import { Expense, ExpenseStatus } from '@prisma/client';

jest.mock('@config/database', () => ({ prisma: {} }));

import { UserRole } from '@shared/enums';
import { NotFoundError } from '@shared/errors';
import { ExpenseService } from '@modules/client-billing/service/expense.service';
import { ExpenseRepository } from '@modules/client-billing/repository/expense.repository';
import { CreateExpenseDto, UpdateExpenseDto } from '@modules/client-billing/dto/expense.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ExpenseService — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 * Mirrors `tests/unit/modules/client-billing/invoice.service.spec.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';
const USER_ID = 'user-22222222-2222-2222-2222-222222222222';
const EXPENSE_ID = 'expense-33333333-3333-3333-3333-333333333333';

type MockedRepository = { [K in 'search' | 'findById' | 'create' | 'update' | 'delete']: jest.Mock };

function createMockRepository(): MockedRepository {
  return { search: jest.fn(), findById: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() };
}

function createFakeRequest(): Request {
  return {
    tenant: { id: TENANT_ID, slug: 'acme', name: 'Acme & Co', planCode: 'professional', isActive: true },
    user: { id: USER_ID, email: 'staff@acme.test', role: UserRole.TENANT_ADMIN, tenantId: TENANT_ID, permissions: [] },
    correlationId: 'test-correlation-id',
  } as unknown as Request;
}

function createMockExpense(overrides: Partial<Expense> = {}): Expense {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: EXPENSE_ID,
    tenantId: TENANT_ID,
    expenseNumber: 'EXP-001',
    category: 'RENT',
    vendor: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    amount: { toNumber: () => 500 } as any,
    date: null,
    paymentMethod: null,
    status: ExpenseStatus.DRAFT,
    notes: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

function createService(repository: MockedRepository): ExpenseService {
  return new ExpenseService(createFakeRequest(), repository as unknown as ExpenseRepository);
}

describe('ExpenseService', () => {
  describe('getExpenseById', () => {
    it('returns the expense when found', async () => {
      const repo = createMockRepository();
      const expense = createMockExpense();
      repo.findById.mockResolvedValue(expense);

      const service = createService(repo);
      const result = await service.getExpenseById(EXPENSE_ID);

      expect(repo.findById).toHaveBeenCalledWith(EXPENSE_ID, { tenantId: TENANT_ID });
      expect(result).toBe(expense);
    });

    it('throws NotFoundError when no expense matches', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(null);

      const service = createService(repo);

      await expect(service.getExpenseById('missing-id')).rejects.toThrow(NotFoundError);
    });
  });

  describe('listExpenses', () => {
    it('delegates to repository.search with category filter', async () => {
      const repo = createMockRepository();
      const paginated = { data: [createMockExpense()], meta: { page: 1, limit: 20, total: 1, totalPages: 1, hasNextPage: false, hasPrevPage: false } };
      repo.search.mockResolvedValue(paginated);

      const service = createService(repo);
      const result = await service.listExpenses({ page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc', search: 'EXP', status: ExpenseStatus.DRAFT, category: 'RENT' });

      expect(repo.search).toHaveBeenCalledWith(
        { search: 'EXP', status: ExpenseStatus.DRAFT, category: 'RENT' },
        { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' },
        { tenantId: TENANT_ID },
      );
      expect(result).toBe(paginated);
    });
  });

  describe('createExpense', () => {
    it('creates an expense, nulling omitted optional fields', async () => {
      const repo = createMockRepository();
      const created = createMockExpense();
      repo.create.mockResolvedValue(created);

      const service = createService(repo);
      const dto: CreateExpenseDto = { expenseNumber: 'EXP-001', category: 'RENT', amount: 500 };
      const result = await service.createExpense(dto);

      expect(repo.create).toHaveBeenCalledWith(
        { expenseNumber: 'EXP-001', category: 'RENT', vendor: null, amount: 500, date: null, paymentMethod: null, notes: null },
        { tenantId: TENANT_ID },
      );
      expect(result).toBe(created);
    });
  });

  describe('updateExpense', () => {
    it('throws NotFoundError when the expense does not exist', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(null);

      const service = createService(repo);
      const dto: UpdateExpenseDto = { notes: 'Updated' };

      await expect(service.updateExpense('missing-id', dto)).rejects.toThrow(NotFoundError);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('updates the expense when it exists', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockExpense());
      const updated = createMockExpense({ notes: 'Updated' });
      repo.update.mockResolvedValue(updated);

      const service = createService(repo);
      const result = await service.updateExpense(EXPENSE_ID, { notes: 'Updated' });

      expect(repo.update).toHaveBeenCalledWith(EXPENSE_ID, { notes: 'Updated' }, { tenantId: TENANT_ID });
      expect(result).toBe(updated);
    });
  });

  describe('deleteExpense', () => {
    it('throws NotFoundError when the expense does not exist', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(null);

      const service = createService(repo);

      await expect(service.deleteExpense('missing-id')).rejects.toThrow(NotFoundError);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('soft-deletes an existing expense', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockExpense());
      repo.delete.mockResolvedValue(true);

      const service = createService(repo);
      await service.deleteExpense(EXPENSE_ID);

      expect(repo.delete).toHaveBeenCalledWith(EXPENSE_ID, { tenantId: TENANT_ID });
    });
  });
});
