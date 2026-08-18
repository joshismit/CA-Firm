// src/modules/crm/components/CRMPipelineSummary.tsx
// Real aggregates computed from the leads the caller already fetched - no aggregate/analytics
// endpoint exists on the CRM backend. `capped` tells the caller whether more leads exist than were
// fetched (backend PAGINATION.MAX_LIMIT is 100), so the summary is never silently presented as
// exhaustive beyond what it actually covers.
import { IndianRupee, Target, TrendingUp, ListChecks } from 'lucide-react'
import { StatCard, StatsGrid } from '@/components/shared/StatCard/StatCard'
import { formatCompactINR } from '@/lib/utils'
import type { Lead } from '../types'

export interface CRMPipelineSummaryProps {
  leads: Lead[]
  totalCount: number
  isLoading?: boolean
  isError?: boolean
}

export function CRMPipelineSummary({ leads, totalCount, isLoading, isError }: CRMPipelineSummaryProps) {
  const capped = totalCount > leads.length

  const totalRevenue = leads.reduce((sum, lead) => sum + (lead.expectedRevenue ?? 0), 0)
  const weightedRevenue = leads.reduce(
    (sum, lead) => sum + (lead.expectedRevenue ?? 0) * ((lead.probability ?? 0) / 100),
    0
  )
  const avgProbability =
    leads.length === 0
      ? 0
      : Math.round(leads.reduce((sum, lead) => sum + (lead.probability ?? 0), 0) / leads.length)

  const hint = capped ? `Of ${totalCount} leads (showing ${leads.length})` : undefined

  return (
    <StatsGrid>
      <StatCard
        label="Leads in view"
        value={leads.length}
        hint={capped ? `${totalCount} total` : undefined}
        isLoading={isLoading}
        isError={isError}
        icon={ListChecks}
      />
      <StatCard
        label="Pipeline Value"
        value={formatCompactINR(totalRevenue)}
        hint={hint}
        isLoading={isLoading}
        isError={isError}
        icon={IndianRupee}
      />
      <StatCard
        label="Weighted Pipeline"
        value={formatCompactINR(weightedRevenue)}
        hint="Revenue × probability"
        isLoading={isLoading}
        isError={isError}
        icon={TrendingUp}
      />
      <StatCard
        label="Avg. Probability"
        value={`${avgProbability}%`}
        hint={hint}
        isLoading={isLoading}
        isError={isError}
        icon={Target}
      />
    </StatsGrid>
  )
}
