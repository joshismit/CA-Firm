// src/modules/crm/pages/CRMCreatePage.tsx
import { useNavigate } from 'react-router-dom'
import { PageLayout, PageHeader, PageContent } from '@/components/page'
import { Card } from '@/components/shared/Card/Card'
import { normalizeApiError } from '@/services/api-error'
import { useCreateLeadMutation } from '../hooks'
import { CRMForm } from '../components'
import type { CreateLeadFormValues } from '../schemas'
import type { CreateLeadPayload } from '../types'

export function CRMCreatePage() {
  const navigate = useNavigate()
  const createMutation = useCreateLeadMutation()

  const handleSubmit = (values: CreateLeadFormValues) => {
    const payload: CreateLeadPayload = {
      businessId: values.businessId || undefined,
      contactId: values.contactId || undefined,
      title: values.title,
      sourceId: values.sourceId,
      stageId: values.stageId,
      expectedRevenue: values.expectedRevenue,
      probability: values.probability,
      expectedCloseDate: values.expectedCloseDate ? values.expectedCloseDate.toISOString() : undefined,
    }
    createMutation.mutate(payload, {
      onSuccess: (lead) => navigate(`/crm/${lead.id}`),
    })
  }

  return (
    <PageLayout>
      <PageHeader title="New Lead" description="Add a lead to your firm's CRM pipeline." />
      <PageContent>
        <Card>
          <CRMForm
            mode="create"
            onSubmit={handleSubmit}
            isSubmitting={createMutation.isPending}
            submitError={createMutation.isError ? normalizeApiError(createMutation.error).message : undefined}
          />
        </Card>
      </PageContent>
    </PageLayout>
  )
}
