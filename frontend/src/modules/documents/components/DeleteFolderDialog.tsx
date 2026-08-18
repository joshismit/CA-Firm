// src/modules/documents/components/DeleteFolderDialog.tsx
// PRD §7.1 rule 9 "delete folder" - confirms, then calls DELETE /documents/folders/:id. The backend
// rejects (409) a non-empty folder (see document-folder.service.ts's deleteFolder()) rather than
// recursively deleting - this dialog surfaces that 409 as a plain error message, it doesn't offer
// a "force delete" escape hatch, matching the backend's deliberate no-recursive-delete choice.
import { Dialog } from '@/components/modals'
import { Button } from '@/components/ui/button'
import { normalizeApiError } from '@/services/api-error'
import { useDeleteFolderMutation } from '../hooks'
import type { DocumentFolder } from '../types'

export interface DeleteFolderDialogProps {
  folder: DocumentFolder | null
  businessId: string
  onClose: () => void
}

export function DeleteFolderDialog({ folder, businessId, onClose }: DeleteFolderDialogProps) {
  const mutation = useDeleteFolderMutation(businessId)

  const handleClose = () => {
    mutation.reset()
    onClose()
  }

  const handleConfirm = async () => {
    if (!folder) return
    try {
      await mutation.mutateAsync(folder.id)
      onClose()
    } catch {
      // Error surfaced below via mutation.isError.
    }
  }

  return (
    <Dialog
      open={!!folder}
      onClose={handleClose}
      title="Delete folder"
      description={folder ? `Delete "${folder.name}"? This cannot be undone.` : undefined}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleConfirm} loading={mutation.isPending}>
            Delete
          </Button>
        </>
      }
    >
      {mutation.isError && (
        <p className="text-[12px] text-[var(--color-danger)]">{normalizeApiError(mutation.error).message}</p>
      )}
    </Dialog>
  )
}
