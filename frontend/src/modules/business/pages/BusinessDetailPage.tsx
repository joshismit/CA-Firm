// src/modules/business/pages/BusinessDetailPage.tsx
import { useParams } from 'react-router-dom'
import { PageLayout, PageContent } from '@/components/page'
import { Spinner, ErrorState } from '@/components/feedback'
import { normalizeApiError } from '@/services/api-error'
import { useBusinessQuery } from '../hooks'
import {
  BusinessHeader,
  BusinessOverviewCard,
  BusinessInformationCard,
  BusinessContactsCard,
  BusinessDocumentsCard,
  BusinessTimelineCard,
} from '../components'

export function BusinessDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: business, isLoading, isError, error, refetch } = useBusinessQuery(id!)

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

  return (
    <PageLayout>
      <BusinessHeader business={business} />

      <PageContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <BusinessOverviewCard business={business} />
            <BusinessInformationCard business={business} />
            <BusinessContactsCard businessId={business.id} />
            <BusinessDocumentsCard businessId={business.id} />
          </div>
          <div className="space-y-4">
            <BusinessTimelineCard business={business} />
          </div>
        </div>
      </PageContent>
    </PageLayout>
  )
}
