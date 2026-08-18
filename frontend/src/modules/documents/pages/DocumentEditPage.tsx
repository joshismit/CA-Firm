// src/modules/documents/pages/DocumentEditPage.tsx
import { useNavigate, useParams } from 'react-router-dom'
import { PageLayout, PageHeader, PageContent } from '@/components/page'
import { Card } from '@/components/shared/Card/Card'
import { Spinner, ErrorState } from '@/components/feedback'
import { normalizeApiError } from '@/services/api-error'
import { useDocumentQuery, useUpdateDocumentMutation } from '../hooks'
import { DocumentForm } from '../components'
import type { UpdateDocumentFormValues } from '../schemas'

export function DocumentEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: document, isLoading, isError, error, refetch } = useDocumentQuery(id!)
  const updateMutation = useUpdateDocumentMutation(id!)

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

  const handleSubmit = (values: UpdateDocumentFormValues) => {
    updateMutation.mutate(values, {
      onSuccess: () => navigate(`/documents/${id}`),
    })
  }

  return (
    <PageLayout>
      <PageHeader title={`Edit ${document.fileName}`} />
      <PageContent>
        <Card>
          <DocumentForm
            mode="edit"
            document={document}
            onSubmitEdit={handleSubmit}
            isSubmitting={updateMutation.isPending}
            submitError={updateMutation.isError ? normalizeApiError(updateMutation.error).message : undefined}
          />
        </Card>
      </PageContent>
    </PageLayout>
  )
}
