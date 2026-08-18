// src/modules/documents/components/DocumentVersionCard.tsx
// PRD §7.2 rules 4/8/9 - real version history, backed by GET /documents/:id/versions
// (useDocumentVersionsQuery) now that the backend chain (Document.version/isLatestVersion/
// rootDocumentId/previousVersionId) and the endpoint exist. Newest first; the current version
// gets a "Current Version" badge, every version gets a Download action (old versions stay
// downloadable forever - PRD "all historical versions remain available"), and "Replace File"
// (gated on documents:create, matching POST /documents/:id/version's permission) opens
// ReplaceFileDialog. No restore-old-version action - PRD marks it optional and it would need a
// backend "copy object to a new key" operation that doesn't exist yet (see the module's known
// limitations).
import { useState } from 'react'
import { Download, History, RefreshCw } from 'lucide-react'
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { EmptyState, Spinner, ErrorState } from '@/components/feedback'
import { StatusBadge } from '@/components/shared/StatusBadge/StatusBadge'
import { Button } from '@/components/ui/button'
import { Can } from '@/components/common/Can'
import { PERMISSIONS } from '@/config/permissions.config'
import { formatDate } from '@/lib/utils'
import { normalizeApiError } from '@/services/api-error'
import { formatFileSize } from '../utils'
import { useDocumentVersionsQuery, useDownloadDocumentMutation } from '../hooks'
import { ReplaceFileDialog } from './ReplaceFileDialog'
import type { DocumentFile } from '../types'

export interface DocumentVersionCardProps {
  document: DocumentFile
}

export function DocumentVersionCard({ document }: DocumentVersionCardProps) {
  const [replaceOpen, setReplaceOpen] = useState(false)
  const { data: versions, isLoading, isError, error, refetch } = useDocumentVersionsQuery(document.id)
  const downloadMutation = useDownloadDocumentMutation()

  const currentVersion = versions?.find((v) => v.isLatestVersion) ?? document

  return (
    <Card>
      <CardHeader
        title="Version History"
        action={
          <Can permission={PERMISSIONS.DOCUMENTS_CREATE}>
            <Button
              variant="outline"
              size="sm"
              leadingIcon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={() => setReplaceOpen(true)}
            >
              Replace File
            </Button>
          </Can>
        }
      />

      {isLoading && <Spinner fullScreen={false} label="Loading versions…" className="py-6" />}

      {isError && (
        <ErrorState title="Couldn't load version history" message={normalizeApiError(error).message} onRetry={refetch} />
      )}

      {!isLoading && !isError && (!versions || versions.length === 0) && (
        <EmptyState icon={History} title="No version history" description="This document has no recorded versions yet." />
      )}

      {!isLoading && !isError && versions && versions.length > 0 && (
        <ul className="divide-y divide-[var(--color-border)]">
          {[...versions]
            .sort((a, b) => b.version - a.version)
            .map((version) => (
              <li key={version.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-[var(--color-text-body)] font-mono">v{version.version}</span>
                    {version.isLatestVersion && (
                      <StatusBadge variant="success" dot>
                        Current Version
                      </StatusBadge>
                    )}
                  </div>
                  <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)] truncate">
                    {version.fileName} · {formatFileSize(version.sizeBytes)} · {formatDate(version.createdAt)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  leadingIcon={<Download className="w-3.5 h-3.5" />}
                  onClick={() => downloadMutation.mutate(version.id)}
                  loading={downloadMutation.isPending && downloadMutation.variables === version.id}
                >
                  Download
                </Button>
              </li>
            ))}
        </ul>
      )}

      <ReplaceFileDialog open={replaceOpen} onClose={() => setReplaceOpen(false)} document={currentVersion} />
    </Card>
  )
}
