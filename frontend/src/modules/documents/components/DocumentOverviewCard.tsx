// src/modules/documents/components/DocumentOverviewCard.tsx
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { formatDate } from '@/lib/utils'
import { formatFileSize } from '../utils'
import { DocumentStatusBadge } from './DocumentStatusBadge'
import type { DocumentFile } from '../types'

export interface DocumentOverviewCardProps {
  document: DocumentFile
}

export function DocumentOverviewCard({ document }: DocumentOverviewCardProps) {
  return (
    <Card>
      <CardHeader title="Overview" />
      <dl className="grid grid-cols-2 gap-4 text-[13px]">
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Category</dt>
          <dd className="mt-1">
            <DocumentStatusBadge category={document.category} />
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Size</dt>
          <dd className="mt-0.5 text-[var(--color-text-body)] font-mono">{formatFileSize(document.sizeBytes)}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Version</dt>
          <dd className="mt-0.5 text-[var(--color-text-body)]">v{document.version}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Uploaded</dt>
          <dd className="mt-0.5 text-[var(--color-text-body)]">{formatDate(document.createdAt)}</dd>
        </div>
      </dl>
    </Card>
  )
}
