// src/modules/documents/components/DocumentQuickActions.tsx
// Download gates on PERMISSIONS.DOCUMENTS_READ, matching backend/src/modules/documents/routes/
// document.routes.ts's GET /documents/:id/download (requirePermission(DOCUMENT_PERMISSIONS.READ)).
// Edit gates on PERMISSIONS.DOCUMENTS_UPDATE, Delete on PERMISSIONS.DOCUMENTS_DELETE - both exact,
// real permission matches (no substitution needed).
import { Download, Pencil, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Can } from '@/components/common/Can'
import { PERMISSIONS } from '@/config/permissions.config'
import { useDeleteDocumentMutation, useDownloadDocumentMutation } from '../hooks'
import type { DocumentFile } from '../types'

export interface DocumentQuickActionsProps {
  document: DocumentFile
}

export function DocumentQuickActions({ document }: DocumentQuickActionsProps) {
  const navigate = useNavigate()
  const deleteMutation = useDeleteDocumentMutation()
  const downloadMutation = useDownloadDocumentMutation()

  const handleDelete = () => {
    if (!window.confirm(`Delete "${document.fileName}"? This cannot be undone.`)) return
    deleteMutation.mutate(document.id, { onSuccess: () => navigate('/documents') })
  }

  return (
    <div className="flex items-center gap-2">
      <Can permission={PERMISSIONS.DOCUMENTS_READ}>
        <Button
          variant="outline"
          size="sm"
          leadingIcon={<Download className="w-3.5 h-3.5" />}
          onClick={() => downloadMutation.mutate(document.id)}
          loading={downloadMutation.isPending}
        >
          Download
        </Button>
      </Can>
      <Can permission={PERMISSIONS.DOCUMENTS_UPDATE}>
        <Button
          variant="secondary"
          size="sm"
          leadingIcon={<Pencil className="w-3.5 h-3.5" />}
          onClick={() => navigate(`/documents/${document.id}/edit`)}
        >
          Edit
        </Button>
      </Can>
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
    </div>
  )
}
