import { Router } from 'express';
import { authMiddleware } from '@middlewares/auth.middleware';
import { tenantMiddleware } from '@middlewares/tenant.middleware';
import { requirePermission } from '@middlewares/permission.middleware';
import { validate } from '@middlewares/validation.middleware';
import { ExpenseController } from '../controller/expense.controller';
import { CLIENT_BILLING_PERMISSIONS } from '../constants/client-billing.permissions';
import { createExpenseSchema, updateExpenseSchema, listExpensesQuerySchema, expenseIdParamSchema } from '../schemas/expense.schema';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Expense Routes
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
 *     ExpenseStatus:
 *       type: string
 *       enum: [DRAFT, PENDING, APPROVED, REJECTED, PAID]
 *     Expense:
 *       type: object
 *       description: An expense incurred by the firm, as returned by the API — never the raw database row.
 *       properties:
 *         id: { type: string, format: uuid }
 *         expenseNumber: { type: string }
 *         category: { type: string }
 *         vendor: { type: string, nullable: true }
 *         amount: { type: number }
 *         date: { type: string, format: date-time, nullable: true }
 *         paymentMethod: { type: string, nullable: true }
 *         status: { $ref: '#/components/schemas/ExpenseStatus' }
 *         notes: { type: string, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *       required: [id, expenseNumber, category, amount, status, createdAt, updatedAt]
 *     CreateExpenseRequest:
 *       type: object
 *       required: [expenseNumber, category, amount]
 *       properties:
 *         expenseNumber: { type: string, minLength: 2, maxLength: 50 }
 *         category: { type: string, minLength: 1, maxLength: 100 }
 *         vendor: { type: string, maxLength: 255 }
 *         amount: { type: number, minimum: 0 }
 *         date: { type: string, format: date-time }
 *         paymentMethod: { type: string, maxLength: 50 }
 *         notes: { type: string, maxLength: 2000 }
 *     UpdateExpenseRequest:
 *       type: object
 *       description: Partial update.
 *       properties:
 *         expenseNumber: { type: string, minLength: 2, maxLength: 50 }
 *         category: { type: string, minLength: 1, maxLength: 100 }
 *         vendor: { type: string, maxLength: 255 }
 *         amount: { type: number, minimum: 0 }
 *         date: { type: string, format: date-time }
 *         paymentMethod: { type: string, maxLength: 50 }
 *         notes: { type: string, maxLength: 2000 }
 *   parameters:
 *     ExpenseIdParam:
 *       name: id
 *       in: path
 *       required: true
 *       schema: { type: string, format: uuid }
 *       description: Expense ID.
 */

/**
 * @swagger
 * /billing/expenses:
 *   get:
 *     tags: [Client Billing]
 *     summary: List expenses
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
 *         description: Case-insensitive match against expenseNumber or vendor.
 *         schema: { type: string, maxLength: 100 }
 *       - name: status
 *         in: query
 *         schema: { $ref: '#/components/schemas/ExpenseStatus' }
 *       - name: category
 *         in: query
 *         schema: { type: string, maxLength: 100 }
 *     responses:
 *       200: { description: Paginated list of expenses. }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks the `client_billing:read` permission. }
 *       422: { description: Invalid query parameters. }
 *   post:
 *     tags: [Client Billing]
 *     summary: Create an expense
 *     description: Created with status DRAFT — there is no status-transition endpoint.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: client_billing:manage
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { $ref: '#/components/schemas/CreateExpenseRequest' } } }
 *     responses:
 *       201: { description: Expense created. }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks the `client_billing:manage` permission. }
 *       409: { description: An expense with this number already exists in this tenant. }
 *       422: { description: Validation failed. }
 */
router.get(
  '/',
  authMiddleware,
  tenantMiddleware,
  requirePermission(CLIENT_BILLING_PERMISSIONS.READ),
  validate({ query: listExpensesQuerySchema }),
  ExpenseController.list,
);

router.post(
  '/',
  authMiddleware,
  tenantMiddleware,
  requirePermission(CLIENT_BILLING_PERMISSIONS.MANAGE),
  validate({ body: createExpenseSchema }),
  ExpenseController.create,
);

/**
 * @swagger
 * /billing/expenses/{id}:
 *   get:
 *     tags: [Client Billing]
 *     summary: Get an expense by ID
 *     security: [{ BearerAuth: [] }]
 *     x-permission: client_billing:read
 *     parameters: [{ $ref: '#/components/parameters/ExpenseIdParam' }]
 *     responses:
 *       200: { description: Expense found. }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks the `client_billing:read` permission. }
 *       404: { description: No expense with this ID exists in the tenant. }
 *       422: { description: id is not a valid UUID. }
 *   patch:
 *     tags: [Client Billing]
 *     summary: Update an expense
 *     security: [{ BearerAuth: [] }]
 *     x-permission: client_billing:manage
 *     parameters: [{ $ref: '#/components/parameters/ExpenseIdParam' }]
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { $ref: '#/components/schemas/UpdateExpenseRequest' } } }
 *     responses:
 *       200: { description: Expense updated. }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks the `client_billing:manage` permission. }
 *       404: { description: No expense with this ID exists in the tenant. }
 *       422: { description: Validation failed. }
 *   delete:
 *     tags: [Client Billing]
 *     summary: Delete an expense
 *     description: Soft-deletes the expense.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: client_billing:manage
 *     parameters: [{ $ref: '#/components/parameters/ExpenseIdParam' }]
 *     responses:
 *       200: { description: Expense deleted. }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks the `client_billing:manage` permission. }
 *       404: { description: No expense with this ID exists in the tenant. }
 */
router.get(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(CLIENT_BILLING_PERMISSIONS.READ),
  validate({ params: expenseIdParamSchema }),
  ExpenseController.getById,
);

router.patch(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(CLIENT_BILLING_PERMISSIONS.MANAGE),
  validate({ params: expenseIdParamSchema, body: updateExpenseSchema }),
  ExpenseController.update,
);

router.delete(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(CLIENT_BILLING_PERMISSIONS.MANAGE),
  validate({ params: expenseIdParamSchema }),
  ExpenseController.delete,
);

export default router;
