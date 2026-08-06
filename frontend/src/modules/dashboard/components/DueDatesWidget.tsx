// src/modules/dashboard/components/DueDatesWidget.tsx
// PRD §10.1/§10.5 "Due Dates" - open tasks due within the next 7 days (backend-computed window,
// GET /dashboard/widgets?ids=due-dates), scoped server-side same as PendingWorksWidget.
import { Link } from 'react-router-dom'
import { CalendarClock } from 'lucide-react'
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { Skeleton, ErrorState, EmptyState } from '@/components/feedback'
import { formatDate, cn } from '@/lib/utils'
import { useDashboardWidgetDataQuery } from '../hooks'
import type { TaskSummaryItem } from '../types'

export function DueDatesWidget() {
  const { data, isLoading, isError } = useDashboardWidgetDataQuery(['due-dates'], 6)
  const entry = data?.['due-dates']
  const items = (entry?.items as TaskSummaryItem[] | undefined) ?? []

  return (
    <Card>
      <CardHeader title="Due Dates" action={<CalendarClock className="w-4 h-4 text-[var(--color-text-muted)]" />} />
      {isLoading ? (
        <Skeleton variant="table" rows={4} height={32} />
      ) : isError ? (
        <ErrorState message="Couldn't load due dates." />
      ) : items.length === 0 ? (
        <EmptyState title="Nothing due soon" description="Tasks due within 7 days will show up here." />
      ) : (
        <div className="space-y-2.5">
          {items.map((task) => (
            <Link
              key={task.id}
              to={`/tasks/${task.id}`}
              className="flex items-center gap-3 rounded-[var(--radius-sm)] hover:bg-[var(--color-hover)] transition-colors -mx-1 px-1 py-1"
            >
              <div className={cn('w-1 h-8 rounded-full shrink-0', task.isOverdue ? 'bg-[var(--color-danger)]' : 'bg-[var(--color-warning)]')} />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-[var(--color-text-body)] leading-tight truncate">{task.title}</p>
                <p className="text-[10px] text-[var(--color-text-muted)]">{task.status}</p>
              </div>
              {task.dueDate && (
                <span className={cn('text-[11px] font-medium shrink-0', task.isOverdue ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-muted)]')}>
                  {formatDate(task.dueDate)}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </Card>
  )
}
