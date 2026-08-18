// src/modules/documents/components/DocumentPreviewCard.tsx
// Real inline preview via the real presigned download URL (GET /documents/:id/download) - images
// render directly, PDFs render in the browser's native PDF viewer via an iframe. Every other mime
// type gets an honest "no inline preview" state pointing at Download, rather than a fake generic
// document-viewer. The URL is only fetched when the file is actually previewable (see
// useDocumentDownloadUrlQuery's `enabled` gate) - no presigned URL is generated for a .xlsx nobody
// is about to preview inline.
import { FileText } from 'lucide-react'
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { Spinner, ErrorState, EmptyState } from '@/components/feedback'
import { normalizeApiError } from '@/services/api-error'
import { useDocumentDownloadUrlQuery } from '../hooks'
import type { DocumentFile } from '../types'

export interface DocumentPreviewCardProps {
  document: DocumentFile
}

export function DocumentPreviewCard({ document }: DocumentPreviewCardProps) {
  const isImage = document.mimeType.startsWith('image/')
  const isPdf = document.mimeType === 'application/pdf'
  const previewable = isImage || isPdf

  const { data, isLoading, isError, error, refetch } = useDocumentDownloadUrlQuery(document.id, previewable)

  return (
    <Card>
      <CardHeader title="Preview" />
      {!previewable ? (
        <EmptyState
          icon={FileText}
          title="No inline preview available"
          description={`Preview isn't supported for ${document.mimeType} files yet - use Download to open it.`}
        />
      ) : isLoading ? (
        <Spinner fullScreen={false} label="Loading preview…" className="py-10" />
      ) : isError ? (
        <ErrorState
          title="Couldn't load the preview"
          message={normalizeApiError(error).message}
          onRetry={refetch}
          className="py-8"
        />
      ) : isImage && data ? (
        <img
          src={data.url}
          alt={document.fileName}
          className="max-h-[420px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] object-contain bg-[var(--color-surface)]"
        />
      ) : isPdf && data ? (
        <iframe
          src={data.url}
          title={document.fileName}
          className="w-full h-[420px] rounded-[var(--radius-md)] border border-[var(--color-border)]"
        />
      ) : null}
    </Card>
  )
}
