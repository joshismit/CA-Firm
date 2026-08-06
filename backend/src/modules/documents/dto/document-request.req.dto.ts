import { z } from 'zod';
import {
  createDocumentRequestSchema,
  updateDocumentRequestSchema,
  fulfillDocumentRequestSchema,
  listDocumentRequestsQuerySchema,
} from '../schemas/document-request.schema';

export type CreateDocumentRequestDto = z.infer<typeof createDocumentRequestSchema>;
export type UpdateDocumentRequestDto = z.infer<typeof updateDocumentRequestSchema>;
export type FulfillDocumentRequestDto = z.infer<typeof fulfillDocumentRequestSchema>;
export type ListDocumentRequestsQueryDto = z.infer<typeof listDocumentRequestsQuerySchema>;
