// src/modules/permissions/components/PermissionOverviewCard.tsx
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { StatusBadge } from '@/components/shared/StatusBadge/StatusBadge'
import type { Permission } from '../types'

export interface PermissionOverviewCardProps {
  permission: Permission
}

export function PermissionOverviewCard({ permission }: PermissionOverviewCardProps) {
  return (
    <Card>
      <CardHeader
        title="Overview"
        action={permission.isSensitive ? <StatusBadge variant="danger" dot>Sensitive</StatusBadge> : undefined}
      />
      <dl className="grid grid-cols-2 gap-4 text-[13px]">
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Code</dt>
          <dd className="mt-0.5 font-mono text-[var(--color-text-body)]">{permission.code}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Name</dt>
          <dd className="mt-0.5 text-[var(--color-text-body)]">{permission.name}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Resource</dt>
          <dd className="mt-0.5 text-[var(--color-text-body)]">{permission.resource}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Action</dt>
          <dd className="mt-0.5 text-[var(--color-text-body)]">{permission.action}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Module</dt>
          <dd className="mt-0.5 text-[var(--color-text-body)]">{permission.module}</dd>
        </div>
        {permission.description && (
          <div className="col-span-2">
            <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Description</dt>
            <dd className="mt-0.5 text-[var(--color-text-body)]">{permission.description}</dd>
          </div>
        )}
      </dl>
    </Card>
  )
}
