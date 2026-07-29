// src/modules/audit/pages/AuditDetailPage.tsx
// getAuditLogEntry always 501s (no backend module exists) - same reasoning as every other
// backend-less Detail page in this app: one clear, honest ErrorState naming exactly what's
// missing, rather than empty card husks with no subject.
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { PageLayout, PageContent } from '@/components/page'
import { Spinner, ErrorState } from '@/components/feedback'
import { normalizeApiError } from '@/services/api-error'
import { useAuditLogEntryQuery } from '../hooks'

export function AuditDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { isLoading, isError, error, refetch } = useAuditLogEntryQuery(id!)

  return (
    <PageLayout>
      <Link
        to="/audit"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-body)] mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Audit Logs
      </Link>

      <PageContent>
        {isLoading ? (
          <Spinner fullScreen={false} label="Loading audit event…" className="py-16" />
        ) : (
          <ErrorState
            title="This audit event isn't available"
            message={
              isError
                ? normalizeApiError(error).message
                : "Audit logging doesn't have a general-purpose backend module yet (only login events are tracked today), so individual events can't be loaded. Once it exists, this page will show the full event context: actor, target, IP address, and related timeline."
            }
            onRetry={refetch}
          />
        )}
      </PageContent>
    </PageLayout>
  )
}
