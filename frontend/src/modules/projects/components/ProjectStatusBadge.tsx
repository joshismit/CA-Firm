// src/modules/projects/components/ProjectStatusBadge.tsx
// Thin, module-scoped config layer over the shared StatusBadge - never a new badge implementation.
import { StatusBadge } from '@/components/shared/StatusBadge/StatusBadge'
import { PROJECT_STATUS_LABELS } from '../constants'
import type { ProjectStatus } from '../types'

const STATUS_VARIANT: Record<ProjectStatus, 'default' | 'success' | 'warning' | 'info' | 'danger'> = {
  DRAFT: 'default',
  PLANNED: 'default',
  ACTIVE: 'success',
  ON_HOLD: 'warning',
  COMPLETED: 'info',
  ARCHIVED: 'default',
  CANCELLED: 'danger',
}

export interface ProjectStatusBadgeProps {
  status: ProjectStatus
  className?: string
}

export function ProjectStatusBadge({ status, className }: ProjectStatusBadgeProps) {
  return (
    <StatusBadge variant={STATUS_VARIANT[status]} dot className={className}>
      {PROJECT_STATUS_LABELS[status] ?? status}
    </StatusBadge>
  )
}
