// src/modules/users/components/UserForm.tsx
// Single public component, two internal branches - inviting a user (email + roles + message) and
// editing one (name/phone/job title/status) are genuinely different operations with different
// payload shapes (InviteUserPayload vs UpdateUserPayload), not just a hidden-field variant of one
// schema the way BusinessForm's typeId is - so each mode gets its own useForm/schema internally,
// while still exposing one `UserForm` entry point as named in the module's design.
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Spinner, ErrorState } from '@/components/feedback'
import { normalizeApiError } from '@/services/api-error'
import { useRolesQuery } from '@/modules/roles/hooks'
import { inviteUserSchema, updateUserSchema, userStatusValues, type InviteUserFormValues, type UpdateUserFormValues } from '../schemas'
import { USER_STATUS_LABELS } from '../constants'
import type { User } from '../types'

export type UserFormMode = 'invite' | 'edit' | 'view'

export interface UserFormProps {
  mode: UserFormMode
  user?: User
  onInvite?: (values: InviteUserFormValues) => void
  onUpdate?: (values: UpdateUserFormValues) => void
  isSubmitting?: boolean
  submitError?: string
}

function InviteUserFormInner({ onInvite, isSubmitting, submitError }: Pick<UserFormProps, 'onInvite' | 'isSubmitting' | 'submitError'>) {
  const rolesQuery = useRolesQuery({ page: 1, limit: 100 })
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<InviteUserFormValues>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: { roleIds: [] },
  })

  return (
    <form onSubmit={handleSubmit((values) => onInvite?.(values))} className="space-y-4" noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Email" htmlFor="email" error={errors.email?.message} className="sm:col-span-2">
          <Input id="email" type="email" invalid={!!errors.email} {...register('email')} />
        </FormField>
        <FormField label="First name" htmlFor="firstName" error={errors.firstName?.message}>
          <Input id="firstName" invalid={!!errors.firstName} {...register('firstName')} />
        </FormField>
        <FormField label="Last name" htmlFor="lastName" error={errors.lastName?.message}>
          <Input id="lastName" invalid={!!errors.lastName} {...register('lastName')} />
        </FormField>
      </div>

      <FormField label="Roles" htmlFor="roleIds" error={errors.roleIds?.message as string | undefined}>
        {rolesQuery.isLoading ? (
          <Spinner fullScreen={false} label="Loading roles…" className="py-4" />
        ) : rolesQuery.isError ? (
          <ErrorState message={normalizeApiError(rolesQuery.error).message} onRetry={rolesQuery.refetch} className="py-4" />
        ) : !rolesQuery.data || rolesQuery.data.data.length === 0 ? (
          <p className="text-[12px] text-[var(--color-text-muted)]">No roles available to assign yet.</p>
        ) : (
          <Controller
            name="roleIds"
            control={control}
            render={({ field }) => (
              <div className="space-y-2 border border-[var(--color-border)] rounded-[var(--radius-md)] p-3">
                {rolesQuery.data.data.map((role) => {
                  const checked = field.value?.includes(role.id) ?? false
                  return (
                    <label key={role.id} className="flex items-center gap-2.5 text-[13px] text-[var(--color-text-body)] cursor-pointer">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(next) => {
                          const current = field.value ?? []
                          field.onChange(next ? [...current, role.id] : current.filter((id) => id !== role.id))
                        }}
                      />
                      {role.name}
                    </label>
                  )
                })}
              </div>
            )}
          />
        )}
      </FormField>

      <FormField label="Invitation message (optional)" htmlFor="message" error={errors.message?.message}>
        <Input id="message" invalid={!!errors.message} {...register('message')} />
      </FormField>

      {submitError && <p className="text-[12px] text-[var(--color-danger)]">{submitError}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" loading={isSubmitting}>
          Send invitation
        </Button>
      </div>
    </form>
  )
}

function EditUserFormInner({
  user,
  onUpdate,
  isSubmitting,
  submitError,
  isView,
}: Pick<UserFormProps, 'user' | 'onUpdate' | 'isSubmitting' | 'submitError'> & { isView: boolean }) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateUserFormValues>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      phone: user?.phone ?? '',
      jobTitle: user?.jobTitle ?? '',
      status: user?.status,
    },
  })

  const content = (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <FormField label="First name" htmlFor="firstName" error={errors.firstName?.message}>
        <Input id="firstName" disabled={isView} invalid={!!errors.firstName} {...register('firstName')} />
      </FormField>
      <FormField label="Last name" htmlFor="lastName" error={errors.lastName?.message}>
        <Input id="lastName" disabled={isView} invalid={!!errors.lastName} {...register('lastName')} />
      </FormField>
      <FormField label="Phone" htmlFor="phone" error={errors.phone?.message}>
        <Input id="phone" disabled={isView} invalid={!!errors.phone} {...register('phone')} />
      </FormField>
      <FormField label="Job title" htmlFor="jobTitle" error={errors.jobTitle?.message}>
        <Input id="jobTitle" disabled={isView} invalid={!!errors.jobTitle} {...register('jobTitle')} />
      </FormField>
      {!isView && (
        <FormField label="Status" htmlFor="status" error={errors.status?.message}>
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value}
                onChange={field.onChange}
                options={userStatusValues.map((s) => ({ value: s, label: USER_STATUS_LABELS[s] }))}
              />
            )}
          />
        </FormField>
      )}
    </div>
  )

  if (isView) return <div className="space-y-4">{content}</div>

  return (
    <form onSubmit={handleSubmit((values) => onUpdate?.(values))} className="space-y-4" noValidate>
      {content}
      {submitError && <p className="text-[12px] text-[var(--color-danger)]">{submitError}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" loading={isSubmitting}>
          Save changes
        </Button>
      </div>
    </form>
  )
}

export function UserForm({ mode, user, onInvite, onUpdate, isSubmitting = false, submitError }: UserFormProps) {
  if (mode === 'invite') {
    return <InviteUserFormInner onInvite={onInvite} isSubmitting={isSubmitting} submitError={submitError} />
  }
  return <EditUserFormInner user={user} onUpdate={onUpdate} isSubmitting={isSubmitting} submitError={submitError} isView={mode === 'view'} />
}
