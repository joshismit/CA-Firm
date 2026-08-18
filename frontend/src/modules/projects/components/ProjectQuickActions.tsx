// src/modules/projects/components/ProjectQuickActions.tsx
// Extracted from ProjectDetailPage's former inline header actions - same real mutations
// (status/archive/restore/delete), just promoted to a reusable component mirroring
// BusinessQuickActions/ContactQuickActions.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pencil, Archive, ArchiveRestore, Trash2 } from 'lucide-react'
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
import {
  useArchiveProjectMutation,
  useDeleteProjectMutation,
  useRestoreProjectMutation,
  useUpdateProjectStatusMutation,
} from '../hooks'
import { projectStatusValues } from '../schemas'
import { PROJECT_STATUS_LABELS, PROJECT_DELETABLE_STATUSES } from '../constants'
import type { Project, ProjectStatus } from '../types'

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
            <Label htmlFor="project-status">New status</Label>
            <Select
              value={status}
              onChange={(v) => setStatus(v as ProjectStatus)}
              options={projectStatusValues.map((s) => ({ value: s, label: PROJECT_STATUS_LABELS[s] }))}
            />
          </div>
          {needsReason && (
            <div className="space-y-1.5">
              <Label htmlFor="project-status-reason">Reason</Label>
              <Input
                id="project-status-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Required for On Hold / Cancelled"
              />
            </div>
          )}
          {mutation.isError && (
            <p className="text-[12px] text-[var(--color-danger)]">{normalizeApiError(mutation.error).message}</p>
          )}
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button size="sm" onClick={handleSave} loading={mutation.isPending} disabled={needsReason && !reason.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  )
}

export interface ProjectQuickActionsProps {
  project: Project
}

export function ProjectQuickActions({ project }: ProjectQuickActionsProps) {
  const navigate = useNavigate()
  const archiveMutation = useArchiveProjectMutation(project.id)
  const restoreMutation = useRestoreProjectMutation(project.id)
  const deleteMutation = useDeleteProjectMutation()

  const handleDelete = () => {
    if (!window.confirm(`Delete "${project.name}"? This cannot be undone.`)) return
    deleteMutation.mutate(project.id, { onSuccess: () => navigate('/projects') })
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Can permission={PERMISSIONS.PROJECTS_UPDATE}>
        <Button
          variant="secondary"
          size="sm"
          leadingIcon={<Pencil className="w-3.5 h-3.5" />}
          onClick={() => navigate(`/projects/${project.id}/edit`)}
        >
          Edit
        </Button>
        <ChangeStatusDialog projectId={project.id} currentStatus={project.status} />
      </Can>
      <Can permission={PERMISSIONS.PROJECTS_MANAGE}>
        {project.status === 'COMPLETED' && !project.archivedAt && (
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<Archive className="w-3.5 h-3.5" />}
            onClick={() => archiveMutation.mutate()}
            loading={archiveMutation.isPending}
          >
            Archive
          </Button>
        )}
        {project.archivedAt && (
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<ArchiveRestore className="w-3.5 h-3.5" />}
            onClick={() => restoreMutation.mutate()}
            loading={restoreMutation.isPending}
          >
            Restore
          </Button>
        )}
      </Can>
      <Can permission={PERMISSIONS.PROJECTS_DELETE}>
        {(PROJECT_DELETABLE_STATUSES as readonly ProjectStatus[]).includes(project.status) && (
          <Button
            variant="danger"
            size="sm"
            leadingIcon={<Trash2 className="w-3.5 h-3.5" />}
            onClick={handleDelete}
            loading={deleteMutation.isPending}
          >
            Delete
          </Button>
        )}
      </Can>
    </div>
  )
}
