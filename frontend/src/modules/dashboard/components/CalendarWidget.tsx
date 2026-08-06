// src/modules/dashboard/components/CalendarWidget.tsx
// PRD §10.1/§10.6 - unified calendar feed backed by GET /dashboard/calendar, merging task due
// dates + compliance deadlines + invoice due dates server-side. "Upcoming meetings" is
// deliberately NOT included - no meeting/scheduling concept exists anywhere in this codebase
// (confirmed by a full-repo search) and inventing one is out of scope for this PRD item; this is
// an honest, real feed of the three sources that do exist, not a partial fake of a fourth.
import { Link } from 'react-router-dom'
import { CalendarDays, CheckSquare, ShieldAlert, Receipt } from 'lucide-react'
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { Skeleton, ErrorState, EmptyState } from '@/components/feedback'
import { formatDate } from '@/lib/utils'
import { useDashboardCalendarQuery } from '../hooks'
import type { CalendarEntry } from '../types'

const TYPE_ICON: Record<CalendarEntry['type'], typeof CheckSquare> = {
  task: CheckSquare,
  compliance: ShieldAlert,
  invoice: Receipt,
}

const TYPE_LABEL: Record<CalendarEntry['type'], string> = {
  task: 'Task',
  compliance: 'Compliance',
  invoice: 'Invoice',
}

export function CalendarWidget() {
  const { data, isLoading, isError } = useDashboardCalendarQuery()
  const items = data?.items ?? []

  return (
    <Card>
      <CardHeader title="Calendar" action={<CalendarDays className="w-4 h-4 text-[var(--color-text-muted)]" />} />
      {isLoading ? (
        <Skeleton variant="table" rows={5} height={32} />
      ) : isError ? (
        <ErrorState message="Couldn't load the calendar." />
      ) : items.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Nothing scheduled"
          description="Task due dates, compliance deadlines, and invoice due dates over the next 30 days will show up here."
        />
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {items.map((entry) => {
            const Icon = TYPE_ICON[entry.type]
            return (
              <li key={`${entry.type}-${entry.id}`}>
                <Link
                  to={entry.href}
                  className="flex items-center gap-3 py-2.5 -mx-1 px-1 rounded-[var(--radius-sm)] hover:bg-[var(--color-hover)] transition-colors"
                >
                  <div className="w-7 h-7 rounded-[var(--radius-md)] bg-[var(--color-surface)] flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium text-[var(--color-text-body)] truncate">{entry.title}</p>
                    <p className="text-[11px] text-[var(--color-text-muted)]">{TYPE_LABEL[entry.type]}</p>
                  </div>
                  <span className="text-[11px] text-[var(--color-text-muted)] shrink-0">{formatDate(entry.date)}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
