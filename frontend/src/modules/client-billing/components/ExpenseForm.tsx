// src/modules/client-billing/components/ExpenseForm.tsx
// Single reusable form for create/edit/view - no per-mode duplicate forms. Built entirely from
// existing shared primitives (FormField, Input, Select, Button) and the generic, provisional
// expense schema (see schemas/index.ts and types/index.ts's header comment).
import type { z } from 'zod'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { createExpenseSchema, type CreateExpenseFormValues } from '../schemas'
import { EXPENSE_CATEGORY_OPTIONS, PAYMENT_METHOD_OPTIONS } from '../constants'
import type { Expense } from '../types'

type ExpenseFormInput = z.input<typeof createExpenseSchema>

const blankToUndefined = (value: string) => (value === '' ? undefined : value)

function toDateInputValue(value: unknown): string {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value as string)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

export type ExpenseFormMode = 'create' | 'edit' | 'view'

export interface ExpenseFormProps {
  mode: ExpenseFormMode
  expense?: Expense
  onSubmit?: (values: CreateExpenseFormValues) => void
  isSubmitting?: boolean
  submitError?: string
  submitLabel?: string
}

export function ExpenseForm({ mode, expense, onSubmit, isSubmitting = false, submitError, submitLabel }: ExpenseFormProps) {
  const isView = mode === 'view'
  const isCreate = mode === 'create'

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ExpenseFormInput, unknown, CreateExpenseFormValues>({
    resolver: zodResolver(createExpenseSchema),
    // `category` always gets an explicit default ('' when there's no expense yet), not left
    // undefined - Zod's base string-type check rejects `undefined` with a generic "expected
    // string, received undefined" message that bypasses the custom `.min(1, 'Select a category')`
    // message entirely; an empty string is a real (if invalid) string, so the intended message
    // shows correctly once the user submits without picking one.
    defaultValues: {
      expenseNumber: expense?.expenseNumber ?? '',
      category: expense?.category ?? '',
      vendor: expense?.vendor ?? '',
      amount: expense?.amount,
      date: expense?.date ? new Date(expense.date) : undefined,
      paymentMethod: expense?.paymentMethod ?? undefined,
      notes: expense?.notes ?? '',
    },
  })

  const content = (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <FormField label="Expense number" htmlFor="expenseNumber" error={errors.expenseNumber?.message}>
        <Input id="expenseNumber" disabled={isView} invalid={!!errors.expenseNumber} placeholder="EXP-2026-001" {...register('expenseNumber')} />
      </FormField>

      <FormField label="Category" htmlFor="category" error={errors.category?.message}>
        <Controller
          name="category"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value}
              onChange={field.onChange}
              options={EXPENSE_CATEGORY_OPTIONS as unknown as { value: string; label: string }[]}
              disabled={isView}
              placeholder="Select category"
            />
          )}
        />
      </FormField>

      <FormField label="Vendor" htmlFor="vendor" error={errors.vendor?.message}>
        <Input id="vendor" disabled={isView} invalid={!!errors.vendor} {...register('vendor')} />
      </FormField>

      <FormField label="Amount (₹)" htmlFor="amount" error={errors.amount?.message}>
        <Input id="amount" type="number" min="0" step="0.01" disabled={isView} invalid={!!errors.amount} {...register('amount')} />
      </FormField>

      <FormField label="Date" htmlFor="date" error={errors.date?.message as string | undefined}>
        <Controller
          name="date"
          control={control}
          render={({ field }) => (
            <Input
              id="date"
              type="date"
              disabled={isView}
              invalid={!!errors.date}
              value={toDateInputValue(field.value)}
              onChange={(e) => field.onChange(e.target.value === '' ? undefined : e.target.value)}
            />
          )}
        />
      </FormField>

      <FormField label="Payment method" htmlFor="paymentMethod" error={errors.paymentMethod?.message}>
        <Controller
          name="paymentMethod"
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
          {submitLabel ?? (isCreate ? 'Create expense' : 'Save changes')}
        </Button>
      </div>
    </form>
  )
}
