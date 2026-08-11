import { Router, Request } from 'express';
import multer, { FileFilterCallback } from 'multer';
import { UPLOAD } from '@shared/constants';
import { UnsupportedMediaTypeError } from '@shared/errors';
import { FileValidation } from '@shared/utils';
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
  shareDocumentSchema,
  revokeShareParamSchema,
  requestDocumentApprovalSchema,
  approveDocumentSchema,
  rejectDocumentSchema,
} from '../schemas/document.schema';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Documents Routes
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Every route runs: authMiddleware → tenantMiddleware → requirePermission →
 * [upload →] validate → controller. Mirrors `modules/crm/routes/lead.routes.ts`.
 *
 * `upload` (in-memory `multer`, capped at `UPLOAD.MAX_FILE_SIZE_CEILING_BYTES`)
 * runs only on `POST /` — after `requirePermission`, so an unauthorized
 * caller's file is never parsed — and before `validate()`, since `multer` is
 * what populates `req.body`'s text fields (`category`/`businessId`/
 * `contactId`) from the multipart payload in the first place. A `MulterError`
 * (e.g. file too large) is handled centrally by `errorMiddleware`, exactly
 * like a Zod or Prisma error.
 *
 * PRD §7.4 — the ceiling here is a transport-layer safety backstop only
 * (large enough for the biggest plan tier), not the enforced business rule.
 * The real, tenant-specific limit is resolved and checked by
 * `DocumentService`/`StorageQuotaService` — see that service's header
 * comment — because `multer`'s `limits.fileSize` is fixed at router-setup
 * time and can't vary per tenant/request.
 *
 * PRD §7.5 — `fileFilter` rejects an unsupported extension/MIME type (or an
 * explicitly blocked executable/script extension) before the file body is
 * even read into memory, via the shared `FileValidation.validate()` — the
 * same check `DocumentService.validateFile()` runs again once the buffer is
 * available (see that method's header comment for why both layers check).
 * A rejection throws `UnsupportedMediaTypeError` (415), which `multer`
 * forwards to `errorMiddleware` exactly like any other thrown `AppError`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const router = Router();

function documentFileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void {
  const result = FileValidation.validate(file.originalname, file.mimetype);
  if (!result.valid) {
    cb(new UnsupportedMediaTypeError(result.reason));
    return;
  }
  cb(null, true);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD.MAX_FILE_SIZE_CEILING_BYTES },
  fileFilter: documentFileFilter,
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
 *         folderId: { type: string, format: uuid, nullable: true }
 *         category: { $ref: '#/components/schemas/DocumentCategory' }
 *         fileName: { type: string, example: pan-card.pdf }
 *         storageKey: { type: string }
 *         mimeType: { type: string, example: application/pdf }
 *         sizeBytes: { type: integer }
 *         version: { type: integer, example: 1, description: This row's own position in its version chain. }
 *         isLatestVersion: { type: boolean, description: True only for the newest row in the chain. }
 *         rootDocumentId: { type: string, format: uuid, nullable: true, description: Null on the first (v1) version, which is the root; every later version points at it. }
 *         previousVersionId: { type: string, format: uuid, nullable: true, description: The version this one replaced, if any. }
 *         uploadedById: { type: string, format: uuid }
 *         approvalStatus: { type: string, enum: [NOT_REQUIRED, PENDING_APPROVAL, APPROVED, REJECTED], description: 'PRD §14.7 — Sensitive Upload Approval status.' }
 *         reviewerId: { type: string, format: uuid, nullable: true }
 *         reviewedAt: { type: string, format: date-time, nullable: true }
 *         reviewComment: { type: string, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *       required: [id, category, fileName, storageKey, mimeType, sizeBytes, version, isLatestVersion, rootDocumentId, previousVersionId, uploadedById, approvalStatus, reviewerId, reviewedAt, reviewComment, createdAt]
 *     UpdateDocumentRequest:
 *       type: object
 *       description: Partial metadata update. The file itself cannot be replaced through this endpoint.
 *       properties:
 *         businessId: { type: string, format: uuid, nullable: true }
 *         contactId: { type: string, format: uuid, nullable: true }
 *         folderId: { type: string, format: uuid, nullable: true }
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
 *     description: >
 *       Uploads the file to the configured bucket and creates its metadata record.
 *
 *       PRD §7.5 — supported file types (extension AND MIME type must both match): PDF
 *       (application/pdf), JPG/JPEG (image/jpeg), and PNG (image/png). Every other file type,
 *       including executable/script files (.exe, .dll, .bat, .cmd, .sh, .js, .ts, .php, .py,
 *       .jar, .apk, .ipa), is always rejected, even if renamed to a supported extension.
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
 *               file: { type: string, format: binary, description: 'Supported types: PDF, JPG, JPEG, PNG.' }
 *               category: { $ref: '#/components/schemas/DocumentCategory' }
 *               businessId: { type: string, format: uuid }
 *               contactId: { type: string, format: uuid }
 *               folderId: { type: string, format: uuid, description: Optional — must belong to the same Business/category. }
 *               createVersion: { type: boolean, default: false, description: 'PRD §7.2 rule 7 — confirms a replace after receiving a 409 on a prior attempt with the same Business+Contact+Folder+Category+filename.' }
 *     responses:
 *       201: { description: Document uploaded (a fresh document, or — with createVersion=true and a matching prior upload — a new version of it)., content: { application/json: { schema: { $ref: '#/components/schemas/DocumentEnvelope' } } } }
 *       400: { description: No file, file exceeds the tenant's effective maximum upload size (PRD §7.4), folderId belongs to a different Business/category, or the document has neither businessId nor contactId., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `documents:create` permission, or the upload would exceed the business's or tenant's storage quota (PRD §7.4)., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       409: { description: A document already exists at this exact Business+Contact+Folder+Category+filename ("replacement candidate detected") and createVersion was not set, or a referenced businessId/contactId does not exist., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       415: { description: 'PRD §7.5 — unsupported file extension, MIME type, extension/MIME mismatch, content that does not match the declared type, or a blocked executable/script extension.', content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
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
 *       - name: folderId
 *         in: query
 *         schema: { type: string, format: uuid }
 *       - name: uploadedFrom
 *         in: query
 *         description: Lower bound (inclusive) on the upload date (createdAt).
 *         schema: { type: string, format: date-time }
 *       - name: uploadedTo
 *         in: query
 *         description: Upper bound (inclusive) on the upload date (createdAt).
 *         schema: { type: string, format: date-time }
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

/**
 * @swagger
 * /documents/{id}/share:
 *   post:
 *     tags: [Documents]
 *     summary: Share a document with another user in the tenant
 *     description: Grants the target user read access to this document, bypassing their normal Business/category scope (PRD 6.2). The caller must already be able to see the document themselves.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: documents:share
 *     parameters: [{ $ref: '#/components/parameters/DocumentIdParam' }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId]
 *             properties:
 *               userId: { type: string, format: uuid }
 *               expiresAt: { type: string, format: date-time }
 *     responses:
 *       200: { description: Document shared., content: { application/json: { schema: { $ref: '#/components/schemas/DocumentEnvelope' } } } }
 *       400: { description: Target user not found in this tenant, or sharing with yourself., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `documents:share` permission, or cannot see this document., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: No document with this ID exists in the tenant., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: Validation failed., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.post(
  '/:id/share',
  authMiddleware,
  tenantMiddleware,
  requirePermission(DOCUMENT_PERMISSIONS.SHARE),
  validate({ params: documentIdParamSchema, body: shareDocumentSchema }),
  DocumentController.share,
);

/**
 * @swagger
 * /documents/{id}/share/{userId}:
 *   delete:
 *     tags: [Documents]
 *     summary: Revoke a document share
 *     description: Removes a previously-granted share access for one user, before it would otherwise lapse on its own expiresAt (or removes a permanent, no-expiry grant).
 *     security: [{ BearerAuth: [] }]
 *     x-permission: documents:share
 *     parameters:
 *       - { $ref: '#/components/parameters/DocumentIdParam' }
 *       - name: userId
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: The user whose share access is being revoked.
 *     responses:
 *       200: { description: Share revoked., content: { application/json: { schema: { $ref: '#/components/schemas/DeleteEnvelope' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `documents:share` permission, or cannot see this document., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: No document with this ID exists in the tenant, or no share grant exists for that user., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: id or userId is not a valid UUID., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.delete(
  '/:id/share/:userId',
  authMiddleware,
  tenantMiddleware,
  requirePermission(DOCUMENT_PERMISSIONS.SHARE),
  validate({ params: revokeShareParamSchema }),
  DocumentController.revokeShare,
);

/**
 * @swagger
 * /documents/{id}/versions:
 *   get:
 *     tags: [Documents]
 *     summary: Get a document's full version history
 *     description: Returns every version in this document's chain (oldest first) — PRD §7.2. `id` may be any version, not just the latest.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: documents:read
 *     parameters: [{ $ref: '#/components/parameters/DocumentIdParam' }]
 *     responses:
 *       200: { description: Version history., content: { application/json: { schema: { $ref: '#/components/schemas/DocumentListEnvelope' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `documents:read` permission, or cannot see this document., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: No document with this ID exists in the tenant., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: id is not a valid UUID., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.get(
  '/:id/versions',
  authMiddleware,
  tenantMiddleware,
  requirePermission(DOCUMENT_PERMISSIONS.READ),
  validate({ params: documentIdParamSchema }),
  DocumentController.getVersionHistory,
);

/**
 * @swagger
 * /documents/{id}/version:
 *   post:
 *     tags: [Documents]
 *     summary: Confirm replacement — create a new version of this document
 *     description: >
 *       PRD §7.2 rules 7-8 — the explicit "confirm" step after a 409 replace-candidate response
 *       (or a direct replace from a known document id). Always versions the given document
 *       regardless of the new file's name; the prior version is kept (isLatestVersion=false),
 *       never overwritten or deleted.
 *
 *       PRD §7.5 — the replacement file must be one of the same supported types as a fresh
 *       upload: PDF, JPG, JPEG, or PNG.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: documents:create
 *     parameters: [{ $ref: '#/components/parameters/DocumentIdParam' }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file: { type: string, format: binary, description: 'Supported types: PDF, JPG, JPEG, PNG.' }
 *     responses:
 *       201: { description: New version created., content: { application/json: { schema: { $ref: '#/components/schemas/DocumentEnvelope' } } } }
 *       400: { description: No file, or file exceeds the tenant's effective maximum upload size (PRD §7.4)., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `documents:create` permission, cannot see this document, or the upload would exceed the business's or tenant's storage quota (PRD §7.4)., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: No document with this ID exists in the tenant., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       415: { description: 'PRD §7.5 — unsupported file extension, MIME type, extension/MIME mismatch, content that does not match the declared type, or a blocked executable/script extension.', content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: id is not a valid UUID., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.post(
  '/:id/version',
  authMiddleware,
  tenantMiddleware,
  requirePermission(DOCUMENT_PERMISSIONS.CREATE),
  upload.single('file'),
  validate({ params: documentIdParamSchema }),
  DocumentController.createVersion,
);

/**
 * @swagger
 * /documents/{id}/request-approval:
 *   post:
 *     tags: [Documents]
 *     summary: Request approval for a sensitive document (PRD §14.7)
 *     description: Moves the document to PENDING_APPROVAL and notifies the chosen reviewer. Reachable from NOT_REQUIRED (first request) or REJECTED (resubmission). The caller must already be able to see the document themselves.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: documents:update
 *     parameters: [{ $ref: '#/components/parameters/DocumentIdParam' }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [reviewerId], properties: { reviewerId: { type: string, format: uuid } } }
 *     responses:
 *       200: { description: Approval requested., content: { application/json: { schema: { $ref: '#/components/schemas/DocumentEnvelope' } } } }
 *       400: { description: Reviewer not found in this tenant., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `documents:update` permission, or cannot see this document., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: No document with this ID exists in the tenant., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       409: { description: Document is already PENDING_APPROVAL or APPROVED., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: Validation failed., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.post(
  '/:id/request-approval',
  authMiddleware,
  tenantMiddleware,
  requirePermission(DOCUMENT_PERMISSIONS.UPDATE),
  validate({ params: documentIdParamSchema, body: requestDocumentApprovalSchema }),
  DocumentController.requestApproval,
);

/**
 * @swagger
 * /documents/{id}/approve:
 *   post:
 *     tags: [Documents]
 *     summary: Approve a document pending approval (PRD §14.7)
 *     security: [{ BearerAuth: [] }]
 *     x-permission: documents:approve
 *     parameters: [{ $ref: '#/components/parameters/DocumentIdParam' }]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema: { type: object, properties: { comment: { type: string, maxLength: 1000 } } }
 *     responses:
 *       200: { description: Document approved., content: { application/json: { schema: { $ref: '#/components/schemas/DocumentEnvelope' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `documents:approve` permission, or cannot see this document., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: No document with this ID exists in the tenant., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       409: { description: Document is not PENDING_APPROVAL., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: Validation failed., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.post(
  '/:id/approve',
  authMiddleware,
  tenantMiddleware,
  requirePermission(DOCUMENT_PERMISSIONS.APPROVE),
  validate({ params: documentIdParamSchema, body: approveDocumentSchema }),
  DocumentController.approve,
);

/**
 * @swagger
 * /documents/{id}/reject:
 *   post:
 *     tags: [Documents]
 *     summary: Reject a document pending approval (PRD §14.7)
 *     security: [{ BearerAuth: [] }]
 *     x-permission: documents:approve
 *     parameters: [{ $ref: '#/components/parameters/DocumentIdParam' }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [comment], properties: { comment: { type: string, minLength: 1, maxLength: 1000 } } }
 *     responses:
 *       200: { description: Document rejected., content: { application/json: { schema: { $ref: '#/components/schemas/DocumentEnvelope' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `documents:approve` permission, or cannot see this document., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: No document with this ID exists in the tenant., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       409: { description: Document is not PENDING_APPROVAL., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: Validation failed — a comment is required., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.post(
  '/:id/reject',
  authMiddleware,
  tenantMiddleware,
  requirePermission(DOCUMENT_PERMISSIONS.APPROVE),
  validate({ params: documentIdParamSchema, body: rejectDocumentSchema }),
  DocumentController.reject,
);

export default router;
