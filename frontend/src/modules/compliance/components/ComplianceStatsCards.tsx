// src/modules/compliance/components/ComplianceStatsCards.tsx
// Same real, separately-cached GET+limit=1 pattern as BusinessStatsCards/ProjectStatsCards - except
// every one of these calls genuinely 501s (no backend module exists yet), so StatCard's existing
// isError branch renders "—" honestly instead of a fabricated number.
import { FileStack, CheckCircle2, Clock, AlertTriangle } from 'lucide-react'
import { StatCard, StatsGrid } from '@/components/shared/StatCard/StatCard'
import { useComplianceFilingsQuery } from '../hooks'
import type { ComplianceModuleKey } from '../types'

export interface ComplianceStatsCardsProps {
  moduleKey: ComplianceModuleKey
}

export function ComplianceStatsCards({ moduleKey }: ComplianceStatsCardsProps) {
  const total = useComplianceFilingsQuery(moduleKey, { page: 1, limit: 1 })
  const filed = useComplianceFilingsQuery(moduleKey, { page: 1, limit: 1, status: 'FILED' })
  const pending = useComplianceFilingsQuery(moduleKey, { page: 1, limit: 1, status: 'PENDING' })
  const overdue = useComplianceFilingsQuery(moduleKey, { page: 1, limit: 1, status: 'OVERDUE' })

  return (
    <StatsGrid>
      <StatCard
        label="Total Filings"
        value={total.data?.meta.total ?? 0}
        isLoading={total.isLoading}
        isError={total.isError}
        icon={FileStack}
      />
      <StatCard
        label="Filed"
        value={filed.data?.meta.total ?? 0}
        isLoading={filed.isLoading}
        isError={filed.isError}
        icon={CheckCircle2}
      />
      <StatCard
        label="Pending"
        value={pending.data?.meta.total ?? 0}
        isLoading={pending.isLoading}
        isError={pending.isError}
        icon={Clock}
      />
      <StatCard
        label="Overdue"
        value={overdue.data?.meta.total ?? 0}
        isLoading={overdue.isLoading}
        isError={overdue.isError}
        icon={AlertTriangle}
      />
    </StatsGrid>
  )
}
