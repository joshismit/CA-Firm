// client-billing module — public exports
//
// Only the module's actual public surface is exported here: the three
// routers (for mounting), DTO types, and — as of PRD §10.5 — `InvoiceService`,
// so `DashboardAggregationService` (`modules/dashboard`) can compose the
// "Outstanding Payments"/"Payment Reminders"/Calendar widgets through it,
// exactly like `modules/tasks` already exports `TaskService` for the same
// kind of cross-module dashboard composition. `InvoiceRepository`/`ExpenseRepository`/
// `PaymentRepository`/controllers/mappers remain deliberately NOT exported —
// internal implementation details, go through the Service. Mirrors
// `modules/contacts/index.ts`.
//
// Named `client-billing` deliberately — NOT `billing` — to avoid any
// collision with the pre-existing, unrelated `billing` concern (SaaS
// subscription billing, tenant → ERP vendor). Never merge the two.

export { default as invoiceRoutes } from './routes/invoice.routes';
export { default as expenseRoutes } from './routes/expense.routes';
export { default as paymentRoutes } from './routes/payment.routes';
export { CLIENT_BILLING_PERMISSIONS } from './constants/client-billing.permissions';
export { InvoiceService } from './service/invoice.service';
export { BillingReminderService } from './service/billing-reminder.service';
export type { BillingReminderRunSummary } from './service/billing-reminder.service';
export type { InvoiceWithBusiness } from './service/invoice.service';
export type { InvoiceSearchFilters } from './repository/invoice.repository';
export type { InvoiceResponseDto } from './dto/invoice.res.dto';
export type { CreateInvoiceDto, UpdateInvoiceDto, ListInvoicesQueryDto } from './dto/invoice.req.dto';
export type { ExpenseResponseDto } from './dto/expense.res.dto';
export type { CreateExpenseDto, UpdateExpenseDto, ListExpensesQueryDto } from './dto/expense.req.dto';
export type { PaymentResponseDto } from './dto/payment.res.dto';
export type { CreatePaymentDto, UpdatePaymentDto, ListPaymentsQueryDto } from './dto/payment.req.dto';
