// src/modules/dashboard/components/RecentTasksWidget.tsx
// Extracted from DashboardPage's "My Tasks" card - same task-row styling and status/priority helpers.
import { AlertCircle, Calendar, CheckCircle2, Clock } from 'lucide-react'
import { StatusBadge } from '@/components/shared/StatusBadge/StatusBadge'
import { formatDate, cn } from '@/lib/utils'
import { ChartCard } from './ChartCard'

export interface RecentTaskItem {
  id: string
  title: string
  client: string
  due: string
  priority: string
  status: string
}

export interface RecentTasksWidgetProps {
  tasks: RecentTaskItem[]
  pendingCount?: number
}

function TaskStatusIcon({ status }: { status: string }) {
  if (status === 'completed') return <CheckCircle2 className="w-4 h-4 text-[var(--color-success)]" />
  if (status === 'in_progress') return <Clock className="w-4 h-4 text-[var(--color-info)]" />
  if (status === 'overdue') return <AlertCircle className="w-4 h-4 text-[var(--color-danger)]" />
  return <Clock className="w-4 h-4 text-[var(--color-text-muted)]" />
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, 'danger' | 'warning' | 'default'> = {
    high: 'danger',
    medium: 'warning',
    low: 'default',
  }
  return (
    <StatusBadge variant={map[priority] || 'default'}>{priority}</StatusBadge>
  )
}

export function RecentTasksWidget({ tasks, pendingCount }: RecentTasksWidgetProps) {
  return (
    <ChartCard
      title="My Tasks"
      action={pendingCount != null && <span className="text-[11px] text-[var(--color-text-muted)]">{pendingCount} pending</span>}
    >
      <div className="space-y-2">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={cn(
              'flex items-start gap-2.5 p-2.5 rounded-[var(--radius-md)]',
              'hover:bg-[var(--color-hover)] transition-colors cursor-default',
              task.status === 'overdue' && 'border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)]'
            )}
          >
            <TaskStatusIcon status={task.status} />
            <div className="flex-1 min-w-0">
              <p
                className={cn(
                  'text-[12px] font-medium leading-tight truncate',
                  task.status === 'completed' ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text-body)]'
                )}
              >
                {task.title}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-[var(--color-text-muted)]">{task.client}</span>
                <span className="text-[var(--color-border-strong)]">·</span>
                <span
                  className={cn(
                    'flex items-center gap-0.5 text-[10px]',
                    task.status === 'overdue' ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-muted)]'
                  )}
                >
                  <Calendar className="w-2.5 h-2.5" />
                  {formatDate(task.due)}
                </span>
              </div>
            </div>
            <PriorityBadge priority={task.priority} />
          </div>
        ))}
      </div>
    </ChartCard>
  )
}
