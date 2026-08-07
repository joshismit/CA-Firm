import { z } from 'zod';
import {
  createDocumentSchema,
  updateDocumentSchema,
  listDocumentsQuerySchema,
  shareDocumentSchema,
  requestDocumentApprovalSchema,
  approveDocumentSchema,
  rejectDocumentSchema,
} from '../schemas/document.schema';

/**
 * Request DTOs — inferred from the Zod schemas in `schemas/document.schema.ts`.
 * These are the shapes controllers/services receive AFTER `validate()` has run.
 */

export type CreateDocumentDto = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentDto = z.infer<typeof updateDocumentSchema>;
export type ListDocumentsQueryDto = z.infer<typeof listDocumentsQuerySchema>;
export type ShareDocumentDto = z.infer<typeof shareDocumentSchema>;
export type RequestDocumentApprovalDto = z.infer<typeof requestDocumentApprovalSchema>;
export type ApproveDocumentDto = z.infer<typeof approveDocumentSchema>;
export type RejectDocumentDto = z.infer<typeof rejectDocumentSchema>;
