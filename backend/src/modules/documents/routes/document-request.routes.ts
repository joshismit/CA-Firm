import { Router } from 'express';
import { authMiddleware } from '@middlewares/auth.middleware';
import { tenantMiddleware } from '@middlewares/tenant.middleware';
import { requirePermission } from '@middlewares/permission.middleware';
import { validate } from '@middlewares/validation.middleware';
import { DocumentRequestController } from '../controller/document-request.controller';
import { DOCUMENT_PERMISSIONS } from '../constants/document.permissions';
import {
  createDocumentRequestSchema,
  updateDocumentRequestSchema,
  fulfillDocumentRequestSchema,
  listDocumentRequestsQuerySchema,
  documentRequestIdParamSchema,
} from '../schemas/document-request.schema';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Document Request Routes (PRD §11.4/§11.12)
 * ─────────────────────────────────────────────────────────────────────────────
 * Mounted at `${API.PREFIX}/document-requests` — a separate prefix from
 * `document.routes.ts`/`document-folder.routes.ts` (both `/documents`) since
 * this is a distinct resource, not a sub-path of it. Reuses `DOCUMENT_PERMISSIONS`
 * (no dedicated permission) — same reasoning as `document-folder.routes.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const router = Router();

router.post(
  '/',
  authMiddleware,
  tenantMiddleware,
  requirePermission(DOCUMENT_PERMISSIONS.CREATE),
  validate({ body: createDocumentRequestSchema }),
  DocumentRequestController.create,
);

router.get(
  '/',
  authMiddleware,
  tenantMiddleware,
  requirePermission(DOCUMENT_PERMISSIONS.READ),
  validate({ query: listDocumentRequestsQuerySchema }),
  DocumentRequestController.list,
);

router.get(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(DOCUMENT_PERMISSIONS.READ),
  validate({ params: documentRequestIdParamSchema }),
  DocumentRequestController.getById,
);

router.patch(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(DOCUMENT_PERMISSIONS.UPDATE),
  validate({ params: documentRequestIdParamSchema, body: updateDocumentRequestSchema }),
  DocumentRequestController.update,
);

router.post(
  '/:id/fulfill',
  authMiddleware,
  tenantMiddleware,
  requirePermission(DOCUMENT_PERMISSIONS.UPDATE),
  validate({ params: documentRequestIdParamSchema, body: fulfillDocumentRequestSchema }),
  DocumentRequestController.fulfill,
);

router.post(
  '/:id/cancel',
  authMiddleware,
  tenantMiddleware,
  requirePermission(DOCUMENT_PERMISSIONS.UPDATE),
  validate({ params: documentRequestIdParamSchema }),
  DocumentRequestController.cancel,
);

export default router;
