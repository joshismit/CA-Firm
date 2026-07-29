// src/modules/reports/components/ReportFiltersForm.tsx
// Date-range + staff filters shared by every report type's generate page - one form, reused
// across all 8 report types rather than duplicated per type, since reportFiltersSchema is already
// the same generic shape for all of them. staffId is a plain UUID input - no Users-lookup API
// exists to back a picker (same precedent as ProjectForm's managerId field).
import type { z } from 'zod'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { reportFiltersSchema, type ReportFiltersFormValues } from '../schemas'
import type { ReportFilters } from '../types'

// reportFiltersSchema's from/to use z.coerce.date(), so the schema's *input* shape (what the form
// fields hold pre-validation) differs from its *output* shape (what handleSubmit's callback
// receives) - same reasoning as ProjectForm/ComplianceFilingForm's identical split.
type ReportFiltersFormInput = z.input<typeof reportFiltersSchema>

function toDateInputValue(value: unknown): string {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value as string)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

export interface ReportFiltersFormProps {
  onGenerate: (filters: ReportFilters) => void
  isGenerating?: boolean
}

export function ReportFiltersForm({ onGenerate, isGenerating = false }: ReportFiltersFormProps) {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ReportFiltersFormInput, unknown, ReportFiltersFormValues>({
    resolver: zodResolver(reportFiltersSchema),
  })

  const submit = (values: ReportFiltersFormValues) => {
    onGenerate({
      from: values.from ? values.from.toISOString() : undefined,
      to: values.to ? values.to.toISOString() : undefined,
      staffId: values.staffId || undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FormField label="From" htmlFor="from" error={errors.from?.message as string | undefined}>
          <Controller
            name="from"
            control={control}
            render={({ field }) => (
              <Input
                id="from"
                type="date"
                invalid={!!errors.from}
                value={toDateInputValue(field.value)}
                onChange={(e) => field.onChange(e.target.value === '' ? undefined : e.target.value)}
              />
            )}
          />
        </FormField>

        <FormField label="To" htmlFor="to" error={errors.to?.message as string | undefined}>
          <Controller
            name="to"
            control={control}
            render={({ field }) => (
              <Input
                id="to"
                type="date"
                invalid={!!errors.to}
                value={toDateInputValue(field.value)}
                onChange={(e) => field.onChange(e.target.value === '' ? undefined : e.target.value)}
              />
            )}
          />
        </FormField>

        <FormField label="Staff ID" htmlFor="staffId" error={errors.staffId?.message}>
          <Controller
            name="staffId"
            control={control}
            render={({ field }) => (
              <Input
                id="staffId"
                invalid={!!errors.staffId}
                placeholder="UUID - optional, a staff picker will replace this once GET /users exists"
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value === '' ? undefined : e.target.value)}
              />
            )}
          />
        </FormField>
      </div>

      <div className="flex justify-end">
        <Button type="submit" loading={isGenerating}>
          Generate report
        </Button>
      </div>
    </form>
  )
}
