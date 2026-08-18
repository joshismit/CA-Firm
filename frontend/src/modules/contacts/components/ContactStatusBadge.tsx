// src/modules/contacts/components/ContactStatusBadge.tsx
// Thin, module-scoped config layer over the shared StatusBadge - never a new badge implementation.
// The locked Contact type (modules/contacts/types/index.ts) has no `status` enum - the only
// real, badge-worthy boolean on the model is `portalUserId` (set once the contact has portal
// login access), so this badge reflects that instead of inventing a status field that doesn't
// exist in the Prisma model or the schema/types this phase must not modify.
import { StatusBadge } from '@/components/shared/StatusBadge/StatusBadge'

export interface ContactStatusBadgeProps {
  portalUserId: string | null
  className?: string
}

export function ContactStatusBadge({ portalUserId, className }: ContactStatusBadgeProps) {
  return (
    <StatusBadge variant={portalUserId ? 'success' : 'default'} dot className={className}>
      {portalUserId ? 'Portal Access' : 'No Portal Access'}
    </StatusBadge>
  )
}
