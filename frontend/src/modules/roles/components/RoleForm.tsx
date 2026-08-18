// src/modules/roles/components/RoleForm.tsx
// Single reusable form for create/edit/view - no per-mode duplicate forms. Built entirely from
// existing shared primitives (FormField, Input, Checkbox, Button) and the existing, locked role
// schema. The permission checklist is grouped from config/permissions.config.ts's real PERMISSIONS
// registry - the same strings <Can>/usePermission already check against - not an invented or
// fetched list, so it's honest even with no backend: these are the actual permission strings this
// app defines today.
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { PERMISSIONS } from '@/config/permissions.config'
import { createRoleSchema, type CreateRoleFormValues } from '../schemas'
import type { Role } from '../types'

const PERMISSION_GROUPS = (() => {
  const groups = new Map<string, string[]>()
  for (const code of Object.values(PERMISSIONS)) {
    const [resource] = code.split(':')
    if (!groups.has(resource)) groups.set(resource, [])
    groups.get(resource)!.push(code)
  }
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b))
})()

export type RoleFormMode = 'create' | 'edit' | 'view'

export interface RoleFormProps {
  mode: RoleFormMode
  role?: Role
  onSubmit?: (values: CreateRoleFormValues) => void
  isSubmitting?: boolean
  submitError?: string
  submitLabel?: string
}

export function RoleForm({ mode, role, onSubmit, isSubmitting = false, submitError, submitLabel }: RoleFormProps) {
  const isView = mode === 'view'
  const isCreate = mode === 'create'

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateRoleFormValues>({
    resolver: zodResolver(createRoleSchema),
    defaultValues: {
      name: role?.name ?? '',
      description: role?.description ?? '',
      color: role?.color ?? '',
      permissionCodes: role?.permissionCodes ?? [],
    },
  })

  const disabled = isView || (role?.type === 'SYSTEM')

  const content = (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Role name" htmlFor="name" error={errors.name?.message}>
          <Input id="name" disabled={disabled} invalid={!!errors.name} {...register('name')} />
        </FormField>
        <FormField label="Color" htmlFor="color" error={errors.color?.message}>
          <Input id="color" type="text" placeholder="#6366F1" disabled={disabled} invalid={!!errors.color} {...register('color')} />
        </FormField>
        <FormField label="Description" htmlFor="description" error={errors.description?.message} className="sm:col-span-2">
          <Input id="description" disabled={disabled} invalid={!!errors.description} {...register('description')} />
        </FormField>
      </div>

      <FormField label="Permissions" htmlFor="permissionCodes" error={errors.permissionCodes?.message as string | undefined}>
        <Controller
          name="permissionCodes"
          control={control}
          render={({ field }) => (
            <div className="max-h-[360px] overflow-y-auto border border-[var(--color-border)] rounded-[var(--radius-md)] p-3 space-y-4">
              {PERMISSION_GROUPS.map(([resource, codes]) => (
                <div key={resource}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">{resource}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {codes.map((code) => {
                      const checked = field.value?.includes(code) ?? false
                      return (
                        <label key={code} className="flex items-center gap-2 text-[12px] font-mono text-[var(--color-text-body)] cursor-pointer">
                          <Checkbox
                            checked={checked}
                            disabled={disabled}
                            onCheckedChange={(next) => {
                              const current = field.value ?? []
                              field.onChange(next ? [...current, code] : current.filter((c) => c !== code))
                            }}
                          />
                          {code}
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        />
      </FormField>
    </div>
  )

  if (isView || !onSubmit) {
    return content
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {content}

      {submitError && <p className="text-[12px] text-[var(--color-danger)]">{submitError}</p>}

      {!disabled && (
        <div className="flex justify-end gap-2 pt-2">
          <Button type="submit" loading={isSubmitting}>
            {submitLabel ?? (isCreate ? 'Create role' : 'Save changes')}
          </Button>
        </div>
      )}
    </form>
  )
}
