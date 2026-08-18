// src/modules/master-admin/components/TenantStatsCards.tsx
// Same real, separately-cached GET+limit=1 pattern as ComplianceStatsCards - hits the real
// backend/src/modules/master-admin tenants endpoint, reading each bucket's count off `meta.total`
// rather than a dedicated stats endpoint.
import { Building2, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { StatCard, StatsGrid } from '@/components/shared/StatCard/StatCard'
import { useTenantsQuery } from '../hooks'

export function TenantStatsCards() {
  const total = useTenantsQuery({ page: 1, limit: 1 })
  const active = useTenantsQuery({ page: 1, limit: 1, status: 'ACTIVE' })
  const trial = useTenantsQuery({ page: 1, limit: 1, status: 'TRIAL' })
  const suspended = useTenantsQuery({ page: 1, limit: 1, status: 'SUSPENDED' })

  return (
    <StatsGrid>
      <StatCard label="Total Tenants" value={total.data?.meta.total ?? 0} isLoading={total.isLoading} isError={total.isError} icon={Building2} />
      <StatCard label="Active" value={active.data?.meta.total ?? 0} isLoading={active.isLoading} isError={active.isError} icon={CheckCircle2} />
      <StatCard label="On Trial" value={trial.data?.meta.total ?? 0} isLoading={trial.isLoading} isError={trial.isError} icon={Clock} />
      <StatCard label="Suspended" value={suspended.data?.meta.total ?? 0} isLoading={suspended.isLoading} isError={suspended.isError} icon={XCircle} />
    </StatsGrid>
  )
}
