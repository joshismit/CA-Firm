// src/modules/documents/components/CreateFolderDialog.tsx
// PRD §7.1 rule 9 "create folder dialog" - creates a root folder or a sub-folder of
// `parentFolderId` (both fixed to the currently-selected Business/category, not user-editable
// here - the whole browser page is already scoped to one Business/category).
import { useState } from 'react'
import { Dialog } from '@/components/modals'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { normalizeApiError } from '@/services/api-error'
import { useCreateFolderMutation } from '../hooks'
import type { DocumentCategory } from '../types'

export interface CreateFolderDialogProps {
  open: boolean
  onClose: () => void
  businessId: string
  category: DocumentCategory
  parentFolderId: string | null
  /** The parent's name, shown in the description ("Inside: <name>") — undefined for a root folder. */
  parentFolderName?: string
  onCreated?: (folderId: string) => void
}

export function CreateFolderDialog({
  open,
  onClose,
  businessId,
  category,
  parentFolderId,
  parentFolderName,
  onCreated,
}: CreateFolderDialogProps) {
  const [name, setName] = useState('')
  const mutation = useCreateFolderMutation(businessId)

  const handleClose = () => {
    setName('')
    mutation.reset()
    onClose()
  }

  const handleSubmit = async () => {
    if (!name.trim()) return
    try {
      const folder = await mutation.mutateAsync({ category, parentFolderId: parentFolderId ?? undefined, name: name.trim() })
      setName('')
      onCreated?.(folder.id)
      onClose()
    } catch {
      // Error surfaced below via mutation.isError - nothing further to do here.
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="New folder"
      description={parentFolderName ? `Inside: ${parentFolderName}` : 'At the category root'}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={mutation.isPending} disabled={!name.trim()}>
            Create
          </Button>
        </>
      }
    >
      <FormField label="Folder name" htmlFor="new-folder-name" error={mutation.isError ? normalizeApiError(mutation.error).message : undefined}>
        <Input
          id="new-folder-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. FY 2025-26"
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
