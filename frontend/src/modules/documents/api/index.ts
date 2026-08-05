// documents API request functions, built on the shared Axios instance from src/services/axios.ts.
// Hits the real backend at ${env.apiBaseUrl}/documents
// (backend/src/modules/documents/routes/document.routes.ts) - mirrors modules/business/api/index.ts
// now that the Documents backend module exists.

import { apiClient } from '@/services/axios'
import type { ApiError } from '@/services/api-error'
import type { ApiResponse, PaginatedResponse } from '@/types/api.types'
import type {
  CreateFolderPayload,
  DocumentDownloadUrl,
  DocumentFile,
  DocumentFolder,
  DocumentFolderListFilters,
  DocumentListFilters,
  DocumentTemplate,
  DocumentTemplateListFilters,
  UpdateDocumentPayload,
  UpdateFolderPayload,
  UploadDocumentPayload,
} from '../types'


export async function listDocuments(filters: DocumentListFilters): Promise<PaginatedResponse<DocumentFile>> {
  const { data } = await apiClient.get<PaginatedResponse<DocumentFile>>('/documents', { params: filters })
  return data
}

export async function getDocument(id: string): Promise<DocumentFile> {
  const { data } = await apiClient.get<ApiResponse<DocumentFile>>(`/documents/${id}`)
  return data.data
}

/**
 * `multipart/form-data` - `apiClient`'s default Axios instance sets no Content-Type of its own, so
 * passing a `FormData` body lets Axios/the browser attach the correct
 * `multipart/form-data; boundary=...` header automatically. Only appends fields the user actually
 * provided - never sends a `businessId`/`contactId` key at all when absent, rather than an
 * `undefined` value multer/Zod would have to special-case.
 *
 * `onUploadProgress` is real Axios/XHR upload progress (bytes actually sent over the wire) - not a
 * simulated/fake progress bar - so the upload-queue UI can show a genuine per-file percentage.
 */
export async function uploadDocument(
  payload: UploadDocumentPayload,
  onUploadProgress?: (percent: number) => void
): Promise<DocumentFile> {
  const formData = new FormData()
  formData.append('file', payload.file)
  formData.append('category', payload.category)
  if (payload.businessId) formData.append('businessId', payload.businessId)
  if (payload.contactId) formData.append('contactId', payload.contactId)
  if (payload.folderId) formData.append('folderId', payload.folderId)
  if (payload.createVersion) formData.append('createVersion', 'true')

  const { data } = await apiClient.post<ApiResponse<DocumentFile>>('/documents', formData, {
    onUploadProgress: onUploadProgress
      ? (event) => {
          if (event.total) onUploadProgress(Math.round((event.loaded / event.total) * 100))
        }
      : undefined,
  })
  return data.data
}

export async function updateDocument(id: string, payload: UpdateDocumentPayload): Promise<DocumentFile> {
  const { data } = await apiClient.patch<ApiResponse<DocumentFile>>(`/documents/${id}`, payload)
  return data.data
}

export async function deleteDocument(id: string): Promise<void> {
  await apiClient.delete(`/documents/${id}`)
}

/** Presigned, time-limited GET URL - never proxies the file through this app's own server. */
export async function getDocumentDownloadUrl(id: string): Promise<DocumentDownloadUrl> {
  const { data } = await apiClient.get<ApiResponse<DocumentDownloadUrl>>(`/documents/${id}/download`)
  return data.data
}

// ─── Versioning (PRD §7.2) ──────────────────────────────────────────────────

/** Every version in `id`'s chain, oldest first - `id` may be any version, not just the latest. */
export async function getDocumentVersions(id: string): Promise<DocumentFile[]> {
  const { data } = await apiClient.get<ApiResponse<DocumentFile[]>>(`/documents/${id}/versions`)
  return data.data
}

/**
 * PRD §7.2 rules 7-8 - the explicit "confirm replacement" step: always creates a new version of
 * `id` regardless of the new file's name. Prefer this (over re-calling `uploadDocument` with
 * `createVersion: true`) once the target document is already known, e.g. from the Replace File
 * dialog on a document's own detail page.
 */
export async function uploadDocumentVersion(
  id: string,
  file: File,
  onUploadProgress?: (percent: number) => void
): Promise<DocumentFile> {
  const formData = new FormData()
  formData.append('file', file)

  const { data } = await apiClient.post<ApiResponse<DocumentFile>>(`/documents/${id}/version`, formData, {
    onUploadProgress: onUploadProgress
      ? (event) => {
          if (event.total) onUploadProgress(Math.round((event.loaded / event.total) * 100))
        }
      : undefined,
  })
  return data.data
}

// ─── Folders (PRD §7.1 rule 3) ─────────────────────────────────────────────────
// Hits backend/src/modules/documents/routes/document-folder.routes.ts - mounted on the same
// `/documents` prefix as the routes above (a second router - see that file's header comment).

export async function listFolders(businessId: string, filters: DocumentFolderListFilters = {}): Promise<DocumentFolder[]> {
  const { data } = await apiClient.get<ApiResponse<DocumentFolder[]>>(`/documents/businesses/${businessId}/folders`, {
    params: filters,
  })
  return data.data
}

export async function getFolder(id: string): Promise<DocumentFolder> {
  const { data } = await apiClient.get<ApiResponse<DocumentFolder>>(`/documents/folders/${id}`)
  return data.data
}

export async function createFolder(businessId: string, payload: CreateFolderPayload): Promise<DocumentFolder> {
  const { data } = await apiClient.post<ApiResponse<DocumentFolder>>(`/documents/businesses/${businessId}/folders`, payload)
  return data.data
}

export async function renameFolder(id: string, payload: UpdateFolderPayload): Promise<DocumentFolder> {
  const { data } = await apiClient.patch<ApiResponse<DocumentFolder>>(`/documents/folders/${id}`, payload)
  return data.data
}

export async function deleteFolder(id: string): Promise<void> {
  await apiClient.delete(`/documents/folders/${id}`)
}

// NOT YET AVAILABLE: reusable document templates have no backend Prisma model or routes yet,
// unlike the rest of this file which hits the real Documents backend. Same notImplemented()/
// ApiError(501) shape as modules/compliance/api/index.ts and modules/reports/api/index.ts.
function notImplemented(action: string): never {
  throw {
    status: 501,
    code: 'NOT_IMPLEMENTED',
    message: `Document templates API is not available yet (${action}).`,
  } satisfies ApiError
}

// TODO: GET /documents/templates
export async function listDocumentTemplates(_filters: DocumentTemplateListFilters): Promise<PaginatedResponse<DocumentTemplate>> {
  return notImplemented('listDocumentTemplates')
}
