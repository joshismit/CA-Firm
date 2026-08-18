// src/modules/contacts/components/ContactInformationCard.tsx
// Reuses ContactForm in read-only "view" mode - no separate hand-rolled info display.
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { ContactForm } from './ContactForm'
import type { Contact } from '../types'

export interface ContactInformationCardProps {
  contact: Contact
}

export function ContactInformationCard({ contact }: ContactInformationCardProps) {
  return (
    <Card>
      <CardHeader title="Contact Information" />
      <ContactForm mode="view" contact={contact} />
    </Card>
  )
}
