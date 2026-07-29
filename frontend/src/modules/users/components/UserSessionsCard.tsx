// src/modules/users/components/UserSessionsCard.tsx
// getUserSessions always 501s (no admin-facing sessions endpoint exists - distinct from the real,
// self-service GET /auth/sessions used in Settings > Profile, which only ever returns the caller's
// own sessions and cannot be repurposed to show an arbitrary user's sessions to an admin).
import { Monitor } from 'lucide-react'
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { Spinner, ErrorState, EmptyState } from '@/components/feedback'
import { normalizeApiError } from '@/services/api-error'
import { formatDateLong } from '@/lib/utils'
import { useUserSessionsQuery } from '../hooks'

export interface UserSessionsCardProps {
  userId: string
}

export function UserSessionsCard({ userId }: UserSessionsCardProps) {
  const { data: sessions, isLoading, isError, error, refetch } = useUserSessionsQuery(userId)

  return (
    <Card>
      <CardHeader title="Active Sessions" />
      {isLoading ? (
        <Spinner fullScreen={false} label="Loading sessions…" className="py-8" />
      ) : isError ? (
        <ErrorState title="Couldn't load sessions" message={normalizeApiError(error).message} onRetry={refetch} className="py-8" />
      ) : !sessions || sessions.length === 0 ? (
        <EmptyState icon={Monitor} title="No active sessions" description="This user's active sessions will appear here." />
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {sessions.map((session) => (
            <li key={session.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-[var(--color-text-body)] truncate">
                  {session.deviceName ?? session.browser ?? session.deviceType}
                </p>
                <p className="text-[11px] text-[var(--color-text-muted)]">
                  {session.ipAddress ?? 'Unknown IP'} · Last active {formatDateLong(session.lastActiveAt)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
