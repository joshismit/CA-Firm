// src/modules/users/components/UserQuickActions.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
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
import { useDeleteUserMutation, useUpdateUserMutation } from '../hooks'
import { USER_STATUS_LABELS } from '../constants'
import type { User, UserStatus } from '../types'

const MANUAL_STATUSES: UserStatus[] = ['ACTIVE', 'INACTIVE', 'SUSPENDED']

function ChangeStatusDialog({ user }: { user: User }) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<UserStatus>(user.status)
  const mutation = useUpdateUserMutation(user.id)

  return (
    <DialogRoot open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">Change status</Button>
      </DialogTrigger>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Change status for {user.firstName} {user.lastName}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="user-status">New status</Label>
            <Select
              value={status}
              onChange={(v) => setStatus(v as UserStatus)}
              options={MANUAL_STATUSES.map((s) => ({ value: s, label: USER_STATUS_LABELS[s] }))}
            />
          </div>
          {mutation.isError && <p className="text-[12px] text-[var(--color-danger)]">{normalizeApiError(mutation.error).message}</p>}
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">Cancel</Button>
          </DialogClose>
          <Button
            size="sm"
            loading={mutation.isPending}
            onClick={() => mutation.mutate({ status }, { onSuccess: () => setOpen(false) })}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  )
}

export interface UserQuickActionsProps {
  user: User
}

export function UserQuickActions({ user }: UserQuickActionsProps) {
  const navigate = useNavigate()
  const deleteMutation = useDeleteUserMutation()

  const handleDelete = () => {
    if (!window.confirm(`Remove ${user.firstName} ${user.lastName}? This cannot be undone.`)) return
    deleteMutation.mutate(user.id, { onSuccess: () => navigate('/staff/users') })
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Can permission={PERMISSIONS.USERS_MANAGE}>
        <Button variant="secondary" size="sm" leadingIcon={<Pencil className="w-3.5 h-3.5" />} onClick={() => navigate(`/staff/users/${user.id}/edit`)}>
          Edit
        </Button>
        {!user.isOwner && <ChangeStatusDialog user={user} />}
        {!user.isOwner && (
          <Button variant="danger" size="sm" leadingIcon={<Trash2 className="w-3.5 h-3.5" />} onClick={handleDelete} loading={deleteMutation.isPending}>
            Remove
          </Button>
        )}
      </Can>
    </div>
  )
}
