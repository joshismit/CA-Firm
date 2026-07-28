// src/modules/crm/pages/CRMEditPage.tsx
import { useNavigate, useParams } from 'react-router-dom'
import { PageLayout, PageHeader, PageContent } from '@/components/page'
import { Card } from '@/components/shared/Card/Card'
import { Spinner, ErrorState } from '@/components/feedback'
import { normalizeApiError } from '@/services/api-error'
import { useLeadQuery, useUpdateLeadMutation } from '../hooks'
import { CRMForm } from '../components'
import type { CreateLeadFormValues } from '../schemas'
import type { UpdateLeadPayload } from '../types'

export function CRMEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: lead, isLoading, isError, error, refetch } = useLeadQuery(id!)
  const updateMutation = useUpdateLeadMutation(id!)

  if (isLoading) {
    return (
      <PageLayout>
        <Spinner fullScreen={false} label="Loading lead…" className="py-16" />
      </PageLayout>
    )
  }

  if (isError || !lead) {
    return (
      <PageLayout>
        <ErrorState
          title="Couldn't load this lead"
          message={error ? normalizeApiError(error).message : 'Lead not found.'}
          onRetry={refetch}
        />
      </PageLayout>
    )
  }

  const handleSubmit = (values: CreateLeadFormValues) => {
    const payload: UpdateLeadPayload = {
      businessId: values.businessId || undefined,
      contactId: values.contactId || undefined,
      title: values.title,
      sourceId: values.sourceId,
      stageId: values.stageId,
      expectedRevenue: values.expectedRevenue,
      probability: values.probability,
      expectedCloseDate: values.expectedCloseDate ? values.expectedCloseDate.toISOString() : undefined,
    }
    updateMutation.mutate(payload, {
      onSuccess: () => navigate(`/crm/${id}`),
    })
  }

  return (
    <PageLayout>
      <PageHeader title={`Edit ${lead.title}`} />
      <PageContent>
        <Card>
          <CRMForm
            mode="edit"
            lead={lead}
            onSubmit={handleSubmit}
            isSubmitting={updateMutation.isPending}
            submitError={updateMutation.isError ? normalizeApiError(updateMutation.error).message : undefined}
          />
        </Card>
      </PageContent>
    </PageLayout>
  )
}
