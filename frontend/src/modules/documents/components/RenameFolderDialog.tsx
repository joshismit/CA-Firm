// src/modules/documents/components/RenameFolderDialog.tsx
// PRD §7.1 rule 9 "rename folder" - name-only update (category/business/parent are immutable
// after creation, matching backend's updateFolderSchema).
import { useEffect, useState } from 'react'
import { Dialog } from '@/components/modals'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { normalizeApiError } from '@/services/api-error'
import { useRenameFolderMutation } from '../hooks'
import type { DocumentFolder } from '../types'

export interface RenameFolderDialogProps {
  folder: DocumentFolder | null
  businessId: string
  onClose: () => void
}

export function RenameFolderDialog({ folder, businessId, onClose }: RenameFolderDialogProps) {
  const [name, setName] = useState(folder?.name ?? '')
  const mutation = useRenameFolderMutation(businessId)

  useEffect(() => {
    setName(folder?.name ?? '')
    mutation.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset the field whenever the target folder changes.
  }, [folder?.id])

  const handleClose = () => {
    mutation.reset()
    onClose()
  }

  const handleSubmit = async () => {
    if (!folder || !name.trim()) return
    try {
      await mutation.mutateAsync({ id: folder.id, payload: { name: name.trim() } })
      onClose()
    } catch {
      // Error surfaced below via mutation.isError.
    }
  }

  return (
    <Dialog
      open={!!folder}
      onClose={handleClose}
      title="Rename folder"
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={mutation.isPending} disabled={!name.trim()}>
            Save
          </Button>
        </>
      }
    >
      <FormField label="Folder name" htmlFor="rename-folder-name" error={mutation.isError ? normalizeApiError(mutation.error).message : undefined}>
        <Input
          id="rename-folder-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          invalid={mutation.isError}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit()
          }}
        />
      </FormField>
    </Dialog>
  )
}
