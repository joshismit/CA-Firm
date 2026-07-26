// src/modules/projects/pages/ProjectDetailPage.tsx
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertCircle, Archive, ArchiveRestore, ArrowLeft, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader/PageHeader'
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { Separator } from '@/components/shared/Separator/Separator'
import { StatusBadge } from '@/components/shared/StatusBadge/StatusBadge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DialogRoot,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Can } from '@/components/common/Can'
import { PERMISSIONS } from '@/config/permissions.config'
import { normalizeApiError } from '@/services/api-error'
import { formatDate } from '@/lib/utils'
import {
  useArchiveProjectMutation,
  useDeleteProjectMutation,
  useProjectQuery,
  useRestoreProjectMutation,
  useUpdateProjectStatusMutation,
} from '../hooks'
import { projectStatusValues } from '../schemas'
import type { ProjectStatus } from '../types'

const STATUS_LABELS: Record<ProjectStatus, string> = {
  DRAFT: 'Draft',
  PLANNED: 'Planned',
  ACTIVE: 'Active',
  ON_HOLD: 'On Hold',
  COMPLETED: 'Completed',
  ARCHIVED: 'Archived',
  CANCELLED: 'Cancelled',
}

const STATUS_VARIANT: Record<ProjectStatus, 'default' | 'success' | 'warning' | 'info' | 'danger'> = {
  DRAFT: 'default',
  PLANNED: 'default',
  ACTIVE: 'success',
  ON_HOLD: 'warning',
  COMPLETED: 'info',
  ARCHIVED: 'default',
  CANCELLED: 'danger',
}

function ChangeStatusDialog({ projectId, currentStatus }: { projectId: string; currentStatus: ProjectStatus }) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<ProjectStatus>(currentStatus)
  const [reason, setReason] = useState('')
  const mutation = useUpdateProjectStatusMutation(projectId)

  const needsReason = status === 'ON_HOLD' || status === 'CANCELLED'

  const handleSave = () => {
    mutation.mutate(
      { status, reason: needsReason ? reason : undefined },
      { onSuccess: () => setOpen(false) }
    )
  }

  return (
    <DialogRoot open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          Change status
        </Button>
      </DialogTrigger>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Change project status</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label>New status</Label>
            <Select
              value={status}
              onChange={(v) => setStatus(v as ProjectStatus)}
              options={projectStatusValues.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
            />
          </div>
          {needsReason && (
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Required for On Hold / Cancelled" />
            </div>
          )}
          {mutation.isError && (
            <p className="text-[12px] text-[var(--color-danger)]">
              {normalizeApiError(mutation.error).message}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">Cancel</Button>
          </DialogClose>
          <Button size="sm" onClick={handleSave} loading={mutation.isPending} disabled={needsReason && !reason.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  )
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: project, isLoading, isError, error } = useProjectQuery(id!)
  const archiveMutation = useArchiveProjectMutation(id!)
  const restoreMutation = useRestoreProjectMutation(id!)
  const deleteMutation = useDeleteProjectMutation()

  if (isLoading) {
    return <Card className="h-[200px] shimmer">{null}</Card>
  }

  if (isError || !project) {
    return (
      <Card>
        <div className="flex items-start gap-2 text-[13px] text-[var(--color-danger-fg)]">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error ? normalizeApiError(error).message : 'Project not found.'}</span>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Link
        to="/projects"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-body)]"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to projects
      </Link>

      <PageHeader
        title={project.name}
        description={project.code}
        actions={
          <>
            <Can permission={PERMISSIONS.PROJECTS_UPDATE}>
              <ChangeStatusDialog projectId={project.id} currentStatus={project.status} />
            </Can>
            <Can permission={PERMISSIONS.PROJECTS_MANAGE}>
              {project.status === 'COMPLETED' && !project.archivedAt && (
                <Button variant="secondary" size="sm" onClick={() => archiveMutation.mutate()} loading={archiveMutation.isPending}>
                  <Archive className="w-3.5 h-3.5" />
                  Archive
                </Button>
              )}
              {project.archivedAt && (
                <Button variant="secondary" size="sm" onClick={() => restoreMutation.mutate()} loading={restoreMutation.isPending}>
                  <ArchiveRestore className="w-3.5 h-3.5" />
                  Restore
                </Button>
              )}
            </Can>
            <Can permission={PERMISSIONS.PROJECTS_DELETE}>
              {['DRAFT', 'PLANNED', 'CANCELLED'].includes(project.status) && (
                <Button variant="danger" size="sm" onClick={() => deleteMutation.mutate(project.id)} loading={deleteMutation.isPending}>
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </Button>
              )}
            </Can>
          </>
        }
      />

      <Card>
        <CardHeader title="Details" action={<StatusBadge variant={STATUS_VARIANT[project.status]} dot>{STATUS_LABELS[project.status]}</StatusBadge>} />
        <dl className="grid grid-cols-2 gap-4 text-[13px]">
          <div>
            <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Client</dt>
            <dd className="mt-0.5 text-[var(--color-text-body)] font-mono">{project.clientId}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Manager</dt>
            <dd className="mt-0.5 text-[var(--color-text-body)]">{project.managerId ?? 'Unassigned'}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Start date</dt>
            <dd className="mt-0.5 text-[var(--color-text-body)]">{project.startDate ? formatDate(project.startDate) : '—'}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Due date</dt>
            <dd className={project.isOverdue ? 'mt-0.5 font-medium text-[var(--color-danger)]' : 'mt-0.5 text-[var(--color-text-body)]'}>
              {project.dueDate ? formatDate(project.dueDate) : '—'}
              {project.isOverdue && ' · Overdue'}
            </dd>
          </div>
        </dl>
        <Separator className="my-4" />
        <p className="text-[11px] text-[var(--color-text-muted)]">
          Client and code are immutable once a project is created.
        </p>
      </Card>
    </div>
  )
}
