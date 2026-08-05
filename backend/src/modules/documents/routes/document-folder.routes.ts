import { Router } from 'express';
import { authMiddleware } from '@middlewares/auth.middleware';
import { tenantMiddleware } from '@middlewares/tenant.middleware';
import { requirePermission } from '@middlewares/permission.middleware';
import { validate } from '@middlewares/validation.middleware';
import { DocumentFolderController } from '../controller/document-folder.controller';
import { DOCUMENT_PERMISSIONS } from '../constants/document.permissions';
import {
  businessIdParamSchema,
  folderIdParamSchema,
  createFolderSchema,
  updateFolderSchema,
  listFoldersQuerySchema,
} from '../schemas/document-folder.schema';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Document Folder Routes (PRD §7.1 rule 4)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Mounted at the same `${API.PREFIX}/documents` prefix as
 * `document.routes.ts` (see `src/app.ts` — Express supports multiple routers
 * on one prefix), so the full paths are:
 *   POST/GET   /documents/businesses/:businessId/folders
 *   GET        /documents/folders/:id
 *   PATCH      /documents/folders/:id
 *   DELETE     /documents/folders/:id
 *
 * Reuses `DOCUMENT_PERMISSIONS` (no dedicated `folders:*` permission) and the
 * same `authMiddleware → tenantMiddleware → requirePermission → validate →
 * controller` chain as `document.routes.ts` — folders are not a second
 * authorization system (PRD 7.1 rule 7).
 * ─────────────────────────────────────────────────────────────────────────────
 */
const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     DocumentFolder:
 *       type: object
 *       description: A document folder response as returned by the API — never the raw database row.
 *       properties:
 *         id: { type: string, format: uuid }
 *         businessId: { type: string, format: uuid }
 *         category: { $ref: '#/components/schemas/DocumentCategory' }
 *         parentFolderId: { type: string, format: uuid, nullable: true }
 *         name: { type: string, example: FY 2025-26 }
 *         createdById: { type: string, format: uuid }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *       required: [id, businessId, category, name, createdById, createdAt, updatedAt]
 *     CreateFolderRequest:
 *       type: object
 *       required: [category, name]
 *       properties:
 *         category: { $ref: '#/components/schemas/DocumentCategory' }
 *         parentFolderId: { type: string, format: uuid }
 *         name: { type: string, minLength: 1, maxLength: 255 }
 *     UpdateFolderRequest:
 *       type: object
 *       description: Rename only — category/business/parent are immutable after creation.
 *       required: [name]
 *       properties:
 *         name: { type: string, minLength: 1, maxLength: 255 }
 *     DocumentFolderEnvelope:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: Success }
 *         data: { $ref: '#/components/schemas/DocumentFolder' }
 *         timestamp: { type: string, format: date-time }
 *         correlationId: { type: string, format: uuid }
 *     DocumentFolderListEnvelope:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: Fetched successfully }
 *         data: { type: array, items: { $ref: '#/components/schemas/DocumentFolder' } }
 *         timestamp: { type: string, format: date-time }
 *         correlationId: { type: string, format: uuid }
 */

