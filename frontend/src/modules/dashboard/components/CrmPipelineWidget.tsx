// src/modules/dashboard/components/CrmPipelineWidget.tsx
// Extracted from DashboardPage.tsx's former inline "CRM Pipeline" Card so it can be a single,
// independently show/hide-able entry in the widget registry (see ../constants) - same real
// pipeline query as before, no behavior change.
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { useLeadsQuery } from '@/modules/crm/hooks'
import { CRMPipelineSummary } from '@/modules/crm/components/CRMPipelineSummary'

// CRM's own list page fetches up to this many leads to compute pipeline stats client-side (no
// aggregate endpoint exists) - mirrored here so the dashboard's preview matches that established
// "capped at 100" convention exactly (see CRMListPage.tsx / CRMPipelineSummary.tsx).
const CRM_PIPELINE_FETCH_LIMIT = 100

export function CrmPipelineWidget() {
  const pipelineQuery = useLeadsQuery({ page: 1, limit: CRM_PIPELINE_FETCH_LIMIT })

  return (
    <Card>
      <CardHeader title="CRM Pipeline" />
      <CRMPipelineSummary
        leads={pipelineQuery.data?.data ?? []}
        totalCount={pipelineQuery.data?.meta.total ?? 0}
        isLoading={pipelineQuery.isLoading}
        isError={pipelineQuery.isError}
      />
    </Card>
  )
}
