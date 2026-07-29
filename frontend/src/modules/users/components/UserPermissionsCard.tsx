// src/modules/users/components/UserPermissionsCard.tsx
// Effective permissions are derived client-side from this same user's already-fetched roles (each
// Role carries its own real permissionCodes) rather than a second, separate API call - there is no
// dedicated "effective permissions for user X" endpoint to invent, and computing the union here
// avoids fetching the same underlying data twice.
import { KeyRound } from 'lucide-react'
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { StatusBadge } from '@/components/shared/StatusBadge/StatusBadge'
import { Spinner, ErrorState, EmptyState } from '@/components/feedback'
import { normalizeApiError } from '@/services/api-error'
import { useUserRolesQuery } from '../hooks'

export interface UserPermissionsCardProps {
  userId: string
}

export function UserPermissionsCard({ userId }: UserPermissionsCardProps) {
  const { data: roles, isLoading, isError, error, refetch } = useUserRolesQuery(userId)

  const permissionCodes = Array.from(new Set((roles ?? []).flatMap((role) => role.permissionCodes))).sort()

  return (
    <Card>
      <CardHeader title="Effective Permissions" action={<span className="text-[11px] text-[var(--color-text-muted)]">Via assigned roles</span>} />
      {isLoading ? (
        <Spinner fullScreen={false} label="Loading permissions…" className="py-8" />
      ) : isError ? (
        <ErrorState title="Couldn't load permissions" message={normalizeApiError(error).message} onRetry={refetch} className="py-8" />
      ) : permissionCodes.length === 0 ? (
        <EmptyState icon={KeyRound} title="No permissions" description="Permissions granted through this user's roles will appear here." />
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {permissionCodes.map((code) => (
            <StatusBadge key={code} variant="default" className="font-mono">
              {code}
            </StatusBadge>
          ))}
        </div>
      )}
    </Card>
  )
}
