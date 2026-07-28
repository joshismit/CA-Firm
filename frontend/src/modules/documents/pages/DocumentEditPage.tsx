// src/modules/documents/pages/DocumentEditPage.tsx
// Genuine architectural gap, surfaced honestly rather than worked around: the locked documents/api
// and documents/hooks layers have no updateDocument function or PATCH endpoint stub at all (unlike
// every other module, which at least has a NOT_IMPLEMENTED-throwing placeholder for every CRUD
// verb). There is nothing to submit an edit to, so this page loads the real document and explains
// that clearly via the shared ErrorState, then shows its current metadata read-only via DocumentForm
// in view mode - it does not call a fabricated mutation or simulate a save.
import { useParams } from 'react-router-dom'
import { PageLayout, PageHeader, PageContent } from '@/components/page'
import { Card } from '@/components/shared/Card/Card'
import { Spinner, ErrorState } from '@/components/feedback'
import { normalizeApiError } from '@/services/api-error'
import { useDocumentQuery } from '../hooks'
import { DocumentForm } from '../components'

export function DocumentEditPage() {
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
      <PageHeader title={`Edit ${document.fileName}`} />
      <PageContent>
        <Card>
          <ErrorState
            title="Editing isn't available yet"
            message="Documents API does not yet support updating an existing document's metadata (no update endpoint exists). Delete and re-upload to make changes."
            className="py-8"
          />
        </Card>
        <Card>
          <DocumentForm mode="view" document={document} />
        </Card>
      </PageContent>
    </PageLayout>
  )
}
