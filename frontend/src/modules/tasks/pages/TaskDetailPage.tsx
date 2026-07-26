// src/modules/tasks/pages/TaskDetailPage.tsx
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader/PageHeader'
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { StatusBadge } from '@/components/shared/StatusBadge/StatusBadge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Can } from '@/components/common/Can'
import { PERMISSIONS } from '@/config/permissions.config'
import { normalizeApiError } from '@/services/api-error'
import { formatDate } from '@/lib/utils'
import {
  useDeleteTaskMutation,
  useTaskQuery,
  useUpdateTaskMutation,
  useUpdateTaskStatusMutation,
} from '../hooks'
import { taskStatusValues } from '../schemas'
import type { TaskStatus } from '../types'

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

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: task, isLoading, isError, error } = useTaskQuery(id!)

  const statusMutation = useUpdateTaskStatusMutation(id!)
  const reassignMutation = useUpdateTaskMutation(id!)
  const deleteMutation = useDeleteTaskMutation()

  const [assigneeId, setAssigneeId] = useState('')
  const [projectId, setProjectId] = useState('')

  if (isLoading) {
    return <Card className="h-[200px] shimmer">{null}</Card>
  }

  if (isError || !task) {
    return (
      <Card>
        <div className="flex items-start gap-2 text-[13px] text-[var(--color-danger-fg)]">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error ? normalizeApiError(error).message : 'Task not found.'}</span>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Link
        to="/tasks/team"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-body)]"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to tasks
      </Link>

      <PageHeader
        title={task.title}
        description={task.description ?? undefined}
        actions={
          <>
            <Can permission={PERMISSIONS.TASKS_DELETE}>
              <Button variant="danger" size="sm" onClick={() => deleteMutation.mutate(task.id)} loading={deleteMutation.isPending}>
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </Button>
            </Can>
          </>
        }
      />

      <Card>
        <CardHeader
          title="Status"
          action={<StatusBadge variant={STATUS_VARIANT[task.status]} dot>{STATUS_LABELS[task.status]}</StatusBadge>}
        />
        <Can permission={PERMISSIONS.TASKS_UPDATE}>
          <div className="flex items-center gap-3">
            <Select
              value={task.status}
              onChange={(v) => statusMutation.mutate({ status: v as TaskStatus })}
              options={taskStatusValues.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
              className="max-w-[220px]"
            />
            {statusMutation.isError && (
              <p className="text-[12px] text-[var(--color-danger)]">{normalizeApiError(statusMutation.error).message}</p>
            )}
          </div>
        </Can>
      </Card>

      <Card>
        <CardHeader title="Details" />
        <dl className="grid grid-cols-2 gap-4 text-[13px]">
          <div>
            <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Project</dt>
            <dd className="mt-0.5 text-[var(--color-text-body)] font-mono">{task.projectId ?? 'Standalone'}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Assignee</dt>
            <dd className="mt-0.5 text-[var(--color-text-body)] font-mono">{task.assigneeId ?? 'Unassigned'}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Start date</dt>
            <dd className="mt-0.5 text-[var(--color-text-body)]">{task.startDate ? formatDate(task.startDate) : '—'}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Due date</dt>
            <dd className={task.isOverdue ? 'mt-0.5 font-medium text-[var(--color-danger)]' : 'mt-0.5 text-[var(--color-text-body)]'}>
              {task.dueDate ? formatDate(task.dueDate) : '—'}
              {task.isOverdue && ' · Overdue'}
            </dd>
          </div>
        </dl>
      </Card>

      <Can permission={PERMISSIONS.TASKS_UPDATE}>
        <Card>
          <CardHeader title="Reassign / move" />
          <p className="text-[12px] text-[var(--color-text-muted)] mb-3">
            Unlike Projects, a Task's assignee and project can be changed after creation.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>New assignee ID</Label>
              <Input value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} placeholder="User UUID" />
            </div>
            <div className="space-y-1.5">
              <Label>New project ID</Label>
              <Input value={projectId} onChange={(e) => setProjectId(e.target.value)} placeholder="Project UUID" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Button
              size="sm"
              onClick={() =>
                reassignMutation.mutate({
                  assigneeId: assigneeId.trim() || undefined,
                  projectId: projectId.trim() || undefined,
                })
              }
              loading={reassignMutation.isPending}
              disabled={!assigneeId.trim() && !projectId.trim()}
            >
              Save
            </Button>
            {reassignMutation.isError && (
              <p className="text-[12px] text-[var(--color-danger)]">{normalizeApiError(reassignMutation.error).message}</p>
            )}
          </div>
        </Card>
      </Can>
    </div>
  )
}
