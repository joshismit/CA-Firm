// src/modules/settings/components/SessionsList.tsx
// Real list against a real endpoint (GET /auth/sessions) - not a NOT_IMPLEMENTED stub. Per-session
// revoke calls the real DELETE /auth/sessions/:id. The current session has no revoke action (you
// can't safely sign yourself out of the session you're using to view this list from here) and
// there's no bulk "revoke all others" endpoint call - this loops the same real single-session
// revoke once per non-current row, same "no bulk endpoint, loop the real single-item one"
// precedent already used for Business/Contacts/Projects bulk delete.
import { useState } from 'react'
import { Laptop, Smartphone, Monitor, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/StatusBadge/StatusBadge'
import { Spinner, ErrorState, EmptyState } from '@/components/feedback'
import { normalizeApiError } from '@/services/api-error'
import { formatDateLong } from '@/lib/utils'
import { useSessionsQuery, useRevokeSessionMutation } from '@/modules/auth/hooks'

const DEVICE_ICON: Record<string, typeof Laptop> = {
  DESKTOP: Monitor,
  LAPTOP: Laptop,
  MOBILE: Smartphone,
}

export function SessionsList() {
  const { data: sessions, isLoading, isError, error, refetch } = useSessionsQuery()
  const revokeMutation = useRevokeSessionMutation()
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const handleRevoke = (id: string) => {
    setRevokingId(id)
    revokeMutation.mutate(id, { onSettled: () => setRevokingId(null) })
  }

  if (isLoading) return <Spinner fullScreen={false} label="Loading sessions…" className="py-8" />
  if (isError) return <ErrorState title="Couldn't load sessions" message={normalizeApiError(error).message} onRetry={refetch} className="py-8" />
  if (!sessions || sessions.length === 0) return <EmptyState title="No active sessions" description="Your active sessions will show up here." />

  return (
    <ul className="divide-y divide-[var(--color-border)]">
      {sessions.map((session) => {
        const Icon = DEVICE_ICON[session.deviceType] ?? Monitor
        return (
          <li key={session.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--color-surface)] flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-[var(--color-text-muted)]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[12px] font-medium text-[var(--color-text-body)] truncate">
                    {session.deviceName ?? session.browser ?? session.deviceType}
                    {session.os ? ` · ${session.os}` : ''}
                  </p>
                  {session.isCurrent && <StatusBadge variant="success">This device</StatusBadge>}
                </div>
                <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                  {session.ipAddress ?? 'Unknown IP'}
                  {session.locationCity ? ` · ${session.locationCity}` : ''} · Last active {formatDateLong(session.lastActiveAt)}
                </p>
              </div>
            </div>
            {!session.isCurrent && (
              <Button
                variant="ghost"
                size="sm"
                leadingIcon={<LogOut className="w-3.5 h-3.5" />}
                onClick={() => handleRevoke(session.id)}
                loading={revokingId === session.id}
              >
                Revoke
              </Button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
