// src/modules/contacts/components/ContactQuickActions.tsx
import { Pencil, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Can } from '@/components/common/Can'
import { PERMISSIONS } from '@/config/permissions.config'
import { useDeleteContactMutation } from '../hooks'
import type { Contact } from '../types'

export interface ContactQuickActionsProps {
  contact: Contact
}

export function ContactQuickActions({ contact }: ContactQuickActionsProps) {
  const navigate = useNavigate()
  const deleteMutation = useDeleteContactMutation()

  const handleDelete = () => {
    const name = `${contact.firstName} ${contact.lastName ?? ''}`.trim()
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return
    deleteMutation.mutate(contact.id, { onSuccess: () => navigate('/contacts') })
  }

  return (
    <div className="flex items-center gap-2">
      <Can permission={PERMISSIONS.CONTACTS_UPDATE}>
        <Button
          variant="secondary"
          size="sm"
          leadingIcon={<Pencil className="w-3.5 h-3.5" />}
          onClick={() => navigate(`/contacts/${contact.id}/edit`)}
        >
          Edit
        </Button>
      </Can>
      <Can permission={PERMISSIONS.CONTACTS_DELETE}>
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
