// src/modules/audit/components/AuditStatsCards.tsx
// Same real, separately-cached GET+limit=1 pattern as BusinessStatsCards - each card reads
// `meta.total` off its own filtered query rather than a dedicated stats endpoint.
import { Activity, LogIn, Upload, ShieldAlert } from 'lucide-react'
import { StatCard, StatsGrid } from '@/components/shared/StatCard/StatCard'
import { useAuditLogsQuery } from '../hooks'

export function AuditStatsCards() {
  const total = useAuditLogsQuery({ page: 1, limit: 1 })
  const logins = useAuditLogsQuery({ page: 1, limit: 1, eventType: 'LOGIN' })
  const uploads = useAuditLogsQuery({ page: 1, limit: 1, eventType: 'UPLOAD' })
  const roleChanges = useAuditLogsQuery({ page: 1, limit: 1, eventType: 'ROLE_CHANGE' })

  return (
    <StatsGrid>
      <StatCard label="Total Events" value={total.data?.meta.total ?? 0} isLoading={total.isLoading} isError={total.isError} icon={Activity} />
      <StatCard label="Logins" value={logins.data?.meta.total ?? 0} isLoading={logins.isLoading} isError={logins.isError} icon={LogIn} />
      <StatCard label="Uploads" value={uploads.data?.meta.total ?? 0} isLoading={uploads.isLoading} isError={uploads.isError} icon={Upload} />
      <StatCard label="Role Changes" value={roleChanges.data?.meta.total ?? 0} isLoading={roleChanges.isLoading} isError={roleChanges.isError} icon={ShieldAlert} />
    </StatsGrid>
  )
}
