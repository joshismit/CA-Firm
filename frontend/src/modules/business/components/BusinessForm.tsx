// src/modules/business/components/BusinessForm.tsx
// Single reusable form for create/edit/view - no per-mode duplicate forms. Built entirely from
// existing shared primitives (FormField, Input, Select, Button) and the existing business schemas.
import type { z } from 'zod'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { useBusinessTypesQuery } from '../hooks'
import { createBusinessSchema, type CreateBusinessFormValues } from '../schemas'
import type { Business } from '../types'

// createBusinessSchema's `incorporationDate: z.coerce.date()` means the schema's *input* shape
// (what the form fields actually hold pre-validation) differs from its *output* shape (what
// handleSubmit's callback receives once Zod has parsed it) - RHF needs both generics to type this
// correctly instead of forcing form state and submit-callback values to the same shape.
type BusinessFormInput = z.input<typeof createBusinessSchema>

// The `uppercase` class on PAN/GSTIN/CIN below is CSS-only (text-transform) - it makes the field
// *display* uppercase without changing the actual value, so typing "abcde1234f" would still submit
// lowercase and fail the schema's `[A-Z]{5}[0-9]{4}[A-Z]` regex despite looking correct on screen.
// This upper-cases the real value before it ever reaches the resolver.
const toUpperCase = (value: string) => value.toUpperCase()

export type BusinessFormMode = 'create' | 'edit' | 'view'

const MONTH_OPTIONS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
]

export interface BusinessFormProps {
  mode: BusinessFormMode
  business?: Business
  onSubmit?: (values: CreateBusinessFormValues) => void
  isSubmitting?: boolean
  submitError?: string
  submitLabel?: string
}

export function BusinessForm({ mode, business, onSubmit, isSubmitting = false, submitError, submitLabel }: BusinessFormProps) {
  const isView = mode === 'view'
  const isCreate = mode === 'create'

  const typesQuery = useBusinessTypesQuery()
  const businessTypes = typesQuery.data ?? []

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<BusinessFormInput, unknown, CreateBusinessFormValues>({
    // createBusinessSchema is used for every mode, not just 'create': edit/view always seed
    // `typeId` via defaultValues below (even though the field isn't rendered in edit mode), so it
    // satisfies this schema's validation without needing a second dynamically-built schema.
    resolver: zodResolver(createBusinessSchema),
    defaultValues: business
      ? {
          typeId: business.typeId,
          name: business.name,
          legalName: business.legalName ?? '',
          pan: business.pan ?? '',
          gstin: business.gstin ?? '',
          cin: business.cin ?? '',
          incorporationDate: business.incorporationDate ? new Date(business.incorporationDate) : undefined,
          financialYearStart: business.financialYearStart,
          industry: business.industry ?? '',
        }
      : { financialYearStart: 4 },
  })

  const content = (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <FormField label="Business name" htmlFor="name" error={errors.name?.message}>
        <Input id="name" disabled={isView} invalid={!!errors.name} {...register('name')} />
      </FormField>

      {(isCreate || isView) && (
        <FormField label="Business type" htmlFor="typeId" error={errors.typeId?.message}>
          <Controller
            name="typeId"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value}
                onChange={field.onChange}
                options={businessTypes.map((type) => ({ value: type.id, label: type.name }))}
                disabled={isView || typesQuery.isLoading}
                placeholder={
                  typesQuery.isLoading
                    ? 'Loading types…'
                    : typesQuery.isError
                      ? 'Failed to load types'
                      : 'Select business type'
                }
              />
            )}
          />
        </FormField>
      )}

      <FormField label="Legal name" htmlFor="legalName" error={errors.legalName?.message}>
        <Input id="legalName" disabled={isView} invalid={!!errors.legalName} {...register('legalName')} />
      </FormField>

      <FormField label="Industry" htmlFor="industry" error={errors.industry?.message}>
        <Input id="industry" disabled={isView} invalid={!!errors.industry} {...register('industry')} />
      </FormField>

      <FormField label="PAN" htmlFor="pan" error={errors.pan?.message}>
        <Input
          id="pan"
          disabled={isView}
          invalid={!!errors.pan}
          className="uppercase"
          {...register('pan', { setValueAs: toUpperCase })}
        />
      </FormField>

      <FormField label="GSTIN" htmlFor="gstin" error={errors.gstin?.message}>
        <Input
          id="gstin"
          disabled={isView}
          invalid={!!errors.gstin}
          className="uppercase"
          {...register('gstin', { setValueAs: toUpperCase })}
        />
      </FormField>

      <FormField label="CIN" htmlFor="cin" error={errors.cin?.message}>
        <Input
          id="cin"
          disabled={isView}
          invalid={!!errors.cin}
          className="uppercase"
          {...register('cin', { setValueAs: toUpperCase })}
        />
      </FormField>

      <FormField label="Incorporation date" htmlFor="incorporationDate" error={errors.incorporationDate?.message as string | undefined}>
        <Controller
          name="incorporationDate"
          control={control}
          render={({ field }) => (
            <Input
              id="incorporationDate"
              type="date"
              disabled={isView}
              value={
                field.value
                  ? (field.value instanceof Date ? field.value : new Date(field.value as string)).toISOString().slice(0, 10)
                  : ''
              }
              // A cleared native date input yields "" - z.coerce.date() would turn that into an
              // Invalid Date rather than treating it as "not provided", so map "" to undefined here
              // before it ever reaches the resolver, letting .optional() do the right thing.
              onChange={(e) => field.onChange(e.target.value === '' ? undefined : e.target.value)}
            />
          )}
        />
      </FormField>

      <FormField label="Financial year start" htmlFor="financialYearStart" error={errors.financialYearStart?.message}>
        <Controller
          name="financialYearStart"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value != null ? String(field.value) : undefined}
              onChange={(value) => field.onChange(Number(value))}
              options={MONTH_OPTIONS}
              disabled={isView}
              placeholder="Select month"
            />
          )}
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
          {submitLabel ?? (isCreate ? 'Create business' : 'Save changes')}
        </Button>
      </div>
    </form>
  )
}
