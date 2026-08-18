// src/modules/crm/components/CRMTimelineCard.tsx
// Derived only from Lead's own real fields (createdAt/updatedAt) - no invented activity feed. The
// Lead type has no embedded `conversion` field (LeadConversion is a separate model/type), so a
// "Converted" timeline entry can't be shown here without inventing a read that doesn't exist.
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { formatDateLong } from '@/lib/utils'
import type { Lead } from '../types'

export interface CRMTimelineCardProps {
  lead: Lead
}

export function CRMTimelineCard({ lead }: CRMTimelineCardProps) {
  const events = [
    { label: 'Lead created', date: lead.createdAt },
    ...(lead.updatedAt !== lead.createdAt ? [{ label: 'Last updated', date: lead.updatedAt }] : []),
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
