// src/modules/documents/components/DocumentMetadataCard.tsx
// System/technical fields - deliberately not repeated from DocumentOverviewCard (which covers the
// user-facing category/size/version/uploaded fields). storageKey is shown as an opaque internal
// reference, never as a download link (PRD 7.3: internal storage uses unique IDs, not the original
// filename) - a real GET /documents/:id/download now exists (see useDownloadDocumentMutation), but
// this phase intentionally added no new download button anywhere in the UI (see the module's
// integration notes); storageKey itself was never meant to be a clickable link regardless.
import { Card, CardHeader } from '@/components/shared/Card/Card'
import type { DocumentFile } from '../types'

export interface DocumentMetadataCardProps {
  document: DocumentFile
}

export function DocumentMetadataCard({ document }: DocumentMetadataCardProps) {
  return (
    <Card>
      <CardHeader title="Metadata" />
      <dl className="grid grid-cols-2 gap-4 text-[13px]">
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">MIME Type</dt>
          <dd className="mt-0.5 text-[var(--color-text-body)] font-mono text-[12px]">{document.mimeType}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Contact ID</dt>
          <dd className="mt-0.5 text-[var(--color-text-body)] font-mono text-[12px]">{document.contactId ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Uploaded By</dt>
          <dd className="mt-0.5 text-[var(--color-text-body)] font-mono text-[12px]">{document.uploadedById}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Internal Storage Reference</dt>
          <dd className="mt-0.5 text-[var(--color-text-body)] font-mono text-[12px] truncate">{document.storageKey}</dd>
        </div>
      </dl>
    </Card>
  )
}
