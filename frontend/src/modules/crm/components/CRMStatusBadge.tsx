// src/modules/crm/components/CRMStatusBadge.tsx
// Thin, module-scoped config layer over the shared StatusBadge - never a new badge implementation.
// Unlike Business's status, a Lead's "status" is its stageId - a foreign key into the tenant's own
// configurable LeadStage table (name + order), not a fixed enum. LeadStage has no color field in
// the Prisma model, so there is no real per-stage color to map - using a single neutral variant for
// every resolved stage avoids inventing a fictional workflow-state -> color scheme. Callers resolve
// the stage name (via useLeadStagesQuery) and pass it in; this component never fetches.
import { StatusBadge } from '@/components/shared/StatusBadge/StatusBadge'

export interface CRMStatusBadgeProps {
  stageName: string | undefined
  className?: string
}

export function CRMStatusBadge({ stageName, className }: CRMStatusBadgeProps) {
  return (
    <StatusBadge variant="default" dot className={className}>
      {stageName ?? 'Unknown stage'}
    </StatusBadge>
  )
}
