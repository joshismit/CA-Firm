// src/modules/documents/pages/DocumentUploadPage.tsx
// Multi-file upload queue: shared category/business/contact/folder metadata (matching what
// createDocumentSchema actually accepts), a Dropzone to add files, and a real per-file progress bar
// driven by Axios's onUploadProgress (see documents/api's uploadDocument()) - files upload
// sequentially, one real POST /documents call each, so a failure on one file doesn't abort the rest.
//
// `location.state` optionally prefills business/category/folder - set by DocumentFoldersPage's
// "Upload here" button (PRD §7.1 rule 5: folder is optional at upload, but when the user arrived
// from a specific folder, defaulting to it is the obviously-correct UX).
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PageLayout, PageHeader, PageContent } from '@/components/page'
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/forms/FormField'
import { Dropzone, FileList, type UploadQueueItem } from '@/components/upload'
import { normalizeApiError } from '@/services/api-error'
import { useStorageSettingsQuery } from '@/modules/settings/hooks'
import { useFoldersQuery, useUploadDocumentMutation } from '../hooks'
import { DOCUMENT_CATEGORY_OPTIONS, SUPPORTED_FILE_TYPES_ACCEPT, SUPPORTED_FILE_TYPES_HINT, isSupportedDocumentFile } from '../constants'
import type { DocumentCategory, DocumentConflict } from '../types'

/** A "replacement candidate detected" (PRD §7.2 rule 6) response's `details` payload, narrowed from `unknown`. */
function asDocumentConflict(details: unknown): DocumentConflict | undefined {
  if (details && typeof details === 'object' && 'currentVersion' in details && 'nextVersion' in details) {
    return details as DocumentConflict
  }
  return undefined
}

interface UploadPagePrefill {
  businessId?: string
  category?: DocumentCategory
  folderId?: string
}

const NO_FOLDER_OPTION = { value: '__none__', label: 'No folder (category root)' }

