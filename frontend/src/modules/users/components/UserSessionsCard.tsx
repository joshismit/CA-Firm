// src/modules/users/components/UserSessionsCard.tsx
// Admin-facing session list for another user - distinct from the self-service GET /auth/sessions
// used in Settings > Profile, which only ever returns the caller's own sessions. Each row's
// "Revoke" button hits the admin-only DELETE /users/:id/sessions/:sessionId (PRD §14.5), which
// force-logs-out that one device without deactivating the whole account.
import { Monitor, LogOut } from 'lucide-react'
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { Spinner, ErrorState, EmptyState } from '@/components/feedback'
import { Button } from '@/components/ui/button'
import { normalizeApiError } from '@/services/api-error'
import { formatDateLong } from '@/lib/utils'
import { useUserSessionsQuery, useRevokeUserSessionMutation } from '../hooks'

export interface UserSessionsCardProps {
  userId: string
}

export function UserSessionsCard({ userId }: UserSessionsCardProps) {
  const { data: sessions, isLoading, isError, error, refetch } = useUserSessionsQuery(userId)
  const revokeMutation = useRevokeUserSessionMutation(userId)

  const handleRevoke = (sessionId: string) => {
    if (!window.confirm('Log this device out? The user will need to sign in again on it.')) return
    revokeMutation.mutate(sessionId)
  }

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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRevoke(session.id)}
                disabled={revokeMutation.isPending}
              >
                <LogOut className="size-3.5" />
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
