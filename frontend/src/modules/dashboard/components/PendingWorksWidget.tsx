// src/modules/dashboard/components/PendingWorksWidget.tsx
// PRD §10.1/§10.5 "Pending Works" - backend-computed via GET /dashboard/widgets?ids=pending-works,
// scoped server-side to "my open tasks" for STAFF and tenant-wide for unrestricted roles (PRD
// §10.11) - this component never re-derives that scoping, it just renders what the API returns.
import { Link } from 'react-router-dom'
import { ListTodo } from 'lucide-react'
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { StatusBadge } from '@/components/shared/StatusBadge/StatusBadge'
import { Skeleton, ErrorState, EmptyState } from '@/components/feedback'
import { formatDate, cn } from '@/lib/utils'
import { useDashboardWidgetDataQuery } from '../hooks'
import type { TaskSummaryItem } from '../types'

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'info' | 'danger'> = {
  TODO: 'default',
  IN_PROGRESS: 'info',
  REVIEW: 'warning',
  REQUESTED: 'default',
  SUBMITTED: 'info',
  UNDER_REVIEW: 'warning',
  APPROVED: 'success',
}

export function PendingWorksWidget() {
  const { data, isLoading, isError } = useDashboardWidgetDataQuery(['pending-works'], 6)
  const entry = data?.['pending-works']
  const items = (entry?.items as TaskSummaryItem[] | undefined) ?? []

  return (
    <Card>
      <CardHeader title="Pending Works" action={<span className="text-[11px] text-[var(--color-text-muted)]">{entry?.total ?? 0} total</span>} />
      {isLoading ? (
        <Skeleton variant="table" rows={4} height={32} />
      ) : isError ? (
        <ErrorState message="Couldn't load pending works." />
      ) : items.length === 0 ? (
        <EmptyState icon={ListTodo} title="Nothing pending" description="Open tasks will show up here." />
      ) : (
        <ul className="space-y-2">
          {items.map((task) => (
            <li key={task.id}>
              <Link
                to={`/tasks/${task.id}`}
                className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] hover:bg-[var(--color-hover)] transition-colors -mx-1 px-1 py-1.5"
              >
                <span className="text-[12px] font-medium text-[var(--color-text-body)] truncate">{task.title}</span>
                <span className="flex items-center gap-2 shrink-0">
                  {task.dueDate && (
                    <span className={cn('text-[11px]', task.isOverdue ? 'font-medium text-[var(--color-danger)]' : 'text-[var(--color-text-muted)]')}>
                      {formatDate(task.dueDate)}
                    </span>
                  )}
                  <StatusBadge variant={STATUS_VARIANT[task.status] ?? 'default'}>{task.status}</StatusBadge>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
