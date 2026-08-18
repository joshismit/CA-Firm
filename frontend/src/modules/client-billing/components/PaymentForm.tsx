// src/modules/client-billing/components/PaymentForm.tsx
// Single reusable form for create/edit/view - no per-mode duplicate forms. Built entirely from
// existing shared primitives (FormField, Input, Select, Button) and the generic, provisional
// payment schema (see schemas/index.ts and types/index.ts's header comment). invoiceId is a plain
// UUID input, not a picker - the Invoices list above exists in this same app, but its records can
// never be created either (createInvoice also 501s), so there's nothing real to pick from yet.
import type { z } from 'zod'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { createPaymentSchema, type CreatePaymentFormValues } from '../schemas'
import { PAYMENT_METHOD_OPTIONS } from '../constants'
import type { Payment } from '../types'

type PaymentFormInput = z.input<typeof createPaymentSchema>

const blankToUndefined = (value: string) => (value === '' ? undefined : value)

function toDateInputValue(value: unknown): string {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value as string)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

export type PaymentFormMode = 'create' | 'edit' | 'view'

export interface PaymentFormProps {
  mode: PaymentFormMode
  payment?: Payment
  onSubmit?: (values: CreatePaymentFormValues) => void
  isSubmitting?: boolean
  submitError?: string
  submitLabel?: string
}

export function PaymentForm({ mode, payment, onSubmit, isSubmitting = false, submitError, submitLabel }: PaymentFormProps) {
  const isView = mode === 'view'
  const isCreate = mode === 'create'

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<PaymentFormInput, unknown, CreatePaymentFormValues>({
    resolver: zodResolver(createPaymentSchema),
    defaultValues: payment
      ? {
          paymentNumber: payment.paymentNumber,
          invoiceId: payment.invoiceId ?? undefined,
          amount: payment.amount,
          method: payment.method ?? undefined,
          reference: payment.reference ?? '',
          paidDate: payment.paidDate ? new Date(payment.paidDate) : undefined,
          notes: payment.notes ?? '',
        }
      : undefined,
  })

  const content = (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <FormField label="Payment number" htmlFor="paymentNumber" error={errors.paymentNumber?.message}>
        <Input id="paymentNumber" disabled={isView} invalid={!!errors.paymentNumber} placeholder="PAY-2026-001" {...register('paymentNumber')} />
      </FormField>

      <FormField label="Invoice ID" htmlFor="invoiceId" error={errors.invoiceId?.message}>
        <Input
          id="invoiceId"
          disabled={isView}
          invalid={!!errors.invoiceId}
          placeholder="UUID - optional, links to an invoice"
          {...register('invoiceId', { setValueAs: blankToUndefined })}
        />
      </FormField>

      <FormField label="Amount (₹)" htmlFor="amount" error={errors.amount?.message}>
        <Input id="amount" type="number" min="0" step="0.01" disabled={isView} invalid={!!errors.amount} {...register('amount')} />
      </FormField>

      <FormField label="Method" htmlFor="method" error={errors.method?.message}>
        <Controller
          name="method"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value ?? ''}
              onChange={field.onChange}
              options={PAYMENT_METHOD_OPTIONS as unknown as { value: string; label: string }[]}
              disabled={isView}
              placeholder="Select method"
            />
          )}
        />
      </FormField>

      <FormField label="Reference" htmlFor="reference" error={errors.reference?.message}>
        <Input
          id="reference"
          disabled={isView}
          invalid={!!errors.reference}
          placeholder="Transaction / UTR reference"
          {...register('reference', { setValueAs: blankToUndefined })}
        />
      </FormField>

      <FormField label="Paid date" htmlFor="paidDate" error={errors.paidDate?.message as string | undefined}>
        <Controller
          name="paidDate"
          control={control}
          render={({ field }) => (
            <Input
              id="paidDate"
              type="date"
              disabled={isView}
              invalid={!!errors.paidDate}
              value={toDateInputValue(field.value)}
              onChange={(e) => field.onChange(e.target.value === '' ? undefined : e.target.value)}
            />
          )}
        />
      </FormField>

      <FormField label="Notes" htmlFor="notes" error={errors.notes?.message} className="sm:col-span-2">
        <Input id="notes" disabled={isView} invalid={!!errors.notes} {...register('notes', { setValueAs: blankToUndefined })} />
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
          {submitLabel ?? (isCreate ? 'Record payment' : 'Save changes')}
        </Button>
      </div>
    </form>
  )
}
