// src/modules/users/components/UserHeader.tsx
// Composes the shared PageHeader/PageActions with user-specific content - pages never build this
// header inline.
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader, PageActions } from '@/components/page'
import { UserStatusBadge } from './UserStatusBadge'
import { UserQuickActions } from './UserQuickActions'
import type { User } from '../types'

export interface UserHeaderProps {
  user: User
}

export function UserHeader({ user }: UserHeaderProps) {
  return (
    <div className="space-y-3">
      <Link
        to="/staff/users"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-body)]"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to users
      </Link>

      <PageHeader
        title={`${user.firstName} ${user.lastName}`}
        description={user.email}
        actions={
          <PageActions>
            <UserStatusBadge status={user.status} />
            <UserQuickActions user={user} />
          </PageActions>
        }
      />
    </div>
  )
}
