// src/modules/crm/pages/CRMDetailPage.tsx
import { useParams } from 'react-router-dom'
import { PageLayout, PageContent } from '@/components/page'
import { Spinner, ErrorState } from '@/components/feedback'
import { normalizeApiError } from '@/services/api-error'
import { useLeadQuery, useLeadStagesQuery } from '../hooks'
import { CRMHeader, CRMOverviewCard, CRMBusinessCard, CRMTimelineCard, CRMActivityCard } from '../components'

export function CRMDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: lead, isLoading, isError, error, refetch } = useLeadQuery(id!)
  const stagesQuery = useLeadStagesQuery()

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

  const stageName = stagesQuery.data?.find((s) => s.id === lead.stageId)?.name

  return (
    <PageLayout>
      <CRMHeader lead={lead} stageName={stageName} />

      <PageContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <CRMOverviewCard lead={lead} stageName={stageName} />
            <CRMBusinessCard businessId={lead.businessId} />
            <CRMActivityCard leadId={lead.id} />
          </div>
          <div className="space-y-4">
            <CRMTimelineCard lead={lead} />
          </div>
        </div>
      </PageContent>
    </PageLayout>
  )
}
