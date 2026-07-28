// documents API request functions, built on the shared Axios instance from src/services/axios.ts.
//
// NOT YET AVAILABLE: there is no Documents Prisma model or backend module at all yet (unlike
// Business/Contacts/CRM, which at least have schema). Every function below is a typed
// placeholder - wire the real apiClient call (including multipart upload handling) once the
// backend designs and implements this module. No mock data, no guessed endpoint path.

import type { ApiError } from '@/services/api-error'
import type { PaginatedResponse } from '@/types/api.types'
import type { DocumentFile, DocumentListFilters, UploadDocumentPayload } from '../types'

function notImplemented(action: string): never {
  throw {
    status: 501,
    code: 'NOT_IMPLEMENTED',
    message: `Documents API is not available yet (${action}).`,
  } satisfies ApiError
}

// TODO: GET /api/v1/documents
export async function listDocuments(_filters: DocumentListFilters): Promise<PaginatedResponse<DocumentFile>> {
  return notImplemented('listDocuments')
}

// TODO: GET /api/v1/documents/:id
export async function getDocument(_id: string): Promise<DocumentFile> {
  return notImplemented('getDocument')
}

// TODO: POST /api/v1/documents (multipart/form-data)
export async function uploadDocument(_payload: UploadDocumentPayload): Promise<DocumentFile> {
  return notImplemented('uploadDocument')
}

// TODO: DELETE /api/v1/documents/:id
export async function deleteDocument(_id: string): Promise<void> {
  return notImplemented('deleteDocument')
}
