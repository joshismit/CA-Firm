// src/modules/documents/components/DocumentQuickActions.tsx
// No "Edit" action here: the locked documents/api and documents/hooks layers have no
// updateDocument function at all (only listDocuments/getDocument/uploadDocument/deleteDocument) -
// there is nothing to submit an edit to. Delete gates on PERMISSIONS.DOCUMENTS_DELETE, which - for
// the first time this session - is an exact, real permission match (no substitution needed, unlike
// Business/Contacts' missing *_UPDATE or CRM's missing delete permission entirely).
import { Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Can } from '@/components/common/Can'
import { PERMISSIONS } from '@/config/permissions.config'
import { useDeleteDocumentMutation } from '../hooks'
import type { DocumentFile } from '../types'

export interface DocumentQuickActionsProps {
  document: DocumentFile
}

export function DocumentQuickActions({ document }: DocumentQuickActionsProps) {
  const navigate = useNavigate()
  const deleteMutation = useDeleteDocumentMutation()

  const handleDelete = () => {
    if (!window.confirm(`Delete "${document.fileName}"? This cannot be undone.`)) return
    deleteMutation.mutate(document.id, { onSuccess: () => navigate('/documents') })
  }

  return (
    <Can permission={PERMISSIONS.DOCUMENTS_DELETE}>
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
  )
}
