import express, { Application } from 'express';
import { correlationIdMiddleware } from '@middlewares/correlation-id.middleware';
import { requestLoggerMiddleware } from '@middlewares/request-logger.middleware';
import { errorMiddleware } from '@middlewares/error.middleware';
import invoiceRoutes from '@modules/client-billing/routes/invoice.routes';
import expenseRoutes from '@modules/client-billing/routes/expense.routes';
import paymentRoutes from '@modules/client-billing/routes/payment.routes';
import paymentGatewaySettingsRoutes from '@modules/client-billing/routes/payment-gateway-settings.routes';
import paymentLinkRoutes from '@modules/client-billing/routes/payment-link.routes';
import paymentGatewayWebhookRoutes from '@modules/client-billing/routes/payment-gateway-webhook.routes';

/**
 * Builds a real Express app around the actual production middleware chain
 * and the real Client Billing routers — not a copy, the same modules the
 * app itself uses. Mounts all six (invoices/expenses/payments +
 * PRD §12's payment-gateway settings/links/webhook) so tests can exercise
 * Payment's cross-entity `invoiceId` reference and the gateway's own
 * invoice reference. Mirrors `tests/integration/helpers/contact-test-app.ts`.
 *
 * The `verify` callback mirrors `app.ts`'s own `express.json()` setup —
 * `payment-gateway-webhook.routes.spec.ts` needs `req.rawBody` populated
 * the same way production does, same reasoning as
 * `tests/integration/helpers/billing-test-app.ts`.
 */
export function createClientBillingTestApp(): Application {
  const app = express();
  app.use(correlationIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(express.json({ verify: (req, _res, buf) => { (req as express.Request).rawBody = buf; } }));
  app.use('/api/v1/billing/invoices', invoiceRoutes);
  app.use('/api/v1/billing/expenses', expenseRoutes);
  app.use('/api/v1/billing/payments', paymentRoutes);
  app.use('/api/v1/billing/payment-gateway/settings', paymentGatewaySettingsRoutes);
  app.use('/api/v1/billing/payment-gateway/webhook', paymentGatewayWebhookRoutes);
  app.use('/api/v1/billing/payment-links', paymentLinkRoutes);
  app.use(errorMiddleware);
  return app;
}
