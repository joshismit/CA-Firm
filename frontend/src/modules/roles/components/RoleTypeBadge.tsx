// src/modules/roles/components/RoleTypeBadge.tsx
// Thin, module-scoped config layer over the shared StatusBadge - never a new badge implementation.
import { StatusBadge } from '@/components/shared/StatusBadge/StatusBadge'
import { ROLE_TYPE_LABELS } from '../constants'
import type { RoleType } from '../types'

export interface RoleTypeBadgeProps {
  type: RoleType
  className?: string
}

export function RoleTypeBadge({ type, className }: RoleTypeBadgeProps) {
  return (
    <StatusBadge variant={type === 'SYSTEM' ? 'info' : 'default'} dot className={className}>
      {ROLE_TYPE_LABELS[type] ?? type}
    </StatusBadge>
  )
}
