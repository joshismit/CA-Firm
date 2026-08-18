// src/modules/business/components/BusinessQuickActions.tsx
import { Pencil, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Can } from '@/components/common/Can'
import { PERMISSIONS } from '@/config/permissions.config'
import { useDeleteBusinessMutation } from '../hooks'
import type { Business } from '../types'

export interface BusinessQuickActionsProps {
  business: Business
}

export function BusinessQuickActions({ business }: BusinessQuickActionsProps) {
  const navigate = useNavigate()
  const deleteMutation = useDeleteBusinessMutation()

  const handleDelete = () => {
    if (!window.confirm(`Delete "${business.name}"? This cannot be undone.`)) return
    deleteMutation.mutate(business.id, { onSuccess: () => navigate('/business') })
  }

  return (
    <div className="flex items-center gap-2">
      <Can permission={PERMISSIONS.BUSINESS_UPDATE}>
        <Button variant="secondary" size="sm" leadingIcon={<Pencil className="w-3.5 h-3.5" />} onClick={() => navigate(`/business/${business.id}/edit`)}>
          Edit
        </Button>
      </Can>
      <Can permission={PERMISSIONS.BUSINESS_DELETE}>
        <Button
          variant="danger"
          size="sm"
          leadingIcon={<Trash2 className="w-3.5 h-3.5" />}
          onClick={handleDelete}
          loading={deleteMutation.isPending}
        >
          Delete
        </Button>
      </Can>
    </div>
  )
}
