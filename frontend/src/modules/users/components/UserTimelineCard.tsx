// src/modules/users/components/UserTimelineCard.tsx
// Derived only from User's own real fields (createdAt/lastLoginAt) - no invented activity feed or
// audit-log API call, same precedent as BusinessTimelineCard/ProjectTimelineCard.
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { formatDateLong } from '@/lib/utils'
import type { User } from '../types'

export interface UserTimelineCardProps {
  user: User
}

export function UserTimelineCard({ user }: UserTimelineCardProps) {
  const events = [
    { label: 'Account created', date: user.createdAt },
    ...(user.lastLoginAt ? [{ label: 'Last login', date: user.lastLoginAt }] : []),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return (
    <Card>
      <CardHeader title="Timeline" />
      <div className="space-y-3">
        {events.map((event, i) => (
          <div key={`${event.label}-${i}`} className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary-500)] shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-[var(--color-text-body)]">{event.label}</p>
              <p className="text-[11px] text-[var(--color-text-muted)]">{formatDateLong(event.date)}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
