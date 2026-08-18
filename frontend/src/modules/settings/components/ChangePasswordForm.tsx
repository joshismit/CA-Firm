// src/modules/settings/components/ChangePasswordForm.tsx
// Real form against a real endpoint (POST /auth/change-password) - not a NOT_IMPLEMENTED stub.
// Reuses modules/auth's changePasswordSchema/useChangePasswordMutation directly rather than
// re-deriving password validation rules here.
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { normalizeApiError } from '@/services/api-error'
import { useChangePasswordMutation } from '@/modules/auth/hooks'
import { changePasswordSchema, type ChangePasswordFormValues } from '@/modules/auth/schemas'

export function ChangePasswordForm() {
  const mutation = useChangePasswordMutation()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
  })

  const onSubmit = (values: ChangePasswordFormValues) => {
    mutation.mutate(
      { currentPassword: values.currentPassword, newPassword: values.newPassword },
      { onSuccess: () => reset() }
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FormField label="Current password" htmlFor="currentPassword" error={errors.currentPassword?.message}>
          <Input id="currentPassword" type="password" invalid={!!errors.currentPassword} autoComplete="current-password" {...register('currentPassword')} />
        </FormField>
        <FormField label="New password" htmlFor="newPassword" error={errors.newPassword?.message}>
          <Input id="newPassword" type="password" invalid={!!errors.newPassword} autoComplete="new-password" {...register('newPassword')} />
        </FormField>
        <FormField label="Confirm new password" htmlFor="confirmPassword" error={errors.confirmPassword?.message}>
          <Input id="confirmPassword" type="password" invalid={!!errors.confirmPassword} autoComplete="new-password" {...register('confirmPassword')} />
        </FormField>
      </div>

      <p className="text-[11px] text-[var(--color-text-muted)]">
        Changing your password signs you out of every session, including this one - you'll need to log in again.
      </p>

      {mutation.isError && <p className="text-[12px] text-[var(--color-danger)]">{normalizeApiError(mutation.error).message}</p>}

      <div className="flex justify-end">
        <Button type="submit" loading={mutation.isPending}>
          Change password
        </Button>
      </div>
    </form>
  )
}
