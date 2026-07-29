// src/modules/dashboard/components/UpcomingDeadlinesWidget.tsx
// Real overdue items via the already-real, dedicated GET /projects/overdue and GET /tasks/overdue
// endpoints (same ones ProjectStatsCards/the Tasks module already use) - not a client-side date
// scan, and not fabricated.
import { Link } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { Skeleton, ErrorState, EmptyState } from '@/components/feedback'
import { formatDate, cn } from '@/lib/utils'
import { useOverdueProjectsQuery } from '@/modules/projects/hooks'
import { useOverdueTasksQuery } from '@/modules/tasks/hooks'

interface DeadlineRow {
  id: string
  type: 'project' | 'task'
  label: string
  dueDate: string
  href: string
}

export function UpcomingDeadlinesWidget() {
  const projects = useOverdueProjectsQuery()
  const tasks = useOverdueTasksQuery()

  const isLoading = projects.isLoading || tasks.isLoading
  const isError = projects.isError || tasks.isError

  const rows: DeadlineRow[] = [
    ...(projects.data ?? [])
      .filter((p) => p.dueDate)
      .map((p) => ({ id: p.id, type: 'project' as const, label: p.name, dueDate: p.dueDate!, href: `/projects/${p.id}` })),
    ...(tasks.data ?? [])
      .filter((t) => t.dueDate)
      .map((t) => ({ id: t.id, type: 'task' as const, label: t.title, dueDate: t.dueDate!, href: `/tasks/${t.id}` })),
  ]
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 6)

  return (
    <Card>
      <CardHeader title="Upcoming Deadlines" action={<AlertTriangle className="w-4 h-4 text-[var(--color-danger)]" />} />
      {isLoading ? (
        <Skeleton variant="table" rows={4} height={32} />
      ) : isError ? (
        <ErrorState message="Couldn't load deadlines." />
      ) : rows.length === 0 ? (
        <EmptyState title="Nothing overdue" description="Overdue projects and tasks will show up here." />
      ) : (
        <div className="space-y-2.5">
          {rows.map((row) => (
            <Link
              key={`${row.type}-${row.id}`}
              to={row.href}
              className="flex items-center gap-3 rounded-[var(--radius-sm)] hover:bg-[var(--color-hover)] transition-colors -mx-1 px-1 py-1"
            >
              <div className={cn('w-1 h-8 rounded-full shrink-0 bg-[var(--color-danger)]')} />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-[var(--color-text-body)] leading-tight truncate">{row.label}</p>
                <p className="text-[10px] text-[var(--color-text-muted)] capitalize">{row.type}</p>
              </div>
              <span className="text-[11px] font-medium text-[var(--color-danger)] shrink-0">{formatDate(row.dueDate)}</span>
            </Link>
          ))}
        </div>
      )}
    </Card>
  )
}
