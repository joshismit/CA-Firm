// src/modules/business/pages/BusinessEditPage.tsx
import { useNavigate, useParams } from 'react-router-dom'
import { PageLayout, PageHeader, PageContent } from '@/components/page'
import { Card } from '@/components/shared/Card/Card'
import { Spinner, ErrorState } from '@/components/feedback'
import { normalizeApiError } from '@/services/api-error'
import { useBusinessQuery, useUpdateBusinessMutation } from '../hooks'
import { BusinessForm } from '../components'
import type { CreateBusinessFormValues } from '../schemas'
import type { UpdateBusinessPayload } from '../types'

export function BusinessEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: business, isLoading, isError, error, refetch } = useBusinessQuery(id!)
  const updateMutation = useUpdateBusinessMutation(id!)

  if (isLoading) {
    return (
      <PageLayout>
        <Spinner fullScreen={false} label="Loading business…" className="py-16" />
      </PageLayout>
    )
  }

  if (isError || !business) {
    return (
      <PageLayout>
        <ErrorState
          title="Couldn't load this business"
          message={error ? normalizeApiError(error).message : 'Business not found.'}
          onRetry={refetch}
        />
      </PageLayout>
    )
  }

  const handleSubmit = (values: CreateBusinessFormValues) => {
    const payload: UpdateBusinessPayload = {
      name: values.name,
      legalName: values.legalName || undefined,
      pan: values.pan || undefined,
      gstin: values.gstin || undefined,
      cin: values.cin || undefined,
      incorporationDate: values.incorporationDate ? values.incorporationDate.toISOString() : undefined,
      financialYearStart: values.financialYearStart,
      industry: values.industry || undefined,
    }
    updateMutation.mutate(payload, {
      onSuccess: () => navigate(`/business/${id}`),
    })
  }

  return (
    <PageLayout>
      <PageHeader title={`Edit ${business.name}`} />
      <PageContent>
        <Card>
          <BusinessForm
            mode="edit"
            business={business}
            onSubmit={handleSubmit}
            isSubmitting={updateMutation.isPending}
            submitError={updateMutation.isError ? normalizeApiError(updateMutation.error).message : undefined}
          />
        </Card>
      </PageContent>
    </PageLayout>
  )
}
