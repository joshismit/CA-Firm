// src/modules/reports/components/ReportFiltersForm.tsx
// Date-range + staff filters shared by every report type's generate page - one form, reused
// across all 8 report types rather than duplicated per type, since reportFiltersSchema is already
// the same generic shape for all of them. staffId is a plain UUID input - no Users-lookup API
// exists to back a picker (same precedent as ProjectForm's managerId field).
//
// PRD §13.2 report #1 ("Today/Week/Month/Custom" date filters) — quick-range buttons that just set
// the From/To fields to computed dates; "Custom" needs no button, it's simply typing into the date
// inputs directly. Available on every report type (not just New Leads), since the underlying
// From/To contract is identical everywhere and there's no reason to withhold the shortcut elsewhere.
//
// PRD §13.2 "Grouped by X" — an optional `groupBy` select, only rendered when the caller passes
// `groupByOptions` (from `REPORT_TYPE_GROUP_BY_OPTIONS`, ../constants) for the current report type.
import type { z } from 'zod'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, type SelectOption } from '@/components/ui/select'
import { reportFiltersSchema, type ReportFiltersFormValues } from '../schemas'
import type { ReportFilters } from '../types'

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

const DATE_PRESETS: Array<{ label: string; range: () => [Date, Date] }> = [
  { label: 'Today', range: () => [startOfDay(new Date()), endOfDay(new Date())] },
  {
    label: 'This week',
    range: () => {
      const now = new Date()
      const start = new Date(now)
      start.setDate(now.getDate() - now.getDay())
      return [startOfDay(start), endOfDay(now)]
    },
  },
  {
    label: 'This month',
    range: () => {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      return [startOfDay(start), endOfDay(now)]
    },
  },
]

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
  /** PRD §13.2 "Grouped by X" — omit to hide the groupBy field entirely (report types with no grouping concept). */
  groupByOptions?: SelectOption[]
}

export function ReportFiltersForm({ onGenerate, isGenerating = false, groupByOptions }: ReportFiltersFormProps) {
  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ReportFiltersFormInput, unknown, ReportFiltersFormValues>({
    resolver: zodResolver(reportFiltersSchema),
  })

  const applyPreset = (range: () => [Date, Date]) => {
    const [from, to] = range()
    setValue('from', from.toISOString())
    setValue('to', to.toISOString())
  }

  const submit = (values: ReportFiltersFormValues) => {
    onGenerate({
      from: values.from ? values.from.toISOString() : undefined,
      to: values.to ? values.to.toISOString() : undefined,
      staffId: values.staffId || undefined,
      groupBy: values.groupBy,
    })
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      <div className="flex flex-wrap gap-2">
        {DATE_PRESETS.map((preset) => (
          <Button key={preset.label} type="button" variant="secondary" size="sm" onClick={() => applyPreset(preset.range)}>
            {preset.label}
          </Button>
        ))}
      </div>

      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${groupByOptions ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
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

        {groupByOptions && (
          <FormField label="Group by" htmlFor="groupBy" error={errors.groupBy?.message as string | undefined}>
            <Controller
              name="groupBy"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value ?? undefined}
                  onChange={(value) => field.onChange(value || undefined)}
                  options={groupByOptions}
                  placeholder="None"
                  aria-label="Group by"
                />
              )}
            />
          </FormField>
        )}
      </div>

      <div className="flex justify-end">
        <Button type="submit" loading={isGenerating}>
          Generate report
        </Button>
      </div>
    </form>
  )
}
