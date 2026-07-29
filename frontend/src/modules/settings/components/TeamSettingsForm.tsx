// src/modules/settings/components/TeamSettingsForm.tsx
// Single form for firm-wide team preferences - built entirely from existing shared primitives
// (FormField, Input, Select, Switch, Button) and the generic, provisional team-settings schema.
import type { z } from 'zod'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { updateTeamSettingsSchema, type UpdateTeamSettingsFormValues } from '../schemas'
import { WEEK_START_OPTIONS } from '../constants'
import type { TeamSettings } from '../types'

// defaultTaskReminderDays uses z.coerce.number(), so the schema's *input* shape (what the form
// field holds pre-validation) differs from its *output* shape (what handleSubmit's callback
// receives) - same reasoning as ProjectForm/ComplianceFilingForm/ReportFiltersForm's identical split.
type TeamSettingsFormInput = z.input<typeof updateTeamSettingsSchema>

export interface TeamSettingsFormProps {
  teamSettings?: TeamSettings
  onSubmit: (values: UpdateTeamSettingsFormValues) => void
  isSubmitting?: boolean
  submitError?: string
  canManage: boolean
}

export function TeamSettingsForm({ teamSettings, onSubmit, isSubmitting = false, submitError, canManage }: TeamSettingsFormProps) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<TeamSettingsFormInput, unknown, UpdateTeamSettingsFormValues>({
    resolver: zodResolver(updateTeamSettingsSchema),
    defaultValues: {
      allowSelfRegistration: teamSettings?.allowSelfRegistration ?? false,
      defaultTaskReminderDays: teamSettings?.defaultTaskReminderDays ?? 2,
      weekStartDay: teamSettings?.weekStartDay ?? 'MONDAY',
    },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="flex items-center justify-between gap-4 py-1">
        <div>
          <Label htmlFor="allowSelfRegistration">Allow self-registration</Label>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">Let invited staff create their own account instead of an admin creating it for them.</p>
        </div>
        <Controller
          name="allowSelfRegistration"
          control={control}
          render={({ field }) => (
            <Switch id="allowSelfRegistration" checked={field.value} onCheckedChange={field.onChange} disabled={!canManage} />
          )}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Default task reminder (days before due)" htmlFor="defaultTaskReminderDays" error={errors.defaultTaskReminderDays?.message}>
          <Input
            id="defaultTaskReminderDays"
            type="number"
            min="0"
            max="30"
            disabled={!canManage}
            invalid={!!errors.defaultTaskReminderDays}
            {...register('defaultTaskReminderDays')}
          />
        </FormField>

        <FormField label="Week starts on" htmlFor="weekStartDay" error={errors.weekStartDay?.message}>
          <Controller
            name="weekStartDay"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onChange={field.onChange} options={WEEK_START_OPTIONS} disabled={!canManage} />
            )}
          />
        </FormField>
      </div>

      {submitError && <p className="text-[12px] text-[var(--color-danger)]">{submitError}</p>}

      {canManage && (
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" disabled={!isDirty || isSubmitting} onClick={() => reset()}>
            Reset
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Save changes
          </Button>
        </div>
      )}
    </form>
  )
}
