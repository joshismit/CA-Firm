// src/modules/business/components/BusinessTimelineCard.tsx
// Derived only from Business's own real fields (createdAt/updatedAt) - no invented activity feed
// or audit-log API call (Audit module is separate and out of scope for Business).
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { formatDateLong } from '@/lib/utils'
import type { Business } from '../types'

export interface BusinessTimelineCardProps {
  business: Business
}

export function BusinessTimelineCard({ business }: BusinessTimelineCardProps) {
  const events = [
    { label: 'Business created', date: business.createdAt },
    ...(business.updatedAt !== business.createdAt ? [{ label: 'Last updated', date: business.updatedAt }] : []),
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
