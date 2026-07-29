// Zod schemas for documents forms and API payload/response validation.

import { z } from 'zod'
import { DOCUMENT_CATEGORY_VALUES, MAX_UPLOAD_SIZE_BYTES, SUPPORTED_MIME_TYPES } from '../constants'

export const uploadDocumentSchema = z.object({
  businessId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  category: z.enum(DOCUMENT_CATEGORY_VALUES),
  file: z
    .instanceof(File)
    .refine((f) => f.size <= MAX_UPLOAD_SIZE_BYTES, 'File exceeds the maximum upload size')
    .refine((f) => SUPPORTED_MIME_TYPES.includes(f.type), 'Unsupported file type'),
})

export type UploadDocumentFormValues = z.infer<typeof uploadDocumentSchema>

/** Metadata-only edit form - same fields as upload, minus `file` (no update endpoint replaces the file itself). */
export const updateDocumentSchema = uploadDocumentSchema.omit({ file: true })

export type UpdateDocumentFormValues = z.infer<typeof updateDocumentSchema>
