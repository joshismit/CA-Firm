// src/modules/contacts/components/ContactCrmCard.tsx
// Same real gap as ContactDocumentsCard, applied to Leads: Lead.contactId is a real column, but
// listLeadsQuerySchema (backend/src/modules/crm/schemas/lead.schema.ts) only filters by
// `stageId`/`sourceId` - no `contactId`. Shows the shared EmptyState honestly rather than
// client-filtering one page of the tenant-wide lead list and passing it off as complete.
import { TrendingUp } from 'lucide-react'
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { EmptyState } from '@/components/feedback'

export interface ContactCrmCardProps {
  contactId: string
}

export function ContactCrmCard({ contactId: _contactId }: ContactCrmCardProps) {
  return (
    <Card>
      <CardHeader title="CRM" />
      <EmptyState
        icon={TrendingUp}
        title="Lead search by contact isn't available yet"
        description="The CRM API doesn't support filtering leads by contact - only by stage or source. Search CRM directly to find leads linked to this contact."
      />
    </Card>
  )
}
