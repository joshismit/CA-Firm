// src/modules/contacts/components/ContactBusinessCard.tsx
// A contact-roles read endpoint now exists (GET /contacts/:id/roles - backend Phase 6 Day 2), so
// this shows real ContactRole data instead of the EmptyState-only placeholder from the previous
// phase. A contact can hold roles at multiple businesses, so each role cross-references its
// business via Business's own useBusinessQuery/BusinessStatusBadge - the same real cross-module
// reuse pattern CRMBusinessCard established for Lead.businessId.
import { Landmark } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { StatusBadge } from '@/components/shared/StatusBadge/StatusBadge'
import { Spinner, ErrorState, EmptyState } from '@/components/feedback'
import { normalizeApiError } from '@/services/api-error'
import { useBusinessQuery } from '@/modules/business/hooks'
import { useContactRolesQuery } from '../hooks'
import { CONTACT_ROLE_LABELS } from '../constants'
import type { ContactRole } from '../types'

export interface ContactBusinessCardProps {
  contactId: string
}

export function ContactBusinessCard({ contactId }: ContactBusinessCardProps) {
  const { data: roles, isLoading, isError, error, refetch } = useContactRolesQuery(contactId)

  return (
    <Card>
      <CardHeader title="Business" />
      {isLoading ? (
        <Spinner fullScreen={false} label="Loading roles…" className="py-8" />
      ) : isError ? (
        <ErrorState
          title="Couldn't load roles"
          message={normalizeApiError(error).message}
          onRetry={refetch}
          className="py-8"
        />
      ) : !roles || roles.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="No business linked"
          description="This contact isn't assigned to any business yet."
        />
      ) : (
        <div className="space-y-3">
          {roles.map((role) => (
            <ContactRoleBusinessRow key={role.id} role={role} />
          ))}
        </div>
      )}
    </Card>
  )
}

function ContactRoleBusinessRow({ role }: { role: ContactRole }) {
  const { data: business, isLoading, isError } = useBusinessQuery(role.businessId)

  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-[var(--color-border)] last:border-0 last:pb-0">
      <div className="min-w-0">
        {isLoading ? (
          <p className="text-[13px] text-[var(--color-text-muted)]">Loading…</p>
        ) : isError || !business ? (
          <p className="text-[13px] text-[var(--color-text-muted)] font-mono truncate">{role.businessId}</p>
        ) : (
          <Link
            to={`/business/${business.id}`}
            className="text-[13px] font-medium text-[var(--color-text-body)] hover:text-[var(--color-primary-600)] truncate"
          >
            {business.name}
          </Link>
        )}
        <p className="text-[11px] text-[var(--color-text-muted)]">
          {CONTACT_ROLE_LABELS[role.roleType] ?? role.roleType}
          {role.customTitle ? ` — ${role.customTitle}` : ''}
        </p>
      </div>
      {role.isPrimary && (
        <StatusBadge variant="success" dot>
          Primary
        </StatusBadge>
      )}
    </div>
  )
}
