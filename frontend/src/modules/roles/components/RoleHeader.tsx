// src/modules/roles/components/RoleHeader.tsx
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader, PageActions } from '@/components/page'
import { RoleTypeBadge } from './RoleTypeBadge'
import { RoleQuickActions } from './RoleQuickActions'
import type { Role } from '../types'

export interface RoleHeaderProps {
  role: Role
}

export function RoleHeader({ role }: RoleHeaderProps) {
  return (
    <div className="space-y-3">
      <Link
        to="/staff/roles"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-body)]"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to roles
      </Link>

      <PageHeader
        title={role.name}
        description={role.description ?? undefined}
        actions={
          <PageActions>
            <RoleTypeBadge type={role.type} />
            <RoleQuickActions role={role} />
          </PageActions>
        }
      />
    </div>
  )
}
