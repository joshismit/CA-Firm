// src/modules/roles/components/RoleStatsCards.tsx
// Same real, separately-cached GET+limit=1 pattern as BusinessStatsCards - except every one of
// these genuinely 501s (no backend module exists yet), so StatCard's existing isError branch
// renders "—" honestly instead of a fabricated number.
import { Shield, ShieldCheck, ShieldAlert } from 'lucide-react'
import { StatCard, StatsGrid } from '@/components/shared/StatCard/StatCard'
import { useRolesQuery } from '../hooks'

export function RoleStatsCards() {
  const total = useRolesQuery({ page: 1, limit: 1 })
  const system = useRolesQuery({ page: 1, limit: 1, type: 'SYSTEM' })
  const custom = useRolesQuery({ page: 1, limit: 1, type: 'CUSTOM' })

  return (
    <StatsGrid className="sm:grid-cols-3 lg:grid-cols-3">
      <StatCard label="Total Roles" value={total.data?.meta.total ?? 0} isLoading={total.isLoading} isError={total.isError} icon={Shield} />
      <StatCard label="System Roles" value={system.data?.meta.total ?? 0} isLoading={system.isLoading} isError={system.isError} icon={ShieldCheck} />
      <StatCard label="Custom Roles" value={custom.data?.meta.total ?? 0} isLoading={custom.isLoading} isError={custom.isError} icon={ShieldAlert} />
    </StatsGrid>
  )
}
