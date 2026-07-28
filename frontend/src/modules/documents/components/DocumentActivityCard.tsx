// src/modules/documents/components/DocumentActivityCard.tsx
// No activity/audit-log model, API, or hook exists anywhere for documents (there isn't even a
// Prisma model for the document itself yet). Shows the shared EmptyState honestly rather than
// inventing a read endpoint, mirroring CRMActivityCard's identical precedent.
import { Activity } from 'lucide-react'
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { EmptyState } from '@/components/feedback'

export interface DocumentActivityCardProps {
  documentId: string
}

export function DocumentActivityCard({ documentId: _documentId }: DocumentActivityCardProps) {
  return (
    <Card>
      <CardHeader title="Activity" />
      <EmptyState
        icon={Activity}
        title="No activity yet"
        description="Uploads, downloads, and edits will appear here once an audit-log read endpoint exists."
      />
    </Card>
  )
}
