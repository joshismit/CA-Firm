// src/modules/business/components/BusinessContactsCard.tsx
// Contacts' list endpoint genuinely supports `businessId` (backend/src/modules/contacts/repository/
// contact.repository.ts: `where.roles = { some: { businessId } }`) - a real, indirect-but-real
// filter through ContactRole, not a direct Contact.businessId column. Reuses the Contacts module's
// own useContactsQuery hook directly, mirroring CRMBusinessCard's identical cross-module reuse.
import { Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { Spinner, ErrorState, EmptyState } from '@/components/feedback'
import { normalizeApiError } from '@/services/api-error'
import { useContactsQuery } from '@/modules/contacts/hooks'

export interface BusinessContactsCardProps {
  businessId: string
}

export function BusinessContactsCard({ businessId }: BusinessContactsCardProps) {
  const { data, isLoading, isError, error, refetch } = useContactsQuery({ businessId, limit: 5, sortBy: 'createdAt', sortOrder: 'desc' })
  const contacts = data?.data ?? []

  return (
    <Card>
      <CardHeader
        title="Contacts"
        action={
          data && data.meta.total > 0 ? (
            <Link
              to={`/contacts?businessId=${businessId}`}
              className="text-[12px] text-[var(--color-primary-600)] hover:text-[var(--color-primary-700)]"
            >
              View all ({data.meta.total})
            </Link>
          ) : undefined
        }
      />
      {isLoading ? (
        <Spinner fullScreen={false} label="Loading contacts…" className="py-8" />
      ) : isError ? (
        <ErrorState
          title="Couldn't load contacts"
          message={normalizeApiError(error).message}
          onRetry={refetch}
          className="py-8"
        />
      ) : contacts.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No contacts linked"
          description="Contacts assigned a role at this business will appear here."
        />
      ) : (
        <div className="space-y-3">
          {contacts.map((contact) => (
            <div key={contact.id} className="flex items-center justify-between gap-3 py-1.5 border-b border-[var(--color-border)] last:border-0 last:pb-0">
              <Link
                to={`/contacts/${contact.id}`}
                className="text-[13px] font-medium text-[var(--color-text-body)] hover:text-[var(--color-primary-600)] truncate"
              >
                {contact.firstName} {contact.lastName ?? ''}
              </Link>
              {contact.email && (
                <span className="text-[11px] text-[var(--color-text-muted)] truncate">{contact.email}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
