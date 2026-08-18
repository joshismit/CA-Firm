// src/modules/dashboard/components/NotificationsPreviewWidget.tsx
// Real query against the Notifications module's own (currently-stubbed) API - genuinely reflects
// whatever that module's real state is, honestly erroring today since no backend exists yet.
import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { Skeleton, ErrorState } from '@/components/feedback'
import { normalizeApiError } from '@/services/api-error'
import { useNotificationsQuery } from '@/modules/notifications/hooks'

export function NotificationsPreviewWidget() {
  const { data, isLoading, isError, error } = useNotificationsQuery({ page: 1, limit: 5 })

  return (
    <Card>
      <CardHeader
        title="Notifications"
        action={
          <Link to="/notifications" className="text-[11px] font-medium text-[var(--color-primary-600)] hover:underline">
            View all
          </Link>
        }
      />
      {isLoading ? (
        <Skeleton variant="table" rows={3} height={32} />
      ) : isError ? (
        <ErrorState title="Not available yet" message={normalizeApiError(error).message} />
      ) : !data || data.data.length === 0 ? (
        <div className="flex flex-col items-center py-6 text-center">
          <Bell className="w-6 h-6 text-[var(--color-text-muted)] mb-2" />
          <p className="text-[12px] text-[var(--color-text-muted)]">You're all caught up.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {data.data.map((n) => (
            <li key={n.id} className="text-[12px] text-[var(--color-text-body)] truncate">
              {n.title}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
