// documents-scoped React hooks - data-fetching wrappers (TanStack Query) and local UI state.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/services/query-keys'
import { deleteDocument, getDocument, listDocuments, uploadDocument } from '../api'
import type { DocumentListFilters, UploadDocumentPayload } from '../types'

export function useDocumentsQuery(filters: DocumentListFilters) {
  return useQuery({ queryKey: queryKeys.documents.list(filters), queryFn: () => listDocuments(filters) })
}

export function useDocumentQuery(id: string) {
  return useQuery({ queryKey: queryKeys.documents.detail(id), queryFn: () => getDocument(id), enabled: !!id })
}

export function useUploadDocumentMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UploadDocumentPayload) => uploadDocument(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.documents.lists() }),
  })
}

export function useDeleteDocumentMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteDocument(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.documents.lists() }),
  })
}
