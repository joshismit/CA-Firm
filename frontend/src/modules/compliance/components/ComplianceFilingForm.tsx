// src/modules/compliance/components/ComplianceFilingForm.tsx
// Single reusable form for create/edit/view across all four Compliance areas - no per-module
// duplicate forms, no per-mode duplicate forms. Built entirely from existing shared primitives
// (FormField, Input, Button) and the generic, provisional compliance schema (see
// schemas/index.ts and types/index.ts's header comment for why the fields are generic rather than
// module-specific).
import type { z } from 'zod'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createComplianceFilingSchema, type CreateComplianceFilingFormValues } from '../schemas'
import type { ComplianceFiling } from '../types'

type ComplianceFilingFormInput = z.input<typeof createComplianceFilingSchema>

// Mirrors ProjectForm's toDateInputValue: a native <input type="date"> needs a "YYYY-MM-DD"
// string, but dueDate may arrive here as a Date object (from defaultValues) or an ISO string.
function toDateInputValue(value: unknown): string {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value as string)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

export type ComplianceFilingFormMode = 'create' | 'edit' | 'view'

export interface ComplianceFilingFormProps {
  mode: ComplianceFilingFormMode
  filing?: ComplianceFiling
  referenceLabel?: string
  onSubmit?: (values: CreateComplianceFilingFormValues) => void
  isSubmitting?: boolean
  submitError?: string
  submitLabel?: string
}

export function ComplianceFilingForm({
  mode,
  filing,
  referenceLabel = 'Reference',
  onSubmit,
  isSubmitting = false,
  submitError,
  submitLabel,
}: ComplianceFilingFormProps) {
  const isView = mode === 'view'
  const isCreate = mode === 'create'

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ComplianceFilingFormInput, unknown, CreateComplianceFilingFormValues>({
    resolver: zodResolver(createComplianceFilingSchema),
    defaultValues: filing
      ? {
          reference: filing.reference,
          period: filing.period,
          dueDate: filing.dueDate ? new Date(filing.dueDate) : undefined,
          notes: filing.notes ?? '',
        }
      : undefined,
  })

  const content = (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <FormField label={referenceLabel} htmlFor="reference" error={errors.reference?.message}>
        <Input id="reference" disabled={isView} invalid={!!errors.reference} {...register('reference')} />
      </FormField>

      <FormField label="Period" htmlFor="period" error={errors.period?.message}>
        <Input id="period" disabled={isView} invalid={!!errors.period} placeholder="e.g. Q1 FY26" {...register('period')} />
      </FormField>

      <FormField label="Due date" htmlFor="dueDate" error={errors.dueDate?.message as string | undefined}>
        <Controller
          name="dueDate"
          control={control}
          render={({ field }) => (
            <Input
              id="dueDate"
              type="date"
              disabled={isView}
              invalid={!!errors.dueDate}
              value={toDateInputValue(field.value)}
              onChange={(e) => field.onChange(e.target.value === '' ? undefined : e.target.value)}
            />
          )}
        />
      </FormField>

      <FormField label="Notes" htmlFor="notes" error={errors.notes?.message} className="sm:col-span-2">
        <Input id="notes" disabled={isView} invalid={!!errors.notes} {...register('notes')} />
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
          {submitLabel ?? (isCreate ? 'Create filing' : 'Save changes')}
        </Button>
      </div>
    </form>
  )
}
