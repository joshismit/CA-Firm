// src/modules/documents/pages/DocumentUploadPage.tsx
import { useNavigate } from 'react-router-dom'
import { PageLayout, PageHeader, PageContent } from '@/components/page'
import { Card } from '@/components/shared/Card/Card'
import { normalizeApiError } from '@/services/api-error'
import { useUploadDocumentMutation } from '../hooks'
import { DocumentForm } from '../components'
import type { UploadDocumentFormValues } from '../schemas'
import type { UploadDocumentPayload } from '../types'

export function DocumentUploadPage() {
  const navigate = useNavigate()
  const uploadMutation = useUploadDocumentMutation()

  const handleSubmit = (values: UploadDocumentFormValues) => {
    const payload: UploadDocumentPayload = {
      businessId: values.businessId,
      contactId: values.contactId,
      category: values.category,
      file: values.file,
    }
    uploadMutation.mutate(payload, {
      onSuccess: (document) => navigate(`/documents/${document.id}`),
    })
  }

  return (
    <PageLayout>
      <PageHeader title="Upload Document" description="Add a document to your firm's vault." />
      <PageContent>
        <Card>
          <DocumentForm
            mode="create"
            onSubmit={handleSubmit}
            isSubmitting={uploadMutation.isPending}
            submitError={uploadMutation.isError ? normalizeApiError(uploadMutation.error).message : undefined}
          />
        </Card>
      </PageContent>
    </PageLayout>
  )
}
