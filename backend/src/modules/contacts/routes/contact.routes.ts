import { Router } from 'express';
import { authMiddleware } from '@middlewares/auth.middleware';
import { tenantMiddleware } from '@middlewares/tenant.middleware';
import { requirePermission } from '@middlewares/permission.middleware';
import { validate } from '@middlewares/validation.middleware';
import { ContactController } from '../controller/contact.controller';
import { CONTACT_PERMISSIONS } from '../constants/contact.permissions';
import {
  createContactSchema,
  updateContactSchema,
  listContactsQuerySchema,
  contactIdParamSchema,
  assignContactRoleSchema,
} from '../schemas/contact.schema';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Contact Routes
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Every route runs: authMiddleware → tenantMiddleware → requirePermission →
 * validate → controller. Mirrors `modules/business/routes/business.routes.ts`.
 *
 * `/roles` is a static-segment route and must precede `/:id` — Express
 * matches routes in registration order, and `/:id` would otherwise swallow
 * it. Role assignment is gated on `CONTACTS_UPDATE` (it mutates an existing
 * contact's business relationships, not a new-contact creation) rather than
 * a dedicated permission — there is no separate "contact roles" resource in
 * the permission registry.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     ContactRoleType:
 *       type: string
 *       enum: [OWNER, DIRECTOR, PARTNER, AUTHORIZED_SIGNATORY, ACCOUNTANT, AUDITOR, EMPLOYEE, CLIENT_REPRESENTATIVE, EMERGENCY_CONTACT, DECISION_MAKER, OTHER]
 *     Contact:
 *       type: object
 *       description: A contact (person) response as returned by the API — never the raw database row.
 *       properties:
 *         id: { type: string, format: uuid }
 *         firstName: { type: string, example: Rohan }
 *         lastName: { type: string, nullable: true, example: Mehta }
 *         email: { type: string, nullable: true }
 *         phone: { type: string, nullable: true }
 *         pan: { type: string, nullable: true, example: ABCDE1234F }
 *         portalUserId: { type: string, format: uuid, nullable: true, description: Set once this contact has portal login access. }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *       required: [id, firstName, createdAt, updatedAt]
 *     ContactRole:
 *       type: object
 *       description: Links a Contact to a Business with a role (a contact may hold roles at multiple businesses).
 *       properties:
 *         id: { type: string, format: uuid }
 *         businessId: { type: string, format: uuid }
 *         contactId: { type: string, format: uuid }
 *         roleType: { $ref: '#/components/schemas/ContactRoleType' }
 *         customTitle: { type: string, nullable: true }
 *         isPrimary: { type: boolean, description: At most one primary role per business — assigning a new primary clears the previous one. }
 *         sharePercent: { type: number, nullable: true, minimum: 0, maximum: 100 }
 *       required: [id, businessId, contactId, roleType, isPrimary]
 *     CreateContactRequest:
 *       type: object
 *       required: [firstName]
 *       properties:
 *         firstName: { type: string, minLength: 1, maxLength: 100 }
 *         lastName: { type: string, maxLength: 100 }
 *         email: { type: string, format: email }
 *         phone: { type: string, maxLength: 30 }
 *         pan: { type: string, pattern: '^[A-Za-z]{5}[0-9]{4}[A-Za-z]$' }
 *     UpdateContactRequest:
 *       type: object
 *       description: Partial update.
 *       properties:
 *         firstName: { type: string, minLength: 1, maxLength: 100 }
 *         lastName: { type: string, maxLength: 100, nullable: true }
 *         email: { type: string, format: email, nullable: true }
 *         phone: { type: string, maxLength: 30, nullable: true }
 *         pan: { type: string, nullable: true }
 *     AssignContactRoleRequest:
 *       type: object
 *       required: [businessId, contactId, roleType]
 *       properties:
 *         businessId: { type: string, format: uuid }
 *         contactId: { type: string, format: uuid }
 *         roleType: { $ref: '#/components/schemas/ContactRoleType' }
 *         customTitle: { type: string, maxLength: 100 }
 *         isPrimary: { type: boolean }
 *         sharePercent: { type: number, minimum: 0, maximum: 100 }
 *     ContactEnvelope:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: Success }
 *         data: { $ref: '#/components/schemas/Contact' }
 *         timestamp: { type: string, format: date-time }
 *         correlationId: { type: string, format: uuid }
 *         durationMs: { type: number }
 *     ContactListEnvelope:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: Fetched successfully }
 *         data: { type: array, items: { $ref: '#/components/schemas/Contact' } }
 *         meta: { $ref: '#/components/schemas/PaginationMeta' }
 *         timestamp: { type: string, format: date-time }
 *         correlationId: { type: string, format: uuid }
 *     ContactRoleEnvelope:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: Created successfully }
 *         data: { $ref: '#/components/schemas/ContactRole' }
 *         timestamp: { type: string, format: date-time }
 *         correlationId: { type: string, format: uuid }
 *     ContactRoleListEnvelope:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: Fetched successfully }
 *         data: { type: array, items: { $ref: '#/components/schemas/ContactRole' } }
 *         timestamp: { type: string, format: date-time }
 *         correlationId: { type: string, format: uuid }
 *   parameters:
 *     ContactIdParam:
 *       name: id
 *       in: path
 *       required: true
 *       schema: { type: string, format: uuid }
 *       description: Contact ID.
 */

// ─── Static-segment routes (must precede /:id) ───────────────────────────────

