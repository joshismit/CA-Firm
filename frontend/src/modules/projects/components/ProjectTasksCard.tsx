// src/modules/projects/components/ProjectTasksCard.tsx
// "Related Tasks" + "Progress"/"Statistics" - all derived from one real, already-supported call:
// GET /tasks/project/:projectId (useTasksByProjectQuery, backend/src/modules/tasks/routes/
// task.routes.ts). Total/completed/overdue counts and the progress bar are computed client-side
// from that single fetched array - no second query, no invented aggregate endpoint.
import { Link } from 'react-router-dom'
import { CheckSquare } from 'lucide-react'
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { StatCard, StatsGrid } from '@/components/shared/StatCard/StatCard'
import { StatusBadge } from '@/components/shared/StatusBadge/StatusBadge'
import { Spinner, ErrorState, EmptyState } from '@/components/feedback'
import { normalizeApiError } from '@/services/api-error'
import { formatDate, cn } from '@/lib/utils'
import { useTasksByProjectQuery } from '@/modules/tasks/hooks'
import type { TaskStatus } from '@/modules/tasks/types'

const TASK_STATUS_VARIANT: Record<TaskStatus, 'default' | 'success' | 'warning' | 'info' | 'danger'> = {
  TODO: 'default',
  IN_PROGRESS: 'info',
  REVIEW: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
}

const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  REVIEW: 'Review',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

export interface ProjectTasksCardProps {
  projectId: string
}

export function ProjectTasksCard({ projectId }: ProjectTasksCardProps) {
  const { data: tasks, isLoading, isError, error, refetch } = useTasksByProjectQuery(projectId)

  if (isLoading) {
    return (
      <Card>
        <CardHeader title="Related Tasks" />
        <Spinner fullScreen={false} label="Loading tasks…" className="py-8" />
      </Card>
    )
  }

  if (isError) {
    return (
      <Card>
        <CardHeader title="Related Tasks" />
        <ErrorState title="Couldn't load tasks" message={normalizeApiError(error).message} onRetry={refetch} className="py-8" />
      </Card>
    )
  }

  const all = tasks ?? []
  const total = all.length
  const completed = all.filter((t) => t.isCompleted).length
  const overdue = all.filter((t) => t.isOverdue).length
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <Card>
      <CardHeader title="Related Tasks" action={<span className="text-[11px] text-[var(--color-text-muted)]">{total} total</span>} />

      {total === 0 ? (
        <EmptyState icon={CheckSquare} title="No tasks linked" description="Tasks assigned to this project will appear here." />
      ) : (
        <div className="space-y-4">
          <StatsGrid className="sm:grid-cols-3 lg:grid-cols-3">
            <StatCard label="Total Tasks" value={total} icon={CheckSquare} />
            <StatCard label="Completed" value={completed} />
            <StatCard label="Overdue" value={overdue} />
          </StatsGrid>

          <div>
            <div className="flex items-center justify-between text-[11px] text-[var(--color-text-muted)] mb-1.5">
              <span>Progress</span>
              <span className="font-medium text-[var(--color-text-body)]">{progressPct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--color-surface)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--color-primary-600)] transition-all"
                style={{ width: `${progressPct}%` }}
                role="progressbar"
                aria-valuenow={progressPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Task completion progress"
              />
            </div>
          </div>

          <ul className="divide-y divide-[var(--color-border)]">
            {all.slice(0, 5).map((task) => (
              <li key={task.id} className="py-2 first:pt-0 last:pb-0">
                <Link
                  to={`/tasks/${task.id}`}
                  className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] hover:bg-[var(--color-hover)] transition-colors -mx-1 px-1 py-1"
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
                      <span className={cn('text-[11px]', task.isOverdue ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-muted)]')}>
                        {formatDate(task.dueDate)}
                      </span>
                    )}
                    <StatusBadge variant={TASK_STATUS_VARIANT[task.status]}>{TASK_STATUS_LABELS[task.status]}</StatusBadge>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
