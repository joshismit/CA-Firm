// client-billing module — public exports
//
// Only the module's actual public surface is exported here: the three
// routers (for mounting) and DTO types. Repositories/controllers/mappers
// are deliberately NOT exported — internal implementation details. Mirrors
// `modules/contacts/index.ts`.
//
// Named `client-billing` deliberately — NOT `billing` — to avoid any
// collision with the pre-existing, unrelated `billing` concern (SaaS
// subscription billing, tenant → ERP vendor). Never merge the two.

export { default as invoiceRoutes } from './routes/invoice.routes';
export { default as expenseRoutes } from './routes/expense.routes';
export { default as paymentRoutes } from './routes/payment.routes';
export { CLIENT_BILLING_PERMISSIONS } from './constants/client-billing.permissions';
export type { InvoiceResponseDto } from './dto/invoice.res.dto';
export type { CreateInvoiceDto, UpdateInvoiceDto, ListInvoicesQueryDto } from './dto/invoice.req.dto';
export type { ExpenseResponseDto } from './dto/expense.res.dto';
export type { CreateExpenseDto, UpdateExpenseDto, ListExpensesQueryDto } from './dto/expense.req.dto';
export type { PaymentResponseDto } from './dto/payment.res.dto';
export type { CreatePaymentDto, UpdatePaymentDto, ListPaymentsQueryDto } from './dto/payment.req.dto';
