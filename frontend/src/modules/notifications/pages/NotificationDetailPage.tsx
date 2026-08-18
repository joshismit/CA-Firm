// src/modules/notifications/pages/NotificationDetailPage.tsx
// getNotification always 501s (no backend module exists), so there is never a real record to show
// - same reasoning as InvoiceDetailPage/ComplianceDetailPage: one clear, honest ErrorState naming
// exactly what's missing rather than empty card husks with no subject.
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { PageLayout, PageContent } from '@/components/page'
import { Spinner, ErrorState } from '@/components/feedback'
import { normalizeApiError } from '@/services/api-error'
import { useNotificationQuery } from '../hooks'

export function NotificationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { isLoading, isError, error, refetch } = useNotificationQuery(id!)

  return (
    <PageLayout>
      <Link
        to="/notifications"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-body)] mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Notifications
      </Link>

      <PageContent>
        {isLoading ? (
          <Spinner fullScreen={false} label="Loading notification…" className="py-16" />
        ) : (
          <ErrorState
            title="This notification isn't available"
            message={
              isError
                ? normalizeApiError(error).message
                : "Notifications don't have a backend module yet, so individual notifications can't be loaded. Once it exists, this page will show the full message, delivery timeline, and quick actions (mark as read, delete)."
            }
            onRetry={refetch}
          />
        )}
      </PageContent>
    </PageLayout>
  )
}
