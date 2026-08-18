// src/modules/audit/components/AuditTimelineView.tsx
// Alternative "Timeline" view of the same audit-log rows the DataTable shows - reuses the
// dot-marker list style already established by ProjectTimelineCard/BusinessTimelineCard, applied
// to a list of real events instead of a single record's lifecycle dates. Loading/error/empty are
// the caller's responsibility (AuditListPage), same as DataTable's own contract - this component
// only renders once real rows exist.
import { formatDateLong } from '@/lib/utils'
import { AuditEventBadge } from './AuditEventBadge'
import type { AuditLogEntry } from '../types'

export interface AuditTimelineViewProps {
  entries: AuditLogEntry[]
}

export function AuditTimelineView({ entries }: AuditTimelineViewProps) {
  return (
    <div className="space-y-4">
      {entries.map((entry) => (
        <div key={entry.id} className="flex gap-3">
          <div className="flex flex-col items-center pt-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary-500)] shrink-0" />
            <div className="w-px flex-1 bg-[var(--color-border)] mt-1" />
          </div>
          <div className="flex-1 min-w-0 pb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <AuditEventBadge eventType={entry.eventType} />
              <span className="text-[12px] font-medium text-[var(--color-text-body)]">{entry.actorName}</span>
              <span className="text-[11px] text-[var(--color-text-muted)]">{formatDateLong(entry.createdAt)}</span>
            </div>
            <p className="mt-1 text-[12px] text-[var(--color-text-secondary)]">{entry.description}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
