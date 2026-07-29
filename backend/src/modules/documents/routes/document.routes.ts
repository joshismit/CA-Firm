import { Router } from 'express';
import multer from 'multer';
import { UPLOAD } from '@shared/constants';
import { authMiddleware } from '@middlewares/auth.middleware';
import { tenantMiddleware } from '@middlewares/tenant.middleware';
import { requirePermission } from '@middlewares/permission.middleware';
import { validate } from '@middlewares/validation.middleware';
import { DocumentController } from '../controller/document.controller';
import { DOCUMENT_PERMISSIONS } from '../constants/document.permissions';
import {
  createDocumentSchema,
  updateDocumentSchema,
  listDocumentsQuerySchema,
  documentIdParamSchema,
} from '../schemas/document.schema';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Documents Routes
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Every route runs: authMiddleware → tenantMiddleware → requirePermission →
 * [upload →] validate → controller. Mirrors `modules/crm/routes/lead.routes.ts`.
 *
 * `upload` (in-memory `multer`, capped at `UPLOAD.MAX_FILE_SIZE_BYTES`) runs
 * only on `POST /` — after `requirePermission`, so an unauthorized caller's
 * file is never parsed — and before `validate()`, since `multer` is what
 * populates `req.body`'s text fields (`category`/`businessId`/`contactId`)
 * from the multipart payload in the first place. A `MulterError` (e.g. file
 * too large) is handled centrally by `errorMiddleware`, exactly like a Zod
 * or Prisma error.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD.MAX_FILE_SIZE_BYTES },
});

/**
 * @swagger
 * components:
 *   schemas:
 *     DocumentCategory:
 *       type: string
 *       enum: [PAN, GST, INCOME_TAX, ROC, AUDIT, BANK, AGREEMENTS, PAYROLL, DSC, IDENTITY, OTHER]
 *     Document:
 *       type: object
 *       description: A document response as returned by the API — never the raw database row.
 *       properties:
 *         id: { type: string, format: uuid }
 *         businessId: { type: string, format: uuid, nullable: true }
 *         contactId: { type: string, format: uuid, nullable: true }
 *         category: { $ref: '#/components/schemas/DocumentCategory' }
 *         fileName: { type: string, example: pan-card.pdf }
 *         storageKey: { type: string }
 *         mimeType: { type: string, example: application/pdf }
 *         sizeBytes: { type: integer }
 *         version: { type: integer, example: 1 }
 *         uploadedById: { type: string, format: uuid }
 *         createdAt: { type: string, format: date-time }
 *       required: [id, category, fileName, storageKey, mimeType, sizeBytes, version, uploadedById, createdAt]
 *     UpdateDocumentRequest:
 *       type: object
 *       description: Partial metadata update. The file itself cannot be replaced through this endpoint.
 *       properties:
 *         businessId: { type: string, format: uuid, nullable: true }
 *         contactId: { type: string, format: uuid, nullable: true }
 *         category: { $ref: '#/components/schemas/DocumentCategory' }
 *     DocumentDownloadUrl:
 *       type: object
 *       properties:
 *         url: { type: string, format: uri }
 *         expiresInSeconds: { type: integer }
 *       required: [url, expiresInSeconds]
 *     DocumentEnvelope:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: Success }
 *         data: { $ref: '#/components/schemas/Document' }
 *         timestamp: { type: string, format: date-time }
 *         correlationId: { type: string, format: uuid }
 *         durationMs: { type: number }
 *     DocumentListEnvelope:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: Fetched successfully }
 *         data: { type: array, items: { $ref: '#/components/schemas/Document' } }
 *         meta: { $ref: '#/components/schemas/PaginationMeta' }
 *         timestamp: { type: string, format: date-time }
 *         correlationId: { type: string, format: uuid }
 *   parameters:
 *     DocumentIdParam:
 *       name: id
 *       in: path
 *       required: true
 *       schema: { type: string, format: uuid }
 *       description: Document ID.
 */

