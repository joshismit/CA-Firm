// src/modules/documents/components/DocumentForm.tsx
// Single reusable form for upload/edit/view - built entirely from existing shared primitives
// (FormField, Input, Select, Button). `create` validates+submits against `uploadDocumentSchema`
// (file required); `edit` validates+submits against `updateDocumentSchema` (no file - there is no
// endpoint to replace the underlying file, only its metadata). Only fields present in one of those
// schemas are rendered (category, businessId, contactId, folderId, file) - none of DocumentFile's server-
// assigned fields (fileName, storageKey, mimeType, sizeBytes, version, uploadedById, createdAt)
// belong here; those are displayed by DocumentOverviewCard/DocumentMetadataCard instead.
import { Controller, useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { DOCUMENT_CATEGORY_OPTIONS, SUPPORTED_FILE_TYPES_ACCEPT, SUPPORTED_FILE_TYPES_HINT } from '../constants'
import { uploadDocumentSchema, updateDocumentSchema, type UploadDocumentFormValues, type UpdateDocumentFormValues } from '../schemas'
import type { DocumentFile } from '../types'

export type DocumentFormMode = 'create' | 'edit' | 'view'

const blankToUndefined = (value: string) => (value === '' ? undefined : value)

export interface DocumentFormProps {
  mode: DocumentFormMode
  document?: DocumentFile
  onSubmit?: (values: UploadDocumentFormValues) => void
  onSubmitEdit?: (values: UpdateDocumentFormValues) => void
  isSubmitting?: boolean
  submitError?: string
  submitLabel?: string
}

export function DocumentForm({
  mode,
  document,
  onSubmit,
  onSubmitEdit,
  isSubmitting = false,
  submitError,
  submitLabel,
}: DocumentFormProps) {
  const isView = mode === 'view'
  const isCreate = mode === 'create'

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<UploadDocumentFormValues>({
    // `updateDocumentSchema` is `uploadDocumentSchema` minus `file` - cast is safe because the
    // `file` field is never rendered/read outside create mode (see `onSubmitEdit` below).
    resolver: (isCreate ? zodResolver(uploadDocumentSchema) : zodResolver(updateDocumentSchema)) as Resolver<UploadDocumentFormValues>,
    defaultValues: document
      ? {
          businessId: document.businessId ?? undefined,
          contactId: document.contactId ?? undefined,
          folderId: document.folderId ?? undefined,
          category: document.category,
        }
      : undefined,
  })

  const content = (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <FormField label="Category" htmlFor="category" error={errors.category?.message}>
        <Controller
          name="category"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value}
              onChange={field.onChange}
              options={DOCUMENT_CATEGORY_OPTIONS}
              disabled={isView}
              placeholder="Select category"
            />
          )}
        />
      </FormField>

      <FormField label="Business ID" htmlFor="businessId" error={errors.businessId?.message}>
        <Input
          id="businessId"
          disabled={isView}
          invalid={!!errors.businessId}
          placeholder="UUID - optional, a Business picker will replace this once one exists"
          {...register('businessId', { setValueAs: blankToUndefined })}
        />
      </FormField>

      <FormField label="Contact ID" htmlFor="contactId" error={errors.contactId?.message}>
        <Input
          id="contactId"
          disabled={isView}
          invalid={!!errors.contactId}
          placeholder="UUID - optional, a Contact picker will replace this once one exists"
          {...register('contactId', { setValueAs: blankToUndefined })}
        />
      </FormField>

      <FormField label="Folder ID" htmlFor="folderId" error={errors.folderId?.message}>
        <Input
          id="folderId"
          disabled={isView}
          invalid={!!errors.folderId}
          placeholder="UUID - optional, must match the document's Business/category"
          {...register('folderId', { setValueAs: blankToUndefined })}
        />
      </FormField>

      {isCreate && (
        <FormField label="File" htmlFor="file" error={errors.file?.message as string | undefined} className="sm:col-span-2">
          <Input
            id="file"
            type="file"
            accept={SUPPORTED_FILE_TYPES_ACCEPT}
            invalid={!!errors.file}
            onChange={(e) => setValue('file', e.target.files?.[0] as File, { shouldValidate: true })}
          />
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">Supported types: {SUPPORTED_FILE_TYPES_HINT}.</p>
        </FormField>
      )}
    </div>
  )

  if (isView || (!onSubmit && !onSubmitEdit)) {
    return <div className="space-y-4">{content}</div>
  }

  const submitHandler = isCreate
    ? handleSubmit((values) => onSubmit?.(values))
    : handleSubmit((values) =>
        onSubmitEdit?.({
          businessId: values.businessId,
          contactId: values.contactId,
          folderId: values.folderId,
          category: values.category,
        }),
      )

  return (
    <form onSubmit={submitHandler} className="space-y-4" noValidate>
      {content}

      {submitError && <p className="text-[12px] text-[var(--color-danger)]">{submitError}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" loading={isSubmitting}>
          {submitLabel ?? (isCreate ? 'Upload document' : 'Save changes')}
        </Button>
      </div>
    </form>
  )
}
