import express, { Application } from 'express';
import { correlationIdMiddleware } from '@middlewares/correlation-id.middleware';
import { requestLoggerMiddleware } from '@middlewares/request-logger.middleware';
import { errorMiddleware } from '@middlewares/error.middleware';
import invoiceRoutes from '@modules/client-billing/routes/invoice.routes';
import expenseRoutes from '@modules/client-billing/routes/expense.routes';
import paymentRoutes from '@modules/client-billing/routes/payment.routes';

/**
 * Builds a real Express app around the actual production middleware chain
 * and the real Client Billing routers — not a copy, the same modules the
 * app itself uses. Mounts all three (invoices/expenses/payments) so tests
 * can exercise Payment's cross-entity `invoiceId` reference. Mirrors
 * `tests/integration/helpers/contact-test-app.ts`.
 */
export function createClientBillingTestApp(): Application {
  const app = express();
  app.use(correlationIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(express.json());
  app.use('/api/v1/billing/invoices', invoiceRoutes);
  app.use('/api/v1/billing/expenses', expenseRoutes);
  app.use('/api/v1/billing/payments', paymentRoutes);
  app.use(errorMiddleware);
  return app;
}
