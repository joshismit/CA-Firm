// src/modules/projects/components/ProjectForm.tsx
// Single reusable form for create/edit/view - no per-mode duplicate forms. Built entirely from
// existing shared primitives (FormField, Input, Button) and the existing, locked project schema.
// clientId/code are immutable after creation (backend/src/modules/projects/schemas/project.schema.ts's
// updateProjectSchema has no clientId/code fields at all) - only rendered in create mode, mirroring
// how BusinessForm hides the immutable typeId field outside create.
import type { z } from 'zod'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createProjectSchema, type CreateProjectFormValues } from '../schemas'
import type { Project } from '../types'

type ProjectFormInput = z.input<typeof createProjectSchema>

// An emptied optional-UUID text field yields "" - z.string().uuid() would reject "" outright rather
// than treating it as "not provided" - map "" to undefined before it reaches the resolver, same fix
// CRMForm already applies to its own optional UUID fields.
const blankToUndefined = (value: string) => (value === '' ? undefined : value)

// startDate/dueDate default from an existing project as Date objects, but a native <input
// type="date"> needs a "YYYY-MM-DD" string - same Date<->string mismatch BusinessForm's
// incorporationDate field already solves with a Controller instead of plain register().
function toDateInputValue(value: unknown): string {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value as string)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

export type ProjectFormMode = 'create' | 'edit' | 'view'

export interface ProjectFormProps {
  mode: ProjectFormMode
  project?: Project
  onSubmit?: (values: CreateProjectFormValues) => void
  isSubmitting?: boolean
  submitError?: string
  submitLabel?: string
}

export function ProjectForm({ mode, project, onSubmit, isSubmitting = false, submitError, submitLabel }: ProjectFormProps) {
  const isView = mode === 'view'
  const isCreate = mode === 'create'

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ProjectFormInput, unknown, CreateProjectFormValues>({
    // createProjectSchema backs every mode, not just 'create': edit/view seed clientId/code via
    // defaultValues below (even though those fields aren't rendered outside create), so the form
    // satisfies this schema's validation without a second dynamically-built schema.
    resolver: zodResolver(createProjectSchema),
    defaultValues: project
      ? {
          clientId: project.clientId,
          managerId: project.managerId ?? undefined,
          code: project.code,
          name: project.name,
          startDate: project.startDate ? new Date(project.startDate) : undefined,
          dueDate: project.dueDate ? new Date(project.dueDate) : undefined,
        }
      : undefined,
  })

  const content = (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {(isCreate || isView) && (
        <FormField
          label="Client ID"
          htmlFor="clientId"
          error={errors.clientId?.message}
        >
          <Input
            id="clientId"
            disabled={isView}
            invalid={!!errors.clientId}
            placeholder="UUID - a Client picker will replace this once GET /clients exists"
            {...register('clientId')}
          />
        </FormField>
      )}

      {(isCreate || isView) && (
        <FormField label="Engagement code" htmlFor="code" error={errors.code?.message}>
          <Input id="code" disabled={isView} invalid={!!errors.code} placeholder="AUD-2026-001" {...register('code')} />
        </FormField>
      )}

      <FormField label="Project name" htmlFor="name" error={errors.name?.message} className="sm:col-span-2">
        <Input id="name" disabled={isView} invalid={!!errors.name} {...register('name')} />
      </FormField>

      <FormField label="Manager ID" htmlFor="managerId" error={errors.managerId?.message}>
        <Input
          id="managerId"
          disabled={isView}
          invalid={!!errors.managerId}
          placeholder="UUID - optional, a Manager/User picker will replace this once GET /users exists"
          {...register('managerId', { setValueAs: blankToUndefined })}
        />
      </FormField>

      <FormField label="Start date" htmlFor="startDate" error={errors.startDate?.message as string | undefined}>
        <Controller
          name="startDate"
          control={control}
          render={({ field }) => (
            <Input
              id="startDate"
              type="date"
              disabled={isView}
              invalid={!!errors.startDate}
              value={toDateInputValue(field.value)}
              onChange={(e) => field.onChange(e.target.value === '' ? undefined : e.target.value)}
            />
          )}
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
          {submitLabel ?? (isCreate ? 'Create project' : 'Save changes')}
        </Button>
      </div>
    </form>
  )
}
