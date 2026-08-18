import { InvoiceStatus, ExpenseStatus, PaymentStatus } from '@prisma/client';
import { createInvoiceSchema, updateInvoiceSchema, invoiceIdParamSchema, listInvoicesQuerySchema } from '@modules/client-billing/schemas/invoice.schema';
import { createExpenseSchema, updateExpenseSchema, expenseIdParamSchema, listExpensesQuerySchema } from '@modules/client-billing/schemas/expense.schema';
import { createPaymentSchema, updatePaymentSchema, paymentIdParamSchema, listPaymentsQuerySchema } from '@modules/client-billing/schemas/payment.schema';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Client Billing Zod Schemas — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 * Exercises the schemas directly (`.safeParse()`), independent of Express/
 * `validate()` middleware. Mirrors `tests/unit/modules/roles/role.schema.spec.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const VALID_UUID_1 = '11111111-1111-4111-8111-111111111111';

describe('createInvoiceSchema', () => {
  it('accepts the minimal valid payload (invoiceNumber + amount only)', () => {
    expect(createInvoiceSchema.safeParse({ invoiceNumber: 'INV-001', amount: 1000 }).success).toBe(true);
  });

  it('accepts a fully-populated valid payload', () => {
    const result = createInvoiceSchema.safeParse({
      invoiceNumber: 'INV-001',
      clientId: VALID_UUID_1,
      businessId: VALID_UUID_1,
      amount: 1000,
      tax: 180,
      dueDate: '2026-04-20',
      notes: 'Q1 services',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a missing invoiceNumber', () => {
    expect(createInvoiceSchema.safeParse({ amount: 1000 }).success).toBe(false);
  });

  it('rejects an invoiceNumber shorter than 2 characters', () => {
    expect(createInvoiceSchema.safeParse({ invoiceNumber: 'A', amount: 1000 }).success).toBe(false);
  });

  it('rejects a negative amount', () => {
    expect(createInvoiceSchema.safeParse({ invoiceNumber: 'INV-001', amount: -1 }).success).toBe(false);
  });

  it('accepts an amount of exactly 0', () => {
    expect(createInvoiceSchema.safeParse({ invoiceNumber: 'INV-001', amount: 0 }).success).toBe(true);
  });

  it('rejects a negative tax', () => {
    expect(createInvoiceSchema.safeParse({ invoiceNumber: 'INV-001', amount: 1000, tax: -1 }).success).toBe(false);
  });

  it('rejects an invalid clientId', () => {
    expect(createInvoiceSchema.safeParse({ invoiceNumber: 'INV-001', amount: 1000, clientId: 'not-a-uuid' }).success).toBe(false);
  });
});

describe('updateInvoiceSchema', () => {
  it('accepts an empty object', () => {
    expect(updateInvoiceSchema.safeParse({}).success).toBe(true);
  });

  it('has no status field settable', () => {
    const result = updateInvoiceSchema.safeParse({ status: InvoiceStatus.PAID });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).not.toHaveProperty('status');
  });
});

describe('invoiceIdParamSchema / listInvoicesQuerySchema', () => {
  it('accepts a valid UUID param', () => {
    expect(invoiceIdParamSchema.safeParse({ id: VALID_UUID_1 }).success).toBe(true);
  });

  it('rejects a non-UUID param', () => {
    expect(invoiceIdParamSchema.safeParse({ id: 'not-a-uuid' }).success).toBe(false);
  });

  it('applies pagination defaults', () => {
    const result = listInvoicesQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toMatchObject({ page: 1, limit: 20 });
  });

  it.each(Object.values(InvoiceStatus))('accepts every valid status filter (%s)', (status) => {
    expect(listInvoicesQuerySchema.safeParse({ status }).success).toBe(true);
  });

  it('rejects an invalid status filter', () => {
    expect(listInvoicesQuerySchema.safeParse({ status: 'NOT_A_STATUS' }).success).toBe(false);
  });
});

describe('createExpenseSchema', () => {
  it('accepts the minimal valid payload', () => {
    expect(createExpenseSchema.safeParse({ expenseNumber: 'EXP-001', category: 'RENT', amount: 500 }).success).toBe(true);
  });

  it('rejects a missing category', () => {
    expect(createExpenseSchema.safeParse({ expenseNumber: 'EXP-001', amount: 500 }).success).toBe(false);
  });

  it('rejects an empty category', () => {
    expect(createExpenseSchema.safeParse({ expenseNumber: 'EXP-001', category: '', amount: 500 }).success).toBe(false);
  });

  it('rejects a negative amount', () => {
    expect(createExpenseSchema.safeParse({ expenseNumber: 'EXP-001', category: 'RENT', amount: -1 }).success).toBe(false);
  });

  it('accepts a free-text category not in EXPENSE_CATEGORY_OPTIONS (no server-side enum)', () => {
    expect(createExpenseSchema.safeParse({ expenseNumber: 'EXP-001', category: 'ANYTHING', amount: 500 }).success).toBe(true);
  });
});

describe('updateExpenseSchema / expenseIdParamSchema / listExpensesQuerySchema', () => {
  it('accepts an empty object for update', () => {
    expect(updateExpenseSchema.safeParse({}).success).toBe(true);
  });

  it('rejects a non-UUID id param', () => {
    expect(expenseIdParamSchema.safeParse({ id: 'not-a-uuid' }).success).toBe(false);
  });

  it.each(Object.values(ExpenseStatus))('accepts every valid status filter (%s)', (status) => {
    expect(listExpensesQuerySchema.safeParse({ status }).success).toBe(true);
  });

  it('accepts a category filter', () => {
    expect(listExpensesQuerySchema.safeParse({ category: 'RENT' }).success).toBe(true);
  });
});

describe('createPaymentSchema', () => {
  it('accepts the minimal valid payload', () => {
    expect(createPaymentSchema.safeParse({ paymentNumber: 'PAY-001', amount: 1000 }).success).toBe(true);
  });

  it('rejects a missing paymentNumber', () => {
    expect(createPaymentSchema.safeParse({ amount: 1000 }).success).toBe(false);
  });

  it('rejects a negative amount', () => {
    expect(createPaymentSchema.safeParse({ paymentNumber: 'PAY-001', amount: -1 }).success).toBe(false);
  });

  it('rejects an invalid invoiceId', () => {
    expect(createPaymentSchema.safeParse({ paymentNumber: 'PAY-001', amount: 1000, invoiceId: 'not-a-uuid' }).success).toBe(false);
  });
});

describe('updatePaymentSchema / paymentIdParamSchema / listPaymentsQuerySchema', () => {
  it('accepts an empty object for update', () => {
    expect(updatePaymentSchema.safeParse({}).success).toBe(true);
  });

  it('rejects a non-UUID id param', () => {
    expect(paymentIdParamSchema.safeParse({ id: 'not-a-uuid' }).success).toBe(false);
  });

  it.each(Object.values(PaymentStatus))('accepts every valid status filter (%s)', (status) => {
    expect(listPaymentsQuerySchema.safeParse({ status }).success).toBe(true);
  });
});
