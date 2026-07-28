// src/modules/contacts/components/ContactHeader.tsx
// Composes the shared PageHeader/PageActions with contact-specific content - pages never build
// this header inline.
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader, PageActions } from '@/components/page'
import { ContactStatusBadge } from './ContactStatusBadge'
import { ContactQuickActions } from './ContactQuickActions'
import type { Contact } from '../types'

export interface ContactHeaderProps {
  contact: Contact
}

export function ContactHeader({ contact }: ContactHeaderProps) {
  const name = `${contact.firstName} ${contact.lastName ?? ''}`.trim()

  return (
    <div className="space-y-3">
      <Link
        to="/contacts"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-body)]"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to contacts
      </Link>

      <PageHeader
        title={name}
        description={contact.email ?? contact.phone ?? undefined}
        actions={
          <PageActions>
            <ContactStatusBadge portalUserId={contact.portalUserId} />
            <ContactQuickActions contact={contact} />
          </PageActions>
        }
      />
    </div>
  )
}
