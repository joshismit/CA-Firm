// src/modules/roles/components/RoleTimelineCard.tsx
// Derived only from Role's own real lifecycle fields (createdAt/updatedAt) - no invented activity
// feed, same precedent as BusinessTimelineCard.
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { formatDateLong } from '@/lib/utils'
import type { Role } from '../types'

export interface RoleTimelineCardProps {
  role: Role
}

export function RoleTimelineCard({ role }: RoleTimelineCardProps) {
  const events = [
    { label: 'Role created', date: role.createdAt },
    ...(role.updatedAt !== role.createdAt ? [{ label: 'Last updated', date: role.updatedAt }] : []),
  ]

  return (
    <Card>
      <CardHeader title="Timeline" />
      <div className="space-y-3">
        {events.map((event) => (
          <div key={event.label} className="flex items-center gap-3">
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
