// src/modules/roles/components/RoleQuickActions.tsx
import { useNavigate } from 'react-router-dom'
import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Can } from '@/components/common/Can'
import { PERMISSIONS } from '@/config/permissions.config'
import { useDeleteRoleMutation } from '../hooks'
import type { Role } from '../types'

export interface RoleQuickActionsProps {
  role: Role
}

export function RoleQuickActions({ role }: RoleQuickActionsProps) {
  const navigate = useNavigate()
  const deleteMutation = useDeleteRoleMutation()
  const isSystemRole = role.type === 'SYSTEM'

  const handleDelete = () => {
    if (!window.confirm(`Delete role "${role.name}"? This cannot be undone.`)) return
    deleteMutation.mutate(role.id, { onSuccess: () => navigate('/staff/roles') })
  }

  return (
    <div className="flex items-center gap-2">
      <Can permission={PERMISSIONS.ROLES_MANAGE}>
        <Button variant="secondary" size="sm" leadingIcon={<Pencil className="w-3.5 h-3.5" />} onClick={() => navigate(`/staff/roles/${role.id}/edit`)}>
          Edit
        </Button>
        {!isSystemRole && (
          <Button variant="danger" size="sm" leadingIcon={<Trash2 className="w-3.5 h-3.5" />} onClick={handleDelete} loading={deleteMutation.isPending}>
            Delete
          </Button>
        )}
      </Can>
    </div>
  )
}
