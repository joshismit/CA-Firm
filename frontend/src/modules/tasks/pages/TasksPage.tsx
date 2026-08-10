// src/modules/tasks/pages/TasksPage.tsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader/PageHeader'
import { Tabs } from '@/components/shared/Tabs/Tabs'
import { Card } from '@/components/shared/Card/Card'
import { Separator } from '@/components/shared/Separator/Separator'
import { StatusBadge } from '@/components/shared/StatusBadge/StatusBadge'
import { Can } from '@/components/common/Can'
import { PERMISSIONS } from '@/config/permissions.config'
import { normalizeApiError } from '@/services/api-error'
import { useAuthStore } from '@/store/auth.store'
import { cn, formatDate } from '@/lib/utils'
import { useTasksQuery } from '../hooks'
import { CreateTaskDialog } from '../components'
import type { TaskStatus } from '../types'

type TabValue = 'all' | TaskStatus

interface TasksPageProps {
  /** 'my' presets the assignee filter to the signed-in user; 'team' (default) shows every task. */
  scope?: 'my' | 'team'
}

const STATUS_CONFIG: Record<TaskStatus, { variant: 'default' | 'success' | 'warning' | 'info' | 'danger'; label: string }> = {
  TODO: { variant: 'default', label: 'To Do' },
  IN_PROGRESS: { variant: 'info', label: 'In Progress' },
  REVIEW: { variant: 'warning', label: 'Review' },
  COMPLETED: { variant: 'success', label: 'Completed' },
  CANCELLED: { variant: 'danger', label: 'Cancelled' },
}

export function TasksPage({ scope = 'team' }: TasksPageProps) {
  const [tab, setTab] = useState<TabValue>('all')
  const currentUserId = useAuthStore((s) => s.user?.id)
  const navigate = useNavigate()

  const { data, isLoading, isError, error } = useTasksQuery({
    status: tab === 'all' ? undefined : tab,
    assigneeId: scope === 'my' ? currentUserId : undefined,
    page: 1,
    limit: 20,
  })

  const tasks = data?.data ?? []
  const total = data?.meta?.total ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        title={scope === 'my' ? 'My Tasks' : 'Team Tasks'}
        description={`${total} task${total === 1 ? '' : 's'}`}
        actions={
          <Can permission={PERMISSIONS.TASKS_CREATE}>
            <CreateTaskDialog onCreated={(taskId) => navigate(`/tasks/${taskId}`)} />
          </Can>
        }
      />

      <Tabs
        value={tab}
        onChange={(v) => setTab(v as TabValue)}
        tabs={[
          { value: 'all', label: 'All' },
          { value: 'TODO', label: 'To Do' },
          { value: 'IN_PROGRESS', label: 'In Progress' },
          { value: 'REVIEW', label: 'Review' },
          { value: 'COMPLETED', label: 'Completed' },
        ]}
      />

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="h-[88px] shimmer">{null}</Card>
          ))}
        </div>
      )}

      {isError && (
        <Card>
          <div className="flex items-start gap-2 text-[13px] text-[var(--color-danger-fg)]">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{normalizeApiError(error).message || "Couldn't load tasks. Please try again."}</span>
          </div>
        </Card>
      )}

      {!isLoading && !isError && tasks.length === 0 && (
        <Card>
          <p className="text-center text-[13px] text-[var(--color-text-muted)] py-6">
            No tasks found for this filter.
          </p>
        </Card>
      )}

      <div className="space-y-3">
        {tasks.map((task) => {
          const status = STATUS_CONFIG[task.status]
          return (
            <Card key={task.id}>
              <div className="flex items-start justify-between gap-4">
                <h4 className="text-[15px] font-semibold text-[var(--color-text-heading)]">{task.title}</h4>
                <StatusBadge variant={status.variant} dot>
                  {status.label}
                </StatusBadge>
              </div>

              <div className="mt-2 flex items-center justify-between gap-4 text-[12px]">
                <p className="text-[var(--color-text-muted)] truncate">{task.description || 'No description'}</p>
                {task.dueDate && (
                  <p className={cn('shrink-0', task.isOverdue ? 'font-medium text-[var(--color-danger)]' : 'text-[var(--color-text-muted)]')}>
                    Due {formatDate(task.dueDate)}
                    {task.isOverdue && ' · Overdue'}
                  </p>
                )}
              </div>

              <Separator className="my-3.5" />

              <Link
                to={`/tasks/${task.id}`}
                className="h-7 rounded-[var(--radius-sm)] bg-[var(--color-surface)] px-2.5 text-[12px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] inline-flex items-center"
              >
                View
              </Link>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
