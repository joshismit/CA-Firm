// src/modules/documents/pages/DocumentUploadPage.tsx
// Multi-file upload queue: shared category/business/contact metadata (matching what
// createDocumentSchema actually accepts), a Dropzone to add files, and a real per-file progress bar
// driven by Axios's onUploadProgress (see documents/api's uploadDocument()) - files upload
// sequentially, one real POST /documents call each, so a failure on one file doesn't abort the rest.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageLayout, PageHeader, PageContent } from '@/components/page'
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/forms/FormField'
import { Dropzone, FileList, type UploadQueueItem } from '@/components/upload'
import { normalizeApiError } from '@/services/api-error'
import { useUploadDocumentMutation } from '../hooks'
import { DOCUMENT_CATEGORY_OPTIONS, SUPPORTED_MIME_TYPES } from '../constants'
import type { DocumentCategory } from '../types'

export function DocumentUploadPage() {
  const navigate = useNavigate()
  const uploadMutation = useUploadDocumentMutation()

  const [category, setCategory] = useState<DocumentCategory | undefined>()
  const [businessId, setBusinessId] = useState('')
  const [contactId, setContactId] = useState('')
  const [queue, setQueue] = useState<UploadQueueItem[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const patchItem = (id: string, patch: Partial<UploadQueueItem>) => {
    setQueue((q) => q.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const handleFilesSelected = (files: File[]) => {
    const items: UploadQueueItem[] = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: 'queued',
      progress: 0,
    }))
    setQueue((q) => [...q, ...items])
  }

  const removeItem = (id: string) => setQueue((q) => q.filter((item) => item.id !== id))

  const handleUploadAll = async () => {
    if (!category) return
    setIsUploading(true)

    for (const item of queue) {
      if (item.status === 'success') continue
      patchItem(item.id, { status: 'uploading', progress: 0 })
      try {
        // eslint-disable-next-line no-await-in-loop -- sequential by design, see file header comment.
        await uploadMutation.mutateAsync({
          payload: { file: item.file, category, businessId: businessId || undefined, contactId: contactId || undefined },
          onUploadProgress: (percent) => patchItem(item.id, { progress: percent }),
        })
        patchItem(item.id, { status: 'success', progress: 100 })
      } catch (err) {
        patchItem(item.id, { status: 'error', error: normalizeApiError(err).message })
      }
    }

    setIsUploading(false)
  }

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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="Category" htmlFor="category">
                <Select
                  value={category}
                  onChange={(value) => setCategory(value as DocumentCategory)}
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
                  onChange={(e) => setBusinessId(e.target.value)}
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
            </div>
          </Card>

          <Card>
            <CardHeader title="Files" />
            <div className="space-y-4">
              <Dropzone
                onFilesSelected={handleFilesSelected}
                disabled={isUploading}
                accept={SUPPORTED_MIME_TYPES.join(',')}
                hint="PDF, Word, Excel, images, or ZIP"
              />

              <FileList items={queue} onRemove={isUploading ? undefined : removeItem} />

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
