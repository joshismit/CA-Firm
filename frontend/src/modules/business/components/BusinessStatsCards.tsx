// src/modules/business/components/BusinessStatsCards.tsx
// Real counts, not fabricated: each tile is `meta.total` from a real, separately-cached
// GET /business call (limit=1, since only the pagination meta is needed) - the same
// useBusinessesQuery hook the list page already uses, just parameterized per status. No aggregate
// stats endpoint exists on the backend, so this is four small real queries rather than one invented
// summary call.
import { Building2, CheckCircle2, PauseCircle, Archive } from 'lucide-react'
import { StatCard, StatsGrid } from '@/components/shared/StatCard/StatCard'
import { useBusinessesQuery } from '../hooks'

export function BusinessStatsCards() {
  const total = useBusinessesQuery({ page: 1, limit: 1 })
  const active = useBusinessesQuery({ page: 1, limit: 1, status: 'ACTIVE' })
  const inactive = useBusinessesQuery({ page: 1, limit: 1, status: 'INACTIVE' })
  const dormant = useBusinessesQuery({ page: 1, limit: 1, status: 'DORMANT' })

  return (
    <StatsGrid>
      <StatCard
        label="Total Businesses"
        value={total.data?.meta.total ?? 0}
        isLoading={total.isLoading}
        isError={total.isError}
        icon={Building2}
      />
      <StatCard
        label="Active"
        value={active.data?.meta.total ?? 0}
        isLoading={active.isLoading}
        isError={active.isError}
        icon={CheckCircle2}
      />
      <StatCard
        label="Inactive"
        value={inactive.data?.meta.total ?? 0}
        isLoading={inactive.isLoading}
        isError={inactive.isError}
        icon={PauseCircle}
      />
      <StatCard
        label="Dormant"
        value={dormant.data?.meta.total ?? 0}
        isLoading={dormant.isLoading}
        isError={dormant.isError}
        icon={Archive}
      />
    </StatsGrid>
  )
}
