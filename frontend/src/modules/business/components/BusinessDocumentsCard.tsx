// src/modules/business/components/BusinessDocumentsCard.tsx
// Documents' list endpoint genuinely supports `businessId` (backend/src/modules/documents/
// repository/document.repository.ts: `where.businessId = filters.businessId` - a direct FK, unlike
// Contacts' indirect ContactRole join). Reuses the Documents module's own useDocumentsQuery hook
// directly, mirroring BusinessContactsCard's identical cross-module reuse.
import { FileText } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { Spinner, ErrorState, EmptyState } from '@/components/feedback'
import { normalizeApiError } from '@/services/api-error'
import { formatFileSize } from '@/lib/utils'
import { useDocumentsQuery } from '@/modules/documents/hooks'
import { DocumentStatusBadge } from '@/modules/documents/components'

export interface BusinessDocumentsCardProps {
  businessId: string
}

export function BusinessDocumentsCard({ businessId }: BusinessDocumentsCardProps) {
  const { data, isLoading, isError, error, refetch } = useDocumentsQuery({ businessId, limit: 5, sortBy: 'createdAt', sortOrder: 'desc' })
  const documents = data?.data ?? []

  return (
    <Card>
      <CardHeader
        title="Documents"
        action={
          data && data.meta.total > 0 ? (
            <Link
              to={`/documents?businessId=${businessId}`}
              className="text-[12px] text-[var(--color-primary-600)] hover:text-[var(--color-primary-700)]"
            >
              View all ({data.meta.total})
            </Link>
          ) : undefined
        }
      />
      {isLoading ? (
        <Spinner fullScreen={false} label="Loading documents…" className="py-8" />
      ) : isError ? (
        <ErrorState
          title="Couldn't load documents"
          message={normalizeApiError(error).message}
          onRetry={refetch}
          className="py-8"
        />
      ) : documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents linked"
          description="Documents uploaded for this business will appear here."
        />
      ) : (
        <div className="space-y-3">
          {documents.map((document) => (
            <div key={document.id} className="flex items-center justify-between gap-3 py-1.5 border-b border-[var(--color-border)] last:border-0 last:pb-0">
              <div className="min-w-0">
                <Link
                  to={`/documents/${document.id}`}
                  className="text-[13px] font-medium text-[var(--color-text-body)] hover:text-[var(--color-primary-600)] truncate block"
                >
                  {document.fileName}
                </Link>
                <p className="text-[11px] text-[var(--color-text-muted)]">{formatFileSize(document.sizeBytes)}</p>
              </div>
              <DocumentStatusBadge category={document.category} />
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
