// src/modules/dashboard/components/TaskSummaryWidget.tsx
// Real task counts/list via the already-real Tasks API - no fabricated "priority" field (Task has
// none, see modules/tasks/types) unlike the old mock-only RecentTasksWidget this replaces.
import { Link } from 'react-router-dom'
import { CheckSquare } from 'lucide-react'
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { StatusBadge } from '@/components/shared/StatusBadge/StatusBadge'
import { Skeleton, ErrorState, EmptyState } from '@/components/feedback'
import { formatDate, cn } from '@/lib/utils'
import { useTasksQuery } from '@/modules/tasks/hooks'

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'info' | 'danger'> = {
  TODO: 'default',
  IN_PROGRESS: 'info',
  REVIEW: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
}

const STATUS_LABEL: Record<string, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  REVIEW: 'Review',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

export function TaskSummaryWidget() {
  const { data, isLoading, isError } = useTasksQuery({ page: 1, limit: 6, sortBy: 'dueDate', sortOrder: 'asc' })
  const tasks = data?.data ?? []
  const total = data?.meta?.total ?? 0

  return (
    <Card>
      <CardHeader title="Task Summary" action={<span className="text-[11px] text-[var(--color-text-muted)]">{total} total</span>} />
      {isLoading ? (
        <Skeleton variant="table" rows={4} height={32} />
      ) : isError ? (
        <ErrorState message="Couldn't load tasks." />
      ) : tasks.length === 0 ? (
        <EmptyState icon={CheckSquare} title="No tasks yet" description="Tasks you create will show up here." />
      ) : (
        <ul className="space-y-2">
          {tasks.map((task) => (
            <li key={task.id}>
              <Link
                to={`/tasks/${task.id}`}
                className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] hover:bg-[var(--color-hover)] transition-colors -mx-1 px-1 py-1.5"
              >
                <span
                  className={cn(
                    'text-[12px] font-medium truncate',
                    task.status === 'COMPLETED' ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text-body)]'
                  )}
                >
                  {task.title}
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  {task.dueDate && (
                    <span className={cn('text-[11px]', task.isOverdue ? 'font-medium text-[var(--color-danger)]' : 'text-[var(--color-text-muted)]')}>
                      {formatDate(task.dueDate)}
                    </span>
                  )}
                  <StatusBadge variant={STATUS_VARIANT[task.status]}>{STATUS_LABEL[task.status]}</StatusBadge>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
