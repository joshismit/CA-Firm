// src/modules/roles/components/RoleUsersCard.tsx
// getRoleUsers always 501s (no backend module exists yet - see api/index.ts's header comment).
import { Link } from 'react-router-dom'
import { Users } from 'lucide-react'
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { Avatar } from '@/components/ui/avatar'
import { Spinner, ErrorState, EmptyState } from '@/components/feedback'
import { normalizeApiError } from '@/services/api-error'
import { useRoleUsersQuery } from '../hooks'

export interface RoleUsersCardProps {
  roleId: string
}

export function RoleUsersCard({ roleId }: RoleUsersCardProps) {
  const { data: users, isLoading, isError, error, refetch } = useRoleUsersQuery(roleId)

  return (
    <Card>
      <CardHeader title="Users with this role" />
      {isLoading ? (
        <Spinner fullScreen={false} label="Loading users…" className="py-8" />
      ) : isError ? (
        <ErrorState title="Couldn't load users" message={normalizeApiError(error).message} onRetry={refetch} className="py-8" />
      ) : !users || users.length === 0 ? (
        <EmptyState icon={Users} title="No users yet" description="Users assigned this role will appear here." />
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {users.map((user) => (
            <li key={user.id} className="py-2 first:pt-0 last:pb-0">
              <Link to={`/staff/users/${user.id}`} className="flex items-center gap-2.5 rounded-[var(--radius-sm)] hover:bg-[var(--color-hover)] transition-colors -mx-1 px-1 py-1">
                <Avatar name={`${user.firstName} ${user.lastName}`} size="sm" />
                <span className="text-[12px] font-medium text-[var(--color-text-body)]">{user.firstName} {user.lastName}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
