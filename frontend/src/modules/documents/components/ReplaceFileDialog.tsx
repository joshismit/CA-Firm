// src/modules/documents/components/ReplaceFileDialog.tsx
// PRD §7.2 rules 6-8 "confirm replacement" step - shown either from DocumentVersionCard's
// explicit "Replace File" action, or after DocumentUploadPage's upload 409s with a DocumentConflict
// (same Business+Contact+Folder+Category+filename as an existing document). Always calls
// POST /documents/:id/version (useUploadDocumentVersionMutation) against the *current* version's id
// - never re-attempts the original createDocumentSchema POST, since the id is already known here.
import { useState } from 'react'
import { Dialog } from '@/components/modals'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { normalizeApiError } from '@/services/api-error'
import { useUploadDocumentVersionMutation } from '../hooks'
import { SUPPORTED_FILE_TYPES_ACCEPT, SUPPORTED_FILE_TYPES_HINT, isSupportedDocumentFile } from '../constants'
import type { DocumentFile } from '../types'

export interface ReplaceFileDialogProps {
  open: boolean
  onClose: () => void
  /** The current version being replaced - its `id` is what the new upload versions off of. */
  document: DocumentFile
  onReplaced?: (newVersion: DocumentFile) => void
}

export function ReplaceFileDialog({ open, onClose, document, onReplaced }: ReplaceFileDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [typeError, setTypeError] = useState<string | undefined>(undefined)
  const mutation = useUploadDocumentVersionMutation(document.id)

  const handleClose = () => {
    setFile(null)
    setProgress(0)
    setTypeError(undefined)
    mutation.reset()
    onClose()
  }

  const handleFileChange = (selected: File | null) => {
    mutation.reset()
    if (selected && !isSupportedDocumentFile(selected)) {
      setFile(null)
      setTypeError(`Unsupported file type. Supported types: ${SUPPORTED_FILE_TYPES_HINT}.`)
      return
    }
    setTypeError(undefined)
    setFile(selected)
  }

  const handleSubmit = async () => {
    if (!file) return
    try {
      const newVersion = await mutation.mutateAsync({
        id: document.id,
        file,
        onUploadProgress: setProgress,
      })
      onReplaced?.(newVersion)
      handleClose()
    } catch {
      // Error surfaced below via mutation.isError - nothing further to do here.
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Replace file"
      description={`This keeps v${document.version} ("${document.fileName}") available in version history and creates v${document.version + 1}. Nothing is overwritten.`}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={mutation.isPending} disabled={!file}>
            Create version {document.version + 1}
          </Button>
        </>
      }
    >
      <FormField
        label="New file"
        htmlFor="replace-file-input"
        error={typeError ?? (mutation.isError ? normalizeApiError(mutation.error).message : undefined)}
      >
        <Input
          id="replace-file-input"
          type="file"
          accept={SUPPORTED_FILE_TYPES_ACCEPT}
          invalid={!!typeError || mutation.isError}
          onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
        />
      </FormField>
      <p className="text-[11px] text-[var(--color-text-muted)] mt-1">Supported types: {SUPPORTED_FILE_TYPES_HINT}.</p>
      {mutation.isPending && progress > 0 && (
        <p className="text-[12px] text-[var(--color-text-muted)] mt-2">Uploading… {progress}%</p>
      )}
    </Dialog>
  )
}
