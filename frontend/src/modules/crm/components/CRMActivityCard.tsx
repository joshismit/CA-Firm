// src/modules/crm/components/CRMActivityCard.tsx
// LeadActivity is a real Prisma model and a real frontend type, but the locked crm/hooks layer has
// no listLeadActivities/useLeadActivitiesQuery - only lead CRUD + listLeadStages are exposed. Shows
// the shared EmptyState honestly rather than inventing a read endpoint, mirroring the identical
// BusinessContactsCard/ContactBusinessCard precedent from the previous two modules.
import { Activity } from 'lucide-react'
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { EmptyState } from '@/components/feedback'

export interface CRMActivityCardProps {
  leadId: string
}

export function CRMActivityCard({ leadId: _leadId }: CRMActivityCardProps) {
  return (
    <Card>
      <CardHeader title="Activities" />
      <EmptyState
        icon={Activity}
        title="No activity yet"
        description="Calls, meetings, and notes will appear here once a lead-activities read endpoint exists."
      />
    </Card>
  )
}
