// documents-scoped React hooks - data-fetching wrappers (TanStack Query) and local UI state.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/services/query-keys'
import {
  deleteDocument,
  getDocument,
  getDocumentDownloadUrl,
  listDocumentTemplates,
  listDocuments,
  updateDocument,
  uploadDocument,
} from '../api'
import type {
  DocumentListFilters,
  DocumentTemplateListFilters,
  UpdateDocumentPayload,
  UploadDocumentPayload,
} from '../types'

export function useDocumentsQuery(filters: DocumentListFilters) {
  return useQuery({ queryKey: queryKeys.documents.list(filters), queryFn: () => listDocuments(filters) })
}

export function useDocumentQuery(id: string) {
  return useQuery({ queryKey: queryKeys.documents.detail(id), queryFn: () => getDocument(id), enabled: !!id })
}

export interface UploadDocumentVariables {
  payload: UploadDocumentPayload
  /** Real Axios upload progress (0-100) - see api/index.ts's uploadDocument(). */
  onUploadProgress?: (percent: number) => void
}

export function useUploadDocumentMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ payload, onUploadProgress }: UploadDocumentVariables) => uploadDocument(payload, onUploadProgress),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.documents.lists() }),
  })
}

export function useUpdateDocumentMutation(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateDocumentPayload) => updateDocument(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.documents.detail(id) })
      qc.invalidateQueries({ queryKey: queryKeys.documents.lists() })
    },
  })
}

export function useDeleteDocumentMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteDocument(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.documents.lists() }),
  })
}

/**
 * On-demand action, not cached server state - a mutation (like the rest of this file's write
 * operations) rather than a `useQuery`, since there's nothing to subscribe to or refetch. Reuses
 * plain browser download behavior (`window.open` on the presigned URL) rather than proxying the
 * file through this app.
 */
export function useDownloadDocumentMutation() {
  return useMutation({
    mutationFn: (id: string) => getDocumentDownloadUrl(id),
    onSuccess: ({ url }) => {
      window.open(url, '_blank', 'noopener,noreferrer')
    },
  })
}

/**
 * Auto-fetched (unlike the download mutation above) for inline preview - `enabled` should be true
 * only for previewable mime types, so a presigned URL isn't generated for every document detail
 * page view. `staleTime` is shorter than the backend's presign expiry (1 hour, see
 * config/storage.ts's presignedUrlExpirySeconds) so a stale, expired URL is never served from cache.
 */
export function useDocumentDownloadUrlQuery(id: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.documents.downloadUrl(id),
    queryFn: () => getDocumentDownloadUrl(id),
    enabled: enabled && !!id,
    staleTime: 5 * 60 * 1000,
  })
}

/** `retry: false` - the templates API is a guaranteed 501 today, no point retry-storming it. */
export function useDocumentTemplatesQuery(filters: DocumentTemplateListFilters) {
  return useQuery({
    queryKey: queryKeys.documents.templatesList(filters),
    queryFn: () => listDocumentTemplates(filters),
    retry: false,
  })
}
