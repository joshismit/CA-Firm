// src/modules/crm/components/CRMForm.tsx
// Single reusable form for create/edit/view - no per-mode duplicate forms. Built entirely from
// existing shared primitives (FormField, Input, Select, Button) and the existing, locked lead
// schema. Only fields present in createLeadSchema are rendered - nothing from the PRD's CRM
// wishlist that isn't backed by a real schema field (e.g. no "won/lost reason", no owner picker).
import { useEffect } from 'react'
import type { z } from 'zod'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { useLeadStagesQuery } from '../hooks'
import { createLeadSchema, type CreateLeadFormValues } from '../schemas'
import type { Lead } from '../types'

// createLeadSchema's expectedRevenue/probability/expectedCloseDate all use z.coerce(...), so the
// schema's *input* shape (what the form fields hold pre-validation) differs from its *output*
// shape (what handleSubmit's callback receives once Zod has parsed it) - same reasoning as
// BusinessForm's identical BusinessFormInput generic.
type CRMFormInput = z.input<typeof createLeadSchema>

// Converts a cleared/blank input to `undefined` instead of letting z.coerce turn "" into 0 or an
// Invalid Date - the exact bug class fixed in BusinessForm's incorporationDate field, applied here
// proactively to every optional coerced/uuid field instead of waiting to discover it at runtime.
const blankToUndefined = (value: string) => (value === '' ? undefined : value)

export type CRMFormMode = 'create' | 'edit' | 'view'

export interface CRMFormProps {
  mode: CRMFormMode
  lead?: Lead
  onSubmit?: (values: CreateLeadFormValues) => void
  isSubmitting?: boolean
  submitError?: string
  submitLabel?: string
}

export function CRMForm({ mode, lead, onSubmit, isSubmitting = false, submitError, submitLabel }: CRMFormProps) {
  const isView = mode === 'view'
  const isCreate = mode === 'create'

  const stagesQuery = useLeadStagesQuery()
  const stages = stagesQuery.data ?? []

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CRMFormInput, unknown, CreateLeadFormValues>({
    resolver: zodResolver(createLeadSchema),
    defaultValues: lead
      ? {
          businessId: lead.businessId ?? '',
          contactId: lead.contactId ?? '',
          title: lead.title,
          sourceId: lead.sourceId,
          stageId: lead.stageId,
          expectedRevenue: lead.expectedRevenue ?? undefined,
          probability: lead.probability ?? undefined,
          expectedCloseDate: lead.expectedCloseDate ? lead.expectedCloseDate.slice(0, 10) : undefined,
        }
      : undefined,
  })

  // An edit-mode form opened before the real GET /crm/stages load finishes should still show the
  // lead's real stageId in the fallback input - this just keeps the field's registered value in
  // sync, it doesn't change validation.
  useEffect(() => {
    if (lead?.stageId) setValue('stageId', lead.stageId)
  }, [lead?.stageId, setValue])

  const content = (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <FormField label="Title" htmlFor="title" error={errors.title?.message} className="sm:col-span-2">
        <Input id="title" disabled={isView} invalid={!!errors.title} {...register('title')} />
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

      <FormField label="Lead source ID" htmlFor="sourceId" error={errors.sourceId?.message}>
        <Input
          id="sourceId"
          disabled={isView}
          invalid={!!errors.sourceId}
          placeholder="UUID - a Lead Source picker will replace this once GET /crm/lead-sources exists"
          {...register('sourceId')}
        />
      </FormField>

      <FormField label="Stage" htmlFor="stageId" error={errors.stageId?.message}>
        {stages.length > 0 ? (
          <Controller
            name="stageId"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value}
                onChange={field.onChange}
                options={stages.map((s) => ({ value: s.id, label: s.name }))}
                disabled={isView}
                placeholder="Select stage"
              />
            )}
          />
        ) : (
          <Input
            id="stageId"
            disabled={isView}
            invalid={!!errors.stageId}
            placeholder="UUID - a stage picker will populate once GET /crm/lead-stages returns data"
            {...register('stageId')}
          />
        )}
      </FormField>

      <FormField label="Expected revenue (₹)" htmlFor="expectedRevenue" error={errors.expectedRevenue?.message}>
        <Input
          id="expectedRevenue"
          type="number"
          min="0"
          step="0.01"
          disabled={isView}
          invalid={!!errors.expectedRevenue}
          {...register('expectedRevenue', { setValueAs: blankToUndefined })}
        />
      </FormField>

      <FormField label="Probability (%)" htmlFor="probability" error={errors.probability?.message}>
        <Input
          id="probability"
          type="number"
          min="0"
          max="100"
          step="1"
          disabled={isView}
          invalid={!!errors.probability}
          {...register('probability', { setValueAs: blankToUndefined })}
        />
      </FormField>

      <FormField label="Expected close date" htmlFor="expectedCloseDate" error={errors.expectedCloseDate?.message as string | undefined}>
        <Input
          id="expectedCloseDate"
          type="date"
          disabled={isView}
          invalid={!!errors.expectedCloseDate}
          {...register('expectedCloseDate', { setValueAs: blankToUndefined })}
        />
      </FormField>
    </div>
  )

  if (isView || !onSubmit) {
    return <div className="space-y-4">{content}</div>
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {content}

      {submitError && <p className="text-[12px] text-[var(--color-danger)]">{submitError}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" loading={isSubmitting}>
          {submitLabel ?? (isCreate ? 'Create lead' : 'Save changes')}
        </Button>
      </div>
    </form>
  )
}
