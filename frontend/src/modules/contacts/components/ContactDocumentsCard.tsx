// src/modules/contacts/components/ContactDocumentsCard.tsx
// Unlike BusinessDocumentsCard, this can't reuse useDocumentsQuery the same way: Documents' list
// endpoint only filters by `category`/`businessId` (backend/src/modules/documents/schemas/
// document.schema.ts's listDocumentsQuerySchema has no `contactId` param), even though
// Document.contactId is a real column on each row. Fetching the whole tenant-wide list and
// filtering client-side would only reflect whichever page happened to load - silently wrong once
// there's more than one page of documents. Shows the shared EmptyState honestly instead, mirroring
// CRMActivityCard/DocumentActivityCard's identical precedent for a real field with no matching
// list-filter API.
import { FileText } from 'lucide-react'
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { EmptyState } from '@/components/feedback'

export interface ContactDocumentsCardProps {
  contactId: string
}

export function ContactDocumentsCard({ contactId: _contactId }: ContactDocumentsCardProps) {
  return (
    <Card>
      <CardHeader title="Documents" />
      <EmptyState
        icon={FileText}
        title="Document search by contact isn't available yet"
        description="The Documents API doesn't support filtering by contact - only by business or category. Search Documents directly to find files linked to this contact."
      />
    </Card>
  )
}
