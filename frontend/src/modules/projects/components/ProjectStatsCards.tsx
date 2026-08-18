// src/modules/projects/components/ProjectStatsCards.tsx
// Real counts, not fabricated: Total/Active/Completed come from `meta.total` on a real, separately-
// cached GET /projects call (limit=1), same pattern as BusinessStatsCards. Overdue comes from the
// real, dedicated GET /projects/overdue endpoint's array length - not a client-side date scan -
// since the list endpoint has no `overdue` filter of its own.
import { Briefcase, PlayCircle, CheckCircle2, AlertTriangle } from 'lucide-react'
import { StatCard, StatsGrid } from '@/components/shared/StatCard/StatCard'
import { useProjectsQuery, useOverdueProjectsQuery } from '../hooks'

export function ProjectStatsCards() {
  const total = useProjectsQuery({ page: 1, limit: 1 })
  const active = useProjectsQuery({ page: 1, limit: 1, status: 'ACTIVE' })
  const completed = useProjectsQuery({ page: 1, limit: 1, status: 'COMPLETED' })
  const overdue = useOverdueProjectsQuery()

  return (
    <StatsGrid>
      <StatCard
        label="Total Projects"
        value={total.data?.meta.total ?? 0}
        isLoading={total.isLoading}
        isError={total.isError}
        icon={Briefcase}
      />
      <StatCard
        label="Active"
        value={active.data?.meta.total ?? 0}
        isLoading={active.isLoading}
        isError={active.isError}
        icon={PlayCircle}
      />
      <StatCard
        label="Completed"
        value={completed.data?.meta.total ?? 0}
        isLoading={completed.isLoading}
        isError={completed.isError}
        icon={CheckCircle2}
      />
      <StatCard
        label="Overdue"
        value={overdue.data?.length ?? 0}
        isLoading={overdue.isLoading}
        isError={overdue.isError}
        icon={AlertTriangle}
      />
    </StatsGrid>
  )
}
