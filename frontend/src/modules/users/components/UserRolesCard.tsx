// src/modules/users/components/UserRolesCard.tsx
// getUserRoles always 501s (no backend module exists yet - see api/index.ts's header comment on
// that function). "Assign role" opens in a Drawer rather than a full page - a small, in-context
// action on a single field of this record doesn't warrant leaving the Detail page.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Shield } from 'lucide-react'
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { StatusBadge } from '@/components/shared/StatusBadge/StatusBadge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Spinner, ErrorState, EmptyState } from '@/components/feedback'
import { Can } from '@/components/common/Can'
import {
  DrawerRoot,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerBody,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer'
import { PERMISSIONS } from '@/config/permissions.config'
import { normalizeApiError } from '@/services/api-error'
import { useUserRolesQuery } from '../hooks'
import { useRolesQuery, useAssignRoleMutation } from '@/modules/roles/hooks'

function AssignRoleDrawer({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false)
  const [roleId, setRoleId] = useState('')
  const rolesQuery = useRolesQuery({ page: 1, limit: 100 })
  const assignMutation = useAssignRoleMutation()

  return (
    <DrawerRoot open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="secondary" size="sm" leadingIcon={<Plus className="w-3.5 h-3.5" />}>
          Assign role
        </Button>
      </DrawerTrigger>
      <DrawerContent side="right" size="sm">
        <DrawerHeader>
          <DrawerTitle>Assign a role</DrawerTitle>
          <DrawerDescription>Grant this user an additional role.</DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="assign-role-id">Role</Label>
            {rolesQuery.isLoading ? (
              <Spinner fullScreen={false} label="Loading roles…" className="py-4" />
            ) : rolesQuery.isError ? (
              <ErrorState message={normalizeApiError(rolesQuery.error).message} onRetry={rolesQuery.refetch} className="py-4" />
            ) : (
              <Select
                value={roleId}
                onChange={setRoleId}
                options={(rolesQuery.data?.data ?? []).map((r) => ({ value: r.id, label: r.name }))}
                placeholder="Select a role"
              />
            )}
          </div>
          {assignMutation.isError && <p className="text-[12px] text-[var(--color-danger)]">{normalizeApiError(assignMutation.error).message}</p>}
        </DrawerBody>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="ghost" size="sm">Cancel</Button>
          </DrawerClose>
          <Button
            size="sm"
            disabled={!roleId}
            loading={assignMutation.isPending}
            onClick={() => assignMutation.mutate({ userId, roleId }, { onSuccess: () => setOpen(false) })}
          >
            Assign
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </DrawerRoot>
  )
}

export interface UserRolesCardProps {
  userId: string
}

export function UserRolesCard({ userId }: UserRolesCardProps) {
  const { data: roles, isLoading, isError, error, refetch } = useUserRolesQuery(userId)

  return (
    <Card>
      <CardHeader
        title="Roles"
        action={
          <Can permission={PERMISSIONS.USERS_MANAGE}>
            <AssignRoleDrawer userId={userId} />
          </Can>
        }
      />
      {isLoading ? (
        <Spinner fullScreen={false} label="Loading roles…" className="py-8" />
      ) : isError ? (
        <ErrorState title="Couldn't load roles" message={normalizeApiError(error).message} onRetry={refetch} className="py-8" />
      ) : !roles || roles.length === 0 ? (
        <EmptyState icon={Shield} title="No roles assigned" description="Roles assigned to this user will appear here." />
      ) : (
        <div className="flex flex-wrap gap-2">
          {roles.map((role) => (
            <Link key={role.id} to={`/staff/roles/${role.id}`}>
              <StatusBadge variant="default">{role.name}</StatusBadge>
            </Link>
          ))}
        </div>
      )}
    </Card>
  )
}
