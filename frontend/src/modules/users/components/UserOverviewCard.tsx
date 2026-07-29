// src/modules/users/components/UserOverviewCard.tsx
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { formatDate } from '@/lib/utils'
import { UserStatusBadge } from './UserStatusBadge'
import type { User } from '../types'

export interface UserOverviewCardProps {
  user: User
}

export function UserOverviewCard({ user }: UserOverviewCardProps) {
  return (
    <Card>
      <CardHeader title="Overview" />
      <dl className="grid grid-cols-2 gap-4 text-[13px]">
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Status</dt>
          <dd className="mt-1">
            <UserStatusBadge status={user.status} />
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Email</dt>
          <dd className="mt-0.5 text-[var(--color-text-body)]">{user.email}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Phone</dt>
          <dd className="mt-0.5 text-[var(--color-text-body)]">{user.phone ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Job title</dt>
          <dd className="mt-0.5 text-[var(--color-text-body)]">{user.jobTitle ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Last login</dt>
          <dd className="mt-0.5 text-[var(--color-text-body)]">{user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Joined</dt>
          <dd className="mt-0.5 text-[var(--color-text-body)]">{formatDate(user.createdAt)}</dd>
        </div>
      </dl>
    </Card>
  )
}
