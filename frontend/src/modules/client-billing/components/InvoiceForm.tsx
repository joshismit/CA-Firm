// src/modules/client-billing/components/InvoiceForm.tsx
// Single reusable form for create/edit/view - no per-mode duplicate forms. Built entirely from
// existing shared primitives (FormField, Input, Button) and the generic, provisional invoice
// schema (see schemas/index.ts and types/index.ts's header comment for why the fields are generic
// rather than a confirmed backend contract). clientId/businessId are plain UUID inputs, not
// pickers - no Clients/Business-lookup API exists to back one, matching CRMForm/ProjectForm's
// existing raw-UUID precedent.
import type { z } from 'zod'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createInvoiceSchema, type CreateInvoiceFormValues } from '../schemas'
import type { Invoice } from '../types'

type InvoiceFormInput = z.input<typeof createInvoiceSchema>

const blankToUndefined = (value: string) => (value === '' ? undefined : value)

function toDateInputValue(value: unknown): string {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value as string)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

export type InvoiceFormMode = 'create' | 'edit' | 'view'

export interface InvoiceFormProps {
  mode: InvoiceFormMode
  invoice?: Invoice
  onSubmit?: (values: CreateInvoiceFormValues) => void
  isSubmitting?: boolean
  submitError?: string
  submitLabel?: string
}

export function InvoiceForm({ mode, invoice, onSubmit, isSubmitting = false, submitError, submitLabel }: InvoiceFormProps) {
  const isView = mode === 'view'
  const isCreate = mode === 'create'

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<InvoiceFormInput, unknown, CreateInvoiceFormValues>({
    resolver: zodResolver(createInvoiceSchema),
    defaultValues: invoice
      ? {
          invoiceNumber: invoice.invoiceNumber,
          clientId: invoice.clientId ?? undefined,
          businessId: invoice.businessId ?? undefined,
          amount: invoice.amount,
          tax: invoice.tax,
          dueDate: invoice.dueDate ? new Date(invoice.dueDate) : undefined,
          notes: invoice.notes ?? '',
        }
      : undefined,
  })

  const content = (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <FormField label="Invoice number" htmlFor="invoiceNumber" error={errors.invoiceNumber?.message}>
        <Input id="invoiceNumber" disabled={isView} invalid={!!errors.invoiceNumber} placeholder="INV-2026-001" {...register('invoiceNumber')} />
      </FormField>

      <FormField label="Client ID" htmlFor="clientId" error={errors.clientId?.message}>
        <Input
          id="clientId"
          disabled={isView}
          invalid={!!errors.clientId}
          placeholder="UUID - optional, a Client picker will replace this once GET /clients exists"
          {...register('clientId', { setValueAs: blankToUndefined })}
        />
      </FormField>

      <FormField label="Business ID" htmlFor="businessId" error={errors.businessId?.message}>
        <Input
          id="businessId"
          disabled={isView}
          invalid={!!errors.businessId}
          placeholder="UUID - optional"
          {...register('businessId', { setValueAs: blankToUndefined })}
        />
      </FormField>

      <FormField label="Amount (₹)" htmlFor="amount" error={errors.amount?.message}>
        <Input id="amount" type="number" min="0" step="0.01" disabled={isView} invalid={!!errors.amount} {...register('amount')} />
      </FormField>

      <FormField label="Tax (₹)" htmlFor="tax" error={errors.tax?.message}>
        <Input
          id="tax"
          type="number"
          min="0"
          step="0.01"
          disabled={isView}
          invalid={!!errors.tax}
          {...register('tax', { setValueAs: blankToUndefined })}
        />
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
          {submitLabel ?? (isCreate ? 'Create invoice' : 'Save changes')}
        </Button>
      </div>
    </form>
  )
}
