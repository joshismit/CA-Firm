// src/modules/business/components/BusinessContactsCard.tsx
// The Business API's getBusiness() response doesn't include nested contacts, and per this
// phase's instructions only the existing Business hooks may be consumed (not modules/contacts'
// hooks) - so this card has no real data source yet and shows the shared EmptyState honestly
// rather than reaching into another module's not-yet-implemented API.
import { Users } from 'lucide-react'
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { EmptyState } from '@/components/feedback'

export interface BusinessContactsCardProps {
  businessId: string
}

export function BusinessContactsCard({ businessId: _businessId }: BusinessContactsCardProps) {
  return (
    <Card>
      <CardHeader title="Contacts" />
      <EmptyState
        icon={Users}
        title="No contacts linked"
        description="Contacts will appear here once this business is connected to the Contacts module."
      />
    </Card>
  )
}
