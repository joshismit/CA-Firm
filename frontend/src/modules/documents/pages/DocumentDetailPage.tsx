// src/modules/documents/pages/DocumentDetailPage.tsx
import { useParams } from 'react-router-dom'
import { PageLayout, PageContent } from '@/components/page'
import { Spinner, ErrorState } from '@/components/feedback'
import { normalizeApiError } from '@/services/api-error'
import { useDocumentQuery } from '../hooks'
import {
  DocumentHeader,
  DocumentOverviewCard,
  DocumentPreviewCard,
  DocumentBusinessCard,
  DocumentMetadataCard,
  DocumentVersionCard,
  DocumentActivityCard,
} from '../components'

export function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: document, isLoading, isError, error, refetch } = useDocumentQuery(id!)

  if (isLoading) {
    return (
      <PageLayout>
        <Spinner fullScreen={false} label="Loading document…" className="py-16" />
      </PageLayout>
    )
  }

  if (isError || !document) {
    return (
      <PageLayout>
        <ErrorState
          title="Couldn't load this document"
          message={error ? normalizeApiError(error).message : 'Document not found.'}
          onRetry={refetch}
        />
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <DocumentHeader document={document} />

      <PageContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <DocumentPreviewCard document={document} />
            <DocumentOverviewCard document={document} />
            <DocumentBusinessCard businessId={document.businessId} />
            <DocumentMetadataCard document={document} />
          </div>
          <div className="space-y-4">
            <DocumentVersionCard document={document} />
            <DocumentActivityCard documentId={document.id} />
          </div>
        </div>
      </PageContent>
    </PageLayout>
  )
}
