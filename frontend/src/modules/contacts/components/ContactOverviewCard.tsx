// src/modules/contacts/components/ContactOverviewCard.tsx
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { formatDate } from '@/lib/utils'
import { ContactStatusBadge } from './ContactStatusBadge'
import type { Contact } from '../types'

export interface ContactOverviewCardProps {
  contact: Contact
}

export function ContactOverviewCard({ contact }: ContactOverviewCardProps) {
  return (
    <Card>
      <CardHeader title="Overview" />
      <dl className="grid grid-cols-2 gap-4 text-[13px]">
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Status</dt>
          <dd className="mt-1">
            <ContactStatusBadge portalUserId={contact.portalUserId} />
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">PAN</dt>
          <dd className="mt-0.5 text-[var(--color-text-body)] font-mono">{contact.pan ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Email</dt>
          <dd className="mt-0.5 text-[var(--color-text-body)]">{contact.email ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Phone</dt>
          <dd className="mt-0.5 text-[var(--color-text-body)]">{contact.phone ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Added</dt>
          <dd className="mt-0.5 text-[var(--color-text-body)]">{formatDate(contact.createdAt)}</dd>
        </div>
      </dl>
    </Card>
  )
}
