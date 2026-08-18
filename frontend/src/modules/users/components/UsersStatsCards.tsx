// src/modules/users/components/UsersStatsCards.tsx
// Same real, separately-cached GET+limit=1 pattern as BusinessStatsCards - except every one of
// these genuinely 501s (no backend module exists yet), so StatCard's existing isError branch
// renders "—" honestly instead of a fabricated number.
import { Users as UsersIcon, CheckCircle2, Mail, UserX } from 'lucide-react'
import { StatCard, StatsGrid } from '@/components/shared/StatCard/StatCard'
import { useUsersQuery } from '../hooks'

export function UsersStatsCards() {
  const total = useUsersQuery({ page: 1, limit: 1 })
  const active = useUsersQuery({ page: 1, limit: 1, status: 'ACTIVE' })
  const invited = useUsersQuery({ page: 1, limit: 1, status: 'INVITED' })
  const suspended = useUsersQuery({ page: 1, limit: 1, status: 'SUSPENDED' })

  return (
    <StatsGrid>
      <StatCard label="Total Users" value={total.data?.meta.total ?? 0} isLoading={total.isLoading} isError={total.isError} icon={UsersIcon} />
      <StatCard label="Active" value={active.data?.meta.total ?? 0} isLoading={active.isLoading} isError={active.isError} icon={CheckCircle2} />
      <StatCard label="Invited" value={invited.data?.meta.total ?? 0} isLoading={invited.isLoading} isError={invited.isError} icon={Mail} />
      <StatCard label="Suspended" value={suspended.data?.meta.total ?? 0} isLoading={suspended.isLoading} isError={suspended.isError} icon={UserX} />
    </StatsGrid>
  )
}
