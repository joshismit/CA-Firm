// src/modules/permissions/components/PermissionStatsCards.tsx
// listPermissions() returns the full catalog in one call (not paginated) - all four stats are
// derived from that single fetch plus listPermissionGroups(), rather than four separate queries,
// to avoid duplicate fetching of the same underlying data. Every value is honestly "—" while
// either call is loading/erroring (both currently 501, since no backend module exists yet).
import { KeyRound, ShieldAlert, Boxes, Layers } from 'lucide-react'
import { StatCard, StatsGrid } from '@/components/shared/StatCard/StatCard'
import { usePermissionsQuery, usePermissionGroupsQuery } from '../hooks'

export function PermissionStatsCards() {
  const permissionsQuery = usePermissionsQuery()
  const groupsQuery = usePermissionGroupsQuery()

  const total = permissionsQuery.data?.length ?? 0
  const sensitive = permissionsQuery.data?.filter((p) => p.isSensitive).length ?? 0
  const resourceCount = new Set(permissionsQuery.data?.map((p) => p.resource)).size

  return (
    <StatsGrid>
      <StatCard label="Total Permissions" value={total} isLoading={permissionsQuery.isLoading} isError={permissionsQuery.isError} icon={KeyRound} />
      <StatCard label="Sensitive" value={sensitive} isLoading={permissionsQuery.isLoading} isError={permissionsQuery.isError} icon={ShieldAlert} />
      <StatCard label="Resources" value={resourceCount} isLoading={permissionsQuery.isLoading} isError={permissionsQuery.isError} icon={Boxes} />
      <StatCard label="Groups" value={groupsQuery.data?.length ?? 0} isLoading={groupsQuery.isLoading} isError={groupsQuery.isError} icon={Layers} />
    </StatsGrid>
  )
}
