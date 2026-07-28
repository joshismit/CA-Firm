// src/modules/business/pages/BusinessCreatePage.tsx
import { useNavigate } from 'react-router-dom'
import { PageLayout, PageHeader, PageContent } from '@/components/page'
import { Card } from '@/components/shared/Card/Card'
import { normalizeApiError } from '@/services/api-error'
import { useCreateBusinessMutation } from '../hooks'
import { BusinessForm } from '../components'
import type { CreateBusinessFormValues } from '../schemas'
import type { CreateBusinessPayload } from '../types'

export function BusinessCreatePage() {
  const navigate = useNavigate()
  const createMutation = useCreateBusinessMutation()

  const handleSubmit = (values: CreateBusinessFormValues) => {
    const payload: CreateBusinessPayload = {
      typeId: values.typeId,
      name: values.name,
      legalName: values.legalName || undefined,
      pan: values.pan || undefined,
      gstin: values.gstin || undefined,
      cin: values.cin || undefined,
      incorporationDate: values.incorporationDate ? values.incorporationDate.toISOString() : undefined,
      financialYearStart: values.financialYearStart,
      industry: values.industry || undefined,
    }
    createMutation.mutate(payload, {
      onSuccess: (business) => navigate(`/business/${business.id}`),
    })
  }

  return (
    <PageLayout>
      <PageHeader title="New Business" description="Add a business to your firm's client base." />
      <PageContent>
        <Card>
          <BusinessForm
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
