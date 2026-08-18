import { Router } from 'express';
import { authMiddleware } from '@middlewares/auth.middleware';
import { tenantMiddleware } from '@middlewares/tenant.middleware';
import { requirePermission } from '@middlewares/permission.middleware';
import { validate } from '@middlewares/validation.middleware';
import { InvoiceController } from '../controller/invoice.controller';
import { CLIENT_BILLING_PERMISSIONS } from '../constants/client-billing.permissions';
import { createInvoiceSchema, updateInvoiceSchema, listInvoicesQuerySchema, invoiceIdParamSchema } from '../schemas/invoice.schema';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Invoice Routes
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Every route runs: authMiddleware → tenantMiddleware → requirePermission →
 * validate → controller. Gated on `CLIENT_BILLING_PERMISSIONS.READ`/`MANAGE`
 * — the frontend's registry defines only that one resource for all three
 * Client Billing sub-resources (Invoices/Expenses/Payments), not a granular
 * `invoice:*` permission. Mirrors `modules/contacts/routes/contact.routes.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     InvoiceStatus:
 *       type: string
 *       enum: [DRAFT, SENT, PAID, OVERDUE, VOID]
 *     Invoice:
 *       type: object
 *       description: An invoice issued to a client, as returned by the API — never the raw database row.
 *       properties:
 *         id: { type: string, format: uuid }
 *         invoiceNumber: { type: string }
 *         clientId: { type: string, format: uuid, nullable: true }
 *         businessId: { type: string, format: uuid, nullable: true }
 *         amount: { type: number }
 *         tax: { type: number }
 *         issuedDate: { type: string, format: date-time, nullable: true }
 *         dueDate: { type: string, format: date-time, nullable: true }
 *         status: { $ref: '#/components/schemas/InvoiceStatus' }
 *         notes: { type: string, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *       required: [id, invoiceNumber, amount, tax, status, createdAt, updatedAt]
 *     CreateInvoiceRequest:
 *       type: object
 *       required: [invoiceNumber, amount]
 *       properties:
 *         invoiceNumber: { type: string, minLength: 2, maxLength: 50 }
 *         clientId: { type: string, format: uuid }
 *         businessId: { type: string, format: uuid }
 *         amount: { type: number, minimum: 0 }
 *         tax: { type: number, minimum: 0 }
 *         dueDate: { type: string, format: date-time }
 *         notes: { type: string, maxLength: 2000 }
 *     UpdateInvoiceRequest:
 *       type: object
 *       description: Partial update.
 *       properties:
 *         invoiceNumber: { type: string, minLength: 2, maxLength: 50 }
 *         clientId: { type: string, format: uuid }
 *         businessId: { type: string, format: uuid }
 *         amount: { type: number, minimum: 0 }
 *         tax: { type: number, minimum: 0 }
 *         dueDate: { type: string, format: date-time }
 *         notes: { type: string, maxLength: 2000 }
 *   parameters:
 *     InvoiceIdParam:
 *       name: id
 *       in: path
 *       required: true
 *       schema: { type: string, format: uuid }
 *       description: Invoice ID.
 */

/**
 * @swagger
 * /billing/invoices:
 *   get:
 *     tags: [Client Billing]
 *     summary: List invoices
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
 *         description: Case-insensitive match against invoiceNumber.
 *         schema: { type: string, maxLength: 100 }
 *       - name: status
 *         in: query
 *         schema: { $ref: '#/components/schemas/InvoiceStatus' }
 *     responses:
 *       200: { description: Paginated list of invoices. }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks the `client_billing:read` permission. }
 *       422: { description: Invalid query parameters. }
 *   post:
 *     tags: [Client Billing]
 *     summary: Create an invoice
 *     description: Created with status DRAFT — there is no status-transition endpoint. Rejected with 404 if clientId/businessId is provided but does not exist in this tenant.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: client_billing:manage
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { $ref: '#/components/schemas/CreateInvoiceRequest' } } }
 *     responses:
 *       201: { description: Invoice created. }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks the `client_billing:manage` permission. }
 *       404: { description: clientId/businessId does not exist in this tenant. }
 *       409: { description: An invoice with this number already exists in this tenant. }
 *       422: { description: Validation failed. }
 */
router.get(
  '/',
  authMiddleware,
  tenantMiddleware,
  requirePermission(CLIENT_BILLING_PERMISSIONS.READ),
  validate({ query: listInvoicesQuerySchema }),
  InvoiceController.list,
);

router.post(
  '/',
  authMiddleware,
  tenantMiddleware,
  requirePermission(CLIENT_BILLING_PERMISSIONS.MANAGE),
  validate({ body: createInvoiceSchema }),
  InvoiceController.create,
);

/**
 * @swagger
 * /billing/invoices/{id}:
 *   get:
 *     tags: [Client Billing]
 *     summary: Get an invoice by ID
 *     security: [{ BearerAuth: [] }]
 *     x-permission: client_billing:read
 *     parameters: [{ $ref: '#/components/parameters/InvoiceIdParam' }]
 *     responses:
 *       200: { description: Invoice found. }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks the `client_billing:read` permission. }
 *       404: { description: No invoice with this ID exists in the tenant. }
 *       422: { description: id is not a valid UUID. }
 *   patch:
 *     tags: [Client Billing]
 *     summary: Update an invoice
 *     security: [{ BearerAuth: [] }]
 *     x-permission: client_billing:manage
 *     parameters: [{ $ref: '#/components/parameters/InvoiceIdParam' }]
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { $ref: '#/components/schemas/UpdateInvoiceRequest' } } }
 *     responses:
 *       200: { description: Invoice updated. }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks the `client_billing:manage` permission. }
 *       404: { description: No invoice with this ID exists in the tenant, or clientId/businessId does not exist. }
 *       422: { description: Validation failed. }
 *   delete:
 *     tags: [Client Billing]
 *     summary: Delete an invoice
 *     description: Soft-deletes the invoice.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: client_billing:manage
 *     parameters: [{ $ref: '#/components/parameters/InvoiceIdParam' }]
 *     responses:
 *       200: { description: Invoice deleted. }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks the `client_billing:manage` permission. }
 *       404: { description: No invoice with this ID exists in the tenant. }
 */
router.get(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(CLIENT_BILLING_PERMISSIONS.READ),
  validate({ params: invoiceIdParamSchema }),
  InvoiceController.getById,
);

router.patch(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(CLIENT_BILLING_PERMISSIONS.MANAGE),
  validate({ params: invoiceIdParamSchema, body: updateInvoiceSchema }),
  InvoiceController.update,
);

router.delete(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(CLIENT_BILLING_PERMISSIONS.MANAGE),
  validate({ params: invoiceIdParamSchema }),
  InvoiceController.delete,
);

export default router;
