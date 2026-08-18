// src/modules/dashboard/components/RecentDocumentsWidget.tsx
// Real recently-uploaded documents via the already-real Documents API.
import { Link } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { Skeleton, ErrorState, EmptyState } from '@/components/feedback'
import { formatDate, formatFileSize } from '@/lib/utils'
import { useDocumentsQuery } from '@/modules/documents/hooks'

export function RecentDocumentsWidget() {
  const { data, isLoading, isError } = useDocumentsQuery({ page: 1, limit: 5, sortBy: 'createdAt', sortOrder: 'desc' })
  const documents = data?.data ?? []

  return (
    <Card>
      <CardHeader title="Recent Documents" />
      {isLoading ? (
        <Skeleton variant="table" rows={4} height={32} />
      ) : isError ? (
        <ErrorState message="Couldn't load documents." />
      ) : documents.length === 0 ? (
        <EmptyState icon={FileText} title="No documents yet" description="Uploaded documents will show up here." />
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {documents.map((doc) => (
            <li key={doc.id}>
              <Link
                to={`/documents/${doc.id}`}
                className="flex items-center gap-3 py-2.5 -mx-1 px-1 rounded-[var(--radius-sm)] hover:bg-[var(--color-hover)] transition-colors"
              >
                <div className="w-7 h-7 rounded-[var(--radius-md)] bg-[var(--color-surface)] flex items-center justify-center shrink-0">
                  <FileText className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-medium text-[var(--color-text-body)] truncate">{doc.fileName}</p>
                  <p className="text-[11px] text-[var(--color-text-muted)]">
                    {formatFileSize(doc.sizeBytes)} · {formatDate(doc.createdAt)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
