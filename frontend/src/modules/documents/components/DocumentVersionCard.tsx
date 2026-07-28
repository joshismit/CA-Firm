// src/modules/documents/components/DocumentVersionCard.tsx
// DocumentFile carries a real `version` number (the current record's own version), but there is no
// version-history model, API, or hook anywhere in the locked architecture - only the single current
// version is ever returned. Shows that one real fact, plus an honest EmptyState for the history list
// itself rather than fabricating past versions, mirroring the BusinessContactsCard/CRMActivityCard
// precedent of showing EmptyState instead of inventing a read endpoint.
import { History } from 'lucide-react'
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { EmptyState } from '@/components/feedback'
import type { DocumentFile } from '../types'

export interface DocumentVersionCardProps {
  document: DocumentFile
}

export function DocumentVersionCard({ document }: DocumentVersionCardProps) {
  return (
    <Card>
      <CardHeader title="Version History" />
      <p className="text-[13px] text-[var(--color-text-body)] mb-3">
        Current version: <span className="font-mono">v{document.version}</span>
      </p>
      <EmptyState
        icon={History}
        title="No earlier versions available"
        description="Full version history will appear here once a document-versions read endpoint exists."
      />
    </Card>
  )
}