export function DocumentUploadPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const prefill = (location.state as UploadPagePrefill | null) ?? null
  const uploadMutation = useUploadDocumentMutation()
  // PRD §7.4 — surfaced as a friendly upfront hint; the backend remains the source of truth and
  // still enforces the real limit (`FILE_TOO_LARGE`/`PLAN_LIMIT_EXCEEDED`, shown per-file below via
  // the existing `apiError.message` path if a file slips past this hint).
  const storageSettingsQuery = useStorageSettingsQuery()

  const [category, setCategory] = useState<DocumentCategory | undefined>(prefill?.category)
  const [businessId, setBusinessId] = useState(prefill?.businessId ?? '')
  const [contactId, setContactId] = useState('')
  const [folderId, setFolderId] = useState(prefill?.folderId ?? '')
  const [queue, setQueue] = useState<UploadQueueItem[]>([])
  const [isUploading, setIsUploading] = useState(false)
  /** PRD §7.2 rule 6 - queued items whose upload 409'd as a "replacement candidate", keyed by queue item id. */
  const [conflicts, setConflicts] = useState<Record<string, DocumentConflict>>({})

  // Folder is only ever meaningful once both businessId and category are known - a folder is
  // always rooted at exactly one Business+category (see backend's DocumentFolder model).
  const foldersQuery = useFoldersQuery(businessId, category ? { category } : {})
  const folderOptions = businessId && category ? [NO_FOLDER_OPTION, ...(foldersQuery.data ?? []).map((f) => ({ value: f.id, label: f.name }))] : []

  const patchItem = (id: string, patch: Partial<UploadQueueItem>) => {
    setQueue((q) => q.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const handleFilesSelected = (files: File[]) => {
    const maxUploadSizeMb = storageSettingsQuery.data?.maxUploadSizeMb
    const maxUploadSizeBytes = maxUploadSizeMb ? maxUploadSizeMb * 1024 * 1024 : undefined

    // PRD §7.4/§7.5 — friendly upfront rejection for files that clearly exceed the limit or are an
    // unsupported type, so the user doesn't wait through an upload attempt just to see the same
    // error from the backend. Files that pass both checks (or any file before the size limit has
    // loaded) still go through the real backend check — this is a UX head start, not the
    // enforcement itself.
    const items: UploadQueueItem[] = files.map((file) => {
      const tooLarge = maxUploadSizeBytes !== undefined && file.size > maxUploadSizeBytes
      const unsupportedType = !isSupportedDocumentFile(file)
      return {
        id: crypto.randomUUID(),
        file,
        status: tooLarge || unsupportedType ? 'error' : 'queued',
        progress: 0,
        error: tooLarge
          ? `File exceeds the maximum upload size (${maxUploadSizeMb} MB). Choose a smaller file.`
          : unsupportedType
            ? `Unsupported file type. Supported types: ${SUPPORTED_FILE_TYPES_HINT}.`
            : undefined,
      }
    })
    setQueue((q) => [...q, ...items])
  }

  const removeItem = (id: string) => setQueue((q) => q.filter((item) => item.id !== id))

  const uploadOne = async (item: UploadQueueItem, createVersion: boolean) => {
    patchItem(item.id, { status: 'uploading', progress: 0 })
    setConflicts((c) => {
      const { [item.id]: _removed, ...rest } = c
      return rest
    })
    try {
      // eslint-disable-next-line no-await-in-loop -- sequential by design, see file header comment.
      await uploadMutation.mutateAsync({
        payload: {
          file: item.file,
          category: category as DocumentCategory,
          businessId: businessId || undefined,
          contactId: contactId || undefined,
          folderId: folderId || undefined,
          createVersion,
        },
        onUploadProgress: (percent) => patchItem(item.id, { progress: percent }),
      })
      patchItem(item.id, { status: 'success', progress: 100 })
    } catch (err) {
      const apiError = normalizeApiError(err)
      const conflict = apiError.status === 409 ? asDocumentConflict(apiError.details) : undefined
      if (conflict) {
        setConflicts((c) => ({ ...c, [item.id]: conflict }))
        patchItem(item.id, {
          status: 'error',
          error: `"${item.file.name}" already exists as v${conflict.currentVersion.version}. Replace it below to create v${conflict.nextVersion}.`,
        })
      } else {
        patchItem(item.id, { status: 'error', error: apiError.message })
      }
    }
  }

  const handleUploadAll = async () => {
    if (!category) return
    setIsUploading(true)

    const maxUploadSizeMb = storageSettingsQuery.data?.maxUploadSizeMb
    const maxUploadSizeBytes = maxUploadSizeMb ? maxUploadSizeMb * 1024 * 1024 : undefined

    for (const item of queue) {
      if (item.status === 'success') continue
      // A file already known to exceed the limit or be an unsupported type will fail again
      // identically — neither can change between clicks, so retrying either is a pointless round
      // trip. Anything else (including a prior *server-side* rejection) still gets a real attempt.
      if (maxUploadSizeBytes !== undefined && item.file.size > maxUploadSizeBytes) continue
      if (!isSupportedDocumentFile(item.file)) continue
      // eslint-disable-next-line no-await-in-loop -- sequential by design, see file header comment.
      await uploadOne(item, false)
    }

    setIsUploading(false)
  }

  /** PRD §7.2 rule 7 - the queued file already 409'd once; re-upload it with `createVersion: true` to confirm. */
  const handleConfirmReplace = (item: UploadQueueItem) => uploadOne(item, true)

  const pendingCount = queue.filter((item) => item.status !== 'success').length
  const allDone = queue.length > 0 && pendingCount === 0

  return (
    <PageLayout>
      <PageHeader title="Upload Documents" description="Add one or more documents to your firm's vault." />
      <PageContent>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Metadata" />
            <p className="text-[12px] text-[var(--color-text-muted)] mb-4">Applied to every file in this batch.</p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <FormField label="Category" htmlFor="category">
                <Select
                  value={category}
                  onChange={(value) => {
                    setCategory(value as DocumentCategory)
                    setFolderId('')
                  }}
                  options={DOCUMENT_CATEGORY_OPTIONS}
                  disabled={isUploading}
                  placeholder="Select category"
                />
              </FormField>
              <FormField label="Business ID" htmlFor="businessId">
                <Input
                  id="businessId"
                  value={businessId}
                  disabled={isUploading}
                  onChange={(e) => {
                    setBusinessId(e.target.value)
                    setFolderId('')
                  }}
                  placeholder="UUID - optional"
                />
              </FormField>
              <FormField label="Contact ID" htmlFor="contactId">
                <Input
                  id="contactId"
                  value={contactId}
                  disabled={isUploading}
                  onChange={(e) => setContactId(e.target.value)}
                  placeholder="UUID - optional"
                />
              </FormField>
              <FormField label="Folder" htmlFor="folderId">
                <Select
                  value={folderId || NO_FOLDER_OPTION.value}
                  onChange={(value) => setFolderId(value === NO_FOLDER_OPTION.value ? '' : value)}
                  options={folderOptions}
                  disabled={isUploading || folderOptions.length === 0}
                  placeholder={businessId && category ? 'No folder' : 'Set Business + category first'}
                />
              </FormField>
            </div>
          </Card>

          <Card>
            <CardHeader title="Files" />
            <div className="space-y-4">
              <Dropzone
                onFilesSelected={handleFilesSelected}
                disabled={isUploading}
                accept={SUPPORTED_FILE_TYPES_ACCEPT}
                hint={
                  storageSettingsQuery.data
                    ? `${SUPPORTED_FILE_TYPES_HINT} · up to ${storageSettingsQuery.data.maxUploadSizeMb} MB per file`
                    : SUPPORTED_FILE_TYPES_HINT
                }
              />

              <FileList items={queue} onRemove={isUploading ? undefined : removeItem} />

              {Object.entries(conflicts).map(([itemId, conflict]) => {
                const item = queue.find((q) => q.id === itemId)
                if (!item) return null
                return (
                  <div
                    key={itemId}
                    className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] p-3"
                  >
                    <p className="text-[12px] text-[var(--color-warning-fg)]">
                      Replacement candidate detected — "{item.file.name}" already exists (current version v
                      {conflict.currentVersion.version}). Confirm to upload as v{conflict.nextVersion}.
                    </p>
                    <Button variant="outline" size="sm" onClick={() => handleConfirmReplace(item)} disabled={isUploading}>
                      Replace (create v{conflict.nextVersion})
                    </Button>
                  </div>
                )
              })}

              {!category && queue.length > 0 && (
                <p className="text-[12px] text-[var(--color-danger)]">Select a category before uploading.</p>
              )}

              {queue.length > 0 && (
                <div className="flex justify-end gap-2">
                  {allDone ? (
                    <Button onClick={() => navigate('/documents')}>Done</Button>
                  ) : (
                    <Button onClick={handleUploadAll} loading={isUploading} disabled={!category || pendingCount === 0}>
                      Upload {pendingCount} file{pendingCount === 1 ? '' : 's'}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>
      </PageContent>
    </PageLayout>
  )
}
