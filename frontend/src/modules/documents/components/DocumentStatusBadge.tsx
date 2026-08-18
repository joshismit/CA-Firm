// src/modules/documents/components/DocumentStatusBadge.tsx
// Thin, module-scoped config layer over the shared StatusBadge - never a new badge implementation.
// DocumentFile has no status field at all (no Prisma model exists yet to define one) - `category`
// is the only enum-like classifier on the record. Per this phase's instruction ("if no status
// exists, use a neutral badge"), every category renders with a single neutral variant rather than
// inventing a fictional per-category color scheme.
import { StatusBadge } from '@/components/shared/StatusBadge/StatusBadge'
import { DOCUMENT_CATEGORY_LABELS } from '../constants'
import type { DocumentCategory } from '../types'

export interface DocumentStatusBadgeProps {
  category: DocumentCategory
  className?: string
}

export function DocumentStatusBadge({ category, className }: DocumentStatusBadgeProps) {
  return (
    <StatusBadge variant="default" dot className={className}>
      {DOCUMENT_CATEGORY_LABELS[category] ?? category}
    </StatusBadge>
  )
}
