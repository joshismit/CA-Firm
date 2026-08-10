// src/modules/client-portal/pages/ClientPortalTaskDetailPage.tsx
// Minimal client-facing task detail - reuses the real Tasks module hooks (GET /tasks/:id already
// server-scopes a CLIENT caller to their own client, returning 403 for any other client's task -
// see TaskAccessScopeService's CLIENT branch). The "Assign" control is gated by tasks:assign
// (granted to the Client role, not tasks:update), matching backend/src/modules/tasks/routes -
// POST /tasks/:id/assign is the only mutation a client-portal user is permitted to call.
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertCircle, ArrowLeft } from 'lucide-react'
import { PageLayout, PageHeader, PageContent } from '@/components/page'
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { StatusBadge } from '@/components/shared/StatusBadge/StatusBadge'
import { Button } from '@/components/ui/button'
import { Can } from '@/components/common/Can'
import { PERMISSIONS } from '@/config/permissions.config'
import { normalizeApiError } from '@/services/api-error'
import { formatDate } from '@/lib/utils'
import { useAssignTaskMutation, useTaskQuery } from '@/modules/tasks/hooks'
import { StaffAssigneePicker } from '@/modules/tasks/components'
import type { TaskStatus } from '@/modules/tasks/types'

const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  REVIEW: 'Review',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

const STATUS_VARIANT: Record<TaskStatus, 'default' | 'success' | 'warning' | 'info' | 'danger'> = {
  TODO: 'default',
  IN_PROGRESS: 'info',
  REVIEW: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
}

export function ClientPortalTaskDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: task, isLoading, isError, error } = useTaskQuery(id!)
  const assignMutation = useAssignTaskMutation(id!)
  const [assigneeId, setAssigneeId] = useState('')

  return (
    <PageLayout>
      <PageContent>
        <Link
          to="/portal/tasks"
          className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-body)] mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to my tasks
        </Link>

        {isLoading && <Card className="h-[160px] shimmer">{null}</Card>}

        {(isError || (!isLoading && !task)) && (
          <Card>
            <div className="flex items-start gap-2 text-[13px] text-[var(--color-danger-fg)]">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error ? normalizeApiError(error).message : 'Task not found.'}</span>
            </div>
          </Card>
        )}

        {task && (
          <div className="space-y-6">
            <PageHeader
              title={task.title}
              description={task.description ?? undefined}
              actions={<StatusBadge variant={STATUS_VARIANT[task.status]} dot>{STATUS_LABELS[task.status]}</StatusBadge>}
            />

            <Card>
              <CardHeader title="Details" />
              <dl className="grid grid-cols-2 gap-4 text-[13px]">
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Due date</dt>
                  <dd className={task.isOverdue ? 'mt-0.5 font-medium text-[var(--color-danger)]' : 'mt-0.5 text-[var(--color-text-body)]'}>
                    {task.dueDate ? formatDate(task.dueDate) : '—'}
                    {task.isOverdue && ' · Overdue'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Assigned to</dt>
                  <dd className="mt-0.5 text-[var(--color-text-body)]">{task.assigneeId ? 'Assigned' : 'Unassigned'}</dd>
                </div>
              </dl>
            </Card>

            <Can permission={PERMISSIONS.TASKS_ASSIGN}>
              <Card>
                <CardHeader title="Assign to a staff member" />
                <div className="flex items-center gap-3">
                  <StaffAssigneePicker value={assigneeId || undefined} onChange={setAssigneeId} className="max-w-[280px]" />
                  <Button size="sm" onClick={() => assignMutation.mutate(assigneeId)} loading={assignMutation.isPending} disabled={!assigneeId}>
                    Assign
                  </Button>
                </div>
                {assignMutation.isError && (
                  <p className="mt-2 text-[12px] text-[var(--color-danger)]">{normalizeApiError(assignMutation.error).message}</p>
                )}
              </Card>
            </Can>
          </div>
        )}
      </PageContent>
    </PageLayout>
  )
}
