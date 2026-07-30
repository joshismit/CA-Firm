import { Router } from 'express';
import { authMiddleware } from '@middlewares/auth.middleware';
import { tenantMiddleware } from '@middlewares/tenant.middleware';
import { requirePermission } from '@middlewares/permission.middleware';
import { validate } from '@middlewares/validation.middleware';
import { PaymentController } from '../controller/payment.controller';
import { CLIENT_BILLING_PERMISSIONS } from '../constants/client-billing.permissions';
import { createPaymentSchema, updatePaymentSchema, listPaymentsQuerySchema, paymentIdParamSchema } from '../schemas/payment.schema';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Payment Routes
 * ─────────────────────────────────────────────────────────────────────────────
 * Every route runs: authMiddleware → tenantMiddleware → requirePermission →
 * validate → controller. Gated on `CLIENT_BILLING_PERMISSIONS.READ`/`MANAGE`
 * — see `routes/invoice.routes.ts`'s header comment for why. Mirrors
 * `modules/contacts/routes/contact.routes.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     PaymentStatus:
 *       type: string
 *       enum: [PENDING, COMPLETED, FAILED, REFUNDED]
 *     Payment:
 *       type: object
 *       description: A payment received from a client, as returned by the API — never the raw database row.
 *       properties:
 *         id: { type: string, format: uuid }
 *         paymentNumber: { type: string }
 *         invoiceId: { type: string, format: uuid, nullable: true }
 *         amount: { type: number }
 *         method: { type: string, nullable: true }
 *         reference: { type: string, nullable: true }
 *         paidDate: { type: string, format: date-time, nullable: true }
 *         status: { $ref: '#/components/schemas/PaymentStatus' }
 *         notes: { type: string, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *       required: [id, paymentNumber, amount, status, createdAt, updatedAt]
 *     CreatePaymentRequest:
 *       type: object
 *       required: [paymentNumber, amount]
 *       properties:
 *         paymentNumber: { type: string, minLength: 2, maxLength: 50 }
 *         invoiceId: { type: string, format: uuid }
 *         amount: { type: number, minimum: 0 }
 *         method: { type: string, maxLength: 50 }
 *         reference: { type: string, maxLength: 100 }
 *         paidDate: { type: string, format: date-time }
 *         notes: { type: string, maxLength: 2000 }
 *     UpdatePaymentRequest:
 *       type: object
 *       description: Partial update.
 *       properties:
 *         paymentNumber: { type: string, minLength: 2, maxLength: 50 }
 *         invoiceId: { type: string, format: uuid }
 *         amount: { type: number, minimum: 0 }
 *         method: { type: string, maxLength: 50 }
 *         reference: { type: string, maxLength: 100 }
 *         paidDate: { type: string, format: date-time }
 *         notes: { type: string, maxLength: 2000 }
 *   parameters:
 *     PaymentIdParam:
 *       name: id
 *       in: path
 *       required: true
 *       schema: { type: string, format: uuid }
 *       description: Payment ID.
 */

/**
 * @swagger
 * /billing/payments:
 *   get:
 *     tags: [Client Billing]
 *     summary: List payments
 *     security: [{ BearerAuth: [] }]
 *     x-permission: client_billing:read
 *     parameters:
 *       - name: page
 *         in: query
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *       - name: sortBy
 *         in: query
 *         schema: { type: string, default: createdAt }
 *       - name: sortOrder
 *         in: query
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *       - name: search
 *         in: query
 *         description: Case-insensitive match against paymentNumber or reference.
 *         schema: { type: string, maxLength: 100 }
 *       - name: status
 *         in: query
 *         schema: { $ref: '#/components/schemas/PaymentStatus' }
 *     responses:
 *       200: { description: Paginated list of payments. }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks the `client_billing:read` permission. }
 *       422: { description: Invalid query parameters. }
 *   post:
 *     tags: [Client Billing]
 *     summary: Record a payment
 *     description: Created with status PENDING — there is no status-transition endpoint. Rejected with 404 if invoiceId is provided but does not exist in this tenant.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: client_billing:manage
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { $ref: '#/components/schemas/CreatePaymentRequest' } } }
 *     responses:
 *       201: { description: Payment created. }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks the `client_billing:manage` permission. }
 *       404: { description: invoiceId does not exist in this tenant. }
 *       409: { description: A payment with this number already exists in this tenant. }
 *       422: { description: Validation failed. }
 */
router.get(
  '/',
  authMiddleware,
  tenantMiddleware,
  requirePermission(CLIENT_BILLING_PERMISSIONS.READ),
  validate({ query: listPaymentsQuerySchema }),
  PaymentController.list,
);

router.post(
  '/',
  authMiddleware,
  tenantMiddleware,
  requirePermission(CLIENT_BILLING_PERMISSIONS.MANAGE),
  validate({ body: createPaymentSchema }),
  PaymentController.create,
);

/**
 * @swagger
 * /billing/payments/{id}:
 *   get:
 *     tags: [Client Billing]
 *     summary: Get a payment by ID
 *     security: [{ BearerAuth: [] }]
 *     x-permission: client_billing:read
 *     parameters: [{ $ref: '#/components/parameters/PaymentIdParam' }]
 *     responses:
 *       200: { description: Payment found. }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks the `client_billing:read` permission. }
 *       404: { description: No payment with this ID exists in the tenant. }
 *       422: { description: id is not a valid UUID. }
 *   patch:
 *     tags: [Client Billing]
 *     summary: Update a payment
 *     security: [{ BearerAuth: [] }]
 *     x-permission: client_billing:manage
 *     parameters: [{ $ref: '#/components/parameters/PaymentIdParam' }]
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { $ref: '#/components/schemas/UpdatePaymentRequest' } } }
 *     responses:
 *       200: { description: Payment updated. }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks the `client_billing:manage` permission. }
 *       404: { description: No payment with this ID exists in the tenant, or invoiceId does not exist. }
 *       422: { description: Validation failed. }
 *   delete:
 *     tags: [Client Billing]
 *     summary: Delete a payment
 *     description: Soft-deletes the payment.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: client_billing:manage
 *     parameters: [{ $ref: '#/components/parameters/PaymentIdParam' }]
 *     responses:
 *       200: { description: Payment deleted. }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks the `client_billing:manage` permission. }
 *       404: { description: No payment with this ID exists in the tenant. }
 */
router.get(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(CLIENT_BILLING_PERMISSIONS.READ),
  validate({ params: paymentIdParamSchema }),
  PaymentController.getById,
);

router.patch(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(CLIENT_BILLING_PERMISSIONS.MANAGE),
  validate({ params: paymentIdParamSchema, body: updatePaymentSchema }),
  PaymentController.update,
);

router.delete(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(CLIENT_BILLING_PERMISSIONS.MANAGE),
  validate({ params: paymentIdParamSchema }),
  PaymentController.delete,
);

export default router;