/**
 * @swagger
 * /documents:
 *   post:
 *     tags: [Documents]
 *     summary: Upload a document
 *     description: Uploads the file to the configured bucket and creates its metadata record.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: documents:create
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, category]
 *             properties:
 *               file: { type: string, format: binary }
 *               category: { $ref: '#/components/schemas/DocumentCategory' }
 *               businessId: { type: string, format: uuid }
 *               contactId: { type: string, format: uuid }
 *     responses:
 *       201: { description: Document uploaded., content: { application/json: { schema: { $ref: '#/components/schemas/DocumentEnvelope' } } } }
 *       400: { description: No file, unsupported file type, or file exceeds the maximum upload size., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `documents:create` permission., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       409: { description: Referenced businessId/contactId does not exist (foreign key violation)., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: Validation failed., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.post(
  '/',
  authMiddleware,
  tenantMiddleware,
  requirePermission(DOCUMENT_PERMISSIONS.CREATE),
  upload.single('file'),
  validate({ body: createDocumentSchema }),
  DocumentController.upload,
);

/**
 * @swagger
 * /documents:
 *   get:
 *     tags: [Documents]
 *     summary: List documents
 *     description: Paginated, filterable, searchable list of documents scoped to the current tenant.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: documents:read
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
 *         description: Case-insensitive match against fileName.
 *         schema: { type: string, maxLength: 100 }
 *       - name: category
 *         in: query
 *         schema: { $ref: '#/components/schemas/DocumentCategory' }
 *       - name: businessId
 *         in: query
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Paginated list of documents., content: { application/json: { schema: { $ref: '#/components/schemas/DocumentListEnvelope' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `documents:read` permission., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: Invalid query parameters., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.get(
  '/',
  authMiddleware,
  tenantMiddleware,
  requirePermission(DOCUMENT_PERMISSIONS.READ),
  validate({ query: listDocumentsQuerySchema }),
  DocumentController.list,
);

/**
 * @swagger
 * /documents/{id}:
 *   get:
 *     tags: [Documents]
 *     summary: Get a document's metadata by ID
 *     security: [{ BearerAuth: [] }]
 *     x-permission: documents:read
 *     parameters: [{ $ref: '#/components/parameters/DocumentIdParam' }]
 *     responses:
 *       200: { description: Document found., content: { application/json: { schema: { $ref: '#/components/schemas/DocumentEnvelope' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `documents:read` permission., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: No document with this ID exists in the tenant., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: id is not a valid UUID., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.get(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(DOCUMENT_PERMISSIONS.READ),
  validate({ params: documentIdParamSchema }),
  DocumentController.getById,
);

/**
 * @swagger
 * /documents/{id}/download:
 *   get:
 *     tags: [Documents]
 *     summary: Get a presigned download URL
 *     description: Returns a time-limited presigned GET URL for the underlying object. Never returns a permanent link.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: documents:read
 *     parameters: [{ $ref: '#/components/parameters/DocumentIdParam' }]
 *     responses:
 *       200: { description: Presigned download URL., content: { application/json: { schema: { type: object, properties: { data: { $ref: '#/components/schemas/DocumentDownloadUrl' } } } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `documents:read` permission., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: No document with this ID exists in the tenant., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.get(
  '/:id/download',
  authMiddleware,
  tenantMiddleware,
  requirePermission(DOCUMENT_PERMISSIONS.READ),
  validate({ params: documentIdParamSchema }),
  DocumentController.getDownloadUrl,
);

/**
 * @swagger
 * /documents/{id}:
 *   patch:
 *     tags: [Documents]
 *     summary: Update a document's metadata
 *     description: Partial update. The underlying file cannot be replaced through this endpoint.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: documents:update
 *     parameters: [{ $ref: '#/components/parameters/DocumentIdParam' }]
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { $ref: '#/components/schemas/UpdateDocumentRequest' } } }
 *     responses:
 *       200: { description: Document updated., content: { application/json: { schema: { $ref: '#/components/schemas/DocumentEnvelope' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `documents:update` permission., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: No document with this ID exists in the tenant., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       409: { description: Referenced businessId/contactId does not exist (foreign key violation)., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: Validation failed., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.patch(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(DOCUMENT_PERMISSIONS.UPDATE),
  validate({ params: documentIdParamSchema, body: updateDocumentSchema }),
  DocumentController.update,
);

/**
 * @swagger
 * /documents/{id}:
 *   delete:
 *     tags: [Documents]
 *     summary: Soft-delete a document
 *     description: Soft-deletes the metadata row (sets deletedAt/deletedBy). The underlying stored object is not removed; no restore endpoint exists yet.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: documents:delete
 *     parameters: [{ $ref: '#/components/parameters/DocumentIdParam' }]
 *     responses:
 *       200: { description: Document deleted., content: { application/json: { schema: { $ref: '#/components/schemas/DeleteEnvelope' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `documents:delete` permission., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: No document with this ID exists in the tenant., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.delete(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(DOCUMENT_PERMISSIONS.DELETE),
  validate({ params: documentIdParamSchema }),
  DocumentController.delete,
);

export default router;