/**
 * @swagger
 * /documents/businesses/{businessId}/folders:
 *   post:
 *     tags: [Document Folders]
 *     summary: Create a folder (or sub-folder) under a Business/category
 *     security: [{ BearerAuth: [] }]
 *     x-permission: documents:create
 *     parameters:
 *       - name: businessId
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { $ref: '#/components/schemas/CreateFolderRequest' } } }
 *     responses:
 *       201: { description: Folder created., content: { application/json: { schema: { $ref: '#/components/schemas/DocumentFolderEnvelope' } } } }
 *       400: { description: parentFolderId belongs to a different Business/category., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `documents:create` permission, or this Business/category is outside their access scope., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: Business or parent folder not found., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       409: { description: A sibling folder with this name already exists at this level., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: Validation failed., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.post(
  '/businesses/:businessId/folders',
  authMiddleware,
  tenantMiddleware,
  requirePermission(DOCUMENT_PERMISSIONS.CREATE),
  validate({ params: businessIdParamSchema, body: createFolderSchema }),
  DocumentFolderController.create,
);

/**
 * @swagger
 * /documents/businesses/{businessId}/folders:
 *   get:
 *     tags: [Document Folders]
 *     summary: List folders for a Business
 *     description: Flat list (not paginated — folder counts per Business are small); the client builds the tree from `parentFolderId`. Optionally narrowed to one category and/or the direct children of one parent.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: documents:read
 *     parameters:
 *       - name: businessId
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - name: category
 *         in: query
 *         schema: { $ref: '#/components/schemas/DocumentCategory' }
 *       - name: parentFolderId
 *         in: query
 *         description: When provided, only that folder's direct children are returned. Omitted entirely returns every folder for the Business/category.
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: List of folders., content: { application/json: { schema: { $ref: '#/components/schemas/DocumentFolderListEnvelope' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `documents:read` permission., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: Business not found., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: Invalid query parameters., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.get(
  '/businesses/:businessId/folders',
  authMiddleware,
  tenantMiddleware,
  requirePermission(DOCUMENT_PERMISSIONS.READ),
  validate({ params: businessIdParamSchema, query: listFoldersQuerySchema }),
  DocumentFolderController.list,
);

/**
 * @swagger
 * /documents/folders/{id}:
 *   get:
 *     tags: [Document Folders]
 *     summary: Get a folder by ID
 *     security: [{ BearerAuth: [] }]
 *     x-permission: documents:read
 *     parameters: [{ name: id, in: path, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Folder found., content: { application/json: { schema: { $ref: '#/components/schemas/DocumentFolderEnvelope' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `documents:read` permission, or this folder's Business/category is outside their access scope., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: No folder with this ID exists in the tenant., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.get(
  '/folders/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(DOCUMENT_PERMISSIONS.READ),
  validate({ params: folderIdParamSchema }),
  DocumentFolderController.getById,
);

/**
 * @swagger
 * /documents/folders/{id}:
 *   patch:
 *     tags: [Document Folders]
 *     summary: Rename a folder
 *     security: [{ BearerAuth: [] }]
 *     x-permission: documents:update
 *     parameters: [{ name: id, in: path, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { $ref: '#/components/schemas/UpdateFolderRequest' } } }
 *     responses:
 *       200: { description: Folder renamed., content: { application/json: { schema: { $ref: '#/components/schemas/DocumentFolderEnvelope' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `documents:update` permission, or this folder's Business/category is outside their access scope., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: No folder with this ID exists in the tenant., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       409: { description: A sibling folder with this name already exists at this level., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: Validation failed., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.patch(
  '/folders/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(DOCUMENT_PERMISSIONS.UPDATE),
  validate({ params: folderIdParamSchema, body: updateFolderSchema }),
  DocumentFolderController.rename,
);

/**
 * @swagger
 * /documents/folders/{id}:
 *   delete:
 *     tags: [Document Folders]
 *     summary: Delete an empty folder
 *     description: Hard-deletes the folder row. Fails with 409 if the folder still has sub-folders or documents — no recursive delete (PRD 7.1 rule 4).
 *     security: [{ BearerAuth: [] }]
 *     x-permission: documents:delete
 *     parameters: [{ name: id, in: path, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Folder deleted., content: { application/json: { schema: { $ref: '#/components/schemas/DeleteEnvelope' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `documents:delete` permission, or this folder's Business/category is outside their access scope., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: No folder with this ID exists in the tenant., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       409: { description: The folder still has sub-folders or documents., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.delete(
  '/folders/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(DOCUMENT_PERMISSIONS.DELETE),
  validate({ params: folderIdParamSchema }),
  DocumentFolderController.delete,
);

export default router;