/**
 * @swagger
 * /contacts:
 *   post:
 *     tags: [Contacts]
 *     summary: Create a contact
 *     security: [{ BearerAuth: [] }]
 *     x-permission: contacts:create
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { $ref: '#/components/schemas/CreateContactRequest' } } }
 *     responses:
 *       201: { description: Contact created., content: { application/json: { schema: { $ref: '#/components/schemas/ContactEnvelope' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `contacts:create` permission., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: Validation failed (e.g. invalid PAN format)., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.post(
  '/',
  authMiddleware,
  tenantMiddleware,
  requirePermission(CONTACT_PERMISSIONS.CREATE),
  validate({ body: createContactSchema }),
  ContactController.create,
);

/**
 * @swagger
 * /contacts:
 *   get:
 *     tags: [Contacts]
 *     summary: List contacts
 *     description: Paginated, filterable, searchable list of contacts scoped to the current tenant.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: contacts:read
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
 *         description: Case-insensitive match against first name, last name, email, or phone.
 *         schema: { type: string, maxLength: 100 }
 *       - name: businessId
 *         in: query
 *         description: Restricts to contacts with at least one role at this business.
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Paginated list of contacts., content: { application/json: { schema: { $ref: '#/components/schemas/ContactListEnvelope' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `contacts:read` permission., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: Invalid query parameters., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.get(
  '/',
  authMiddleware,
  tenantMiddleware,
  requirePermission(CONTACT_PERMISSIONS.READ),
  validate({ query: listContactsQuerySchema }),
  ContactController.list,
);

/**
 * @swagger
 * /contacts/roles:
 *   post:
 *     tags: [Contacts]
 *     summary: Assign a contact to a business with a role
 *     description: >
 *       Creates a ContactRole linking an existing contact to a business. A
 *       contact may hold roles at multiple businesses. Rejected with 409 if
 *       this exact (business, contact, roleType) combination already exists.
 *       If `isPrimary` is true, any other primary role for the same business
 *       is atomically cleared first.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: contacts:update
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { $ref: '#/components/schemas/AssignContactRoleRequest' } } }
 *     responses:
 *       201: { description: Role assigned., content: { application/json: { schema: { $ref: '#/components/schemas/ContactRoleEnvelope' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `contacts:update` permission., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: The referenced contact does not exist in this tenant., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       409: { description: This exact role assignment already exists, or businessId does not exist (foreign key violation)., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: Validation failed., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.post(
  '/roles',
  authMiddleware,
  tenantMiddleware,
  requirePermission(CONTACT_PERMISSIONS.UPDATE),
  validate({ body: assignContactRoleSchema }),
  ContactController.assignRole,
);

// ─── /:id routes ──────────────────────────────────────────────────────────────

/**
 * @swagger
 * /contacts/{id}:
 *   get:
 *     tags: [Contacts]
 *     summary: Get a contact by ID
 *     security: [{ BearerAuth: [] }]
 *     x-permission: contacts:read
 *     parameters: [{ $ref: '#/components/parameters/ContactIdParam' }]
 *     responses:
 *       200: { description: Contact found., content: { application/json: { schema: { $ref: '#/components/schemas/ContactEnvelope' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `contacts:read` permission., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: No contact with this ID exists in the tenant., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: id is not a valid UUID., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.get(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(CONTACT_PERMISSIONS.READ),
  validate({ params: contactIdParamSchema }),
  ContactController.getById,
);

/**
 * @swagger
 * /contacts/{id}/roles:
 *   get:
 *     tags: [Contacts]
 *     summary: List a contact's business role assignments
 *     description: Returns every ContactRole for this contact (across all businesses), newest first.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: contacts:read
 *     parameters: [{ $ref: '#/components/parameters/ContactIdParam' }]
 *     responses:
 *       200: { description: The contact's role assignments., content: { application/json: { schema: { $ref: '#/components/schemas/ContactRoleListEnvelope' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `contacts:read` permission., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: No contact with this ID exists in the tenant., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.get(
  '/:id/roles',
  authMiddleware,
  tenantMiddleware,
  requirePermission(CONTACT_PERMISSIONS.READ),
  validate({ params: contactIdParamSchema }),
  ContactController.listRoles,
);

/**
 * @swagger
 * /contacts/{id}:
 *   patch:
 *     tags: [Contacts]
 *     summary: Update a contact
 *     security: [{ BearerAuth: [] }]
 *     x-permission: contacts:update
 *     parameters: [{ $ref: '#/components/parameters/ContactIdParam' }]
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { $ref: '#/components/schemas/UpdateContactRequest' } } }
 *     responses:
 *       200: { description: Contact updated., content: { application/json: { schema: { $ref: '#/components/schemas/ContactEnvelope' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `contacts:update` permission., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: No contact with this ID exists in the tenant., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: Validation failed., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.patch(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(CONTACT_PERMISSIONS.UPDATE),
  validate({ params: contactIdParamSchema, body: updateContactSchema }),
  ContactController.update,
);

/**
 * @swagger
 * /contacts/{id}:
 *   delete:
 *     tags: [Contacts]
 *     summary: Soft-delete a contact
 *     description: Soft-deletes a contact (sets deletedAt). No restore endpoint exists yet for this module.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: contacts:delete
 *     parameters: [{ $ref: '#/components/parameters/ContactIdParam' }]
 *     responses:
 *       200: { description: Contact deleted., content: { application/json: { schema: { $ref: '#/components/schemas/DeleteEnvelope' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `contacts:delete` permission., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: No contact with this ID exists in the tenant., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.delete(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(CONTACT_PERMISSIONS.DELETE),
  validate({ params: contactIdParamSchema }),
  ContactController.delete,
);

export default router;
