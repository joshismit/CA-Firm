// src/modules/roles/components/RolePermissionsCard.tsx
// Renders the role's own real permissionCodes field directly - no separate fetch needed once
// getRole succeeds.
import { KeyRound } from 'lucide-react'
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { StatusBadge } from '@/components/shared/StatusBadge/StatusBadge'
import { EmptyState } from '@/components/feedback'
import type { Role } from '../types'

export interface RolePermissionsCardProps {
  role: Role
}

export function RolePermissionsCard({ role }: RolePermissionsCardProps) {
  return (
    <Card>
      <CardHeader title="Permissions" action={<span className="text-[11px] text-[var(--color-text-muted)]">{role.permissionCodes.length} granted</span>} />
      {role.permissionCodes.length === 0 ? (
        <EmptyState icon={KeyRound} title="No permissions granted" description="Permissions assigned to this role will appear here." />
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {role.permissionCodes.map((code) => (
            <StatusBadge key={code} variant="default" className="font-mono">
              {code}
            </StatusBadge>
          ))}
        </div>
      )}
    </Card>
  )
}
