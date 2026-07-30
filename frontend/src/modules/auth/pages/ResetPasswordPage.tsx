// src/modules/auth/pages/ResetPasswordPage.tsx
// Invalid link -> Form -> Success flow. resetPasswordRequest is a NOT_IMPLEMENTED stub
// (api/index.ts), so "Success" only ever renders on a genuine mutation success - today that means
// submitting always surfaces the honest error banner instead of a fabricated confirmation.
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Eye, EyeOff, Lock } from 'lucide-react'
import { Card } from '@/components/shared/Card/Card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/feedback'
import { normalizeApiError } from '@/services/api-error'
import { resetPasswordSchema, type ResetPasswordFormValues } from '../schemas'
import { useResetPasswordMutation } from '../hooks'

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [succeeded, setSucceeded] = useState(false)
  const mutation = useResetPasswordMutation()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  })

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const onSubmit = (values: ResetPasswordFormValues) => {
    if (!token) return
    mutation.mutate({ token, newPassword: values.newPassword }, { onSuccess: () => setSucceeded(true) })
  }

  if (!token) {
    return (
      <Card padding="lg">
        <ErrorState
          title="Invalid or expired link"
          message="This password reset link is invalid or has expired. Request a new one to continue."
          className="py-4"
        />
        <Link to="/forgot-password" className="mt-2 block">
          <Button type="button" variant="primary" className="w-full">
            Request a new link
          </Button>
        </Link>
      </Card>
    )
  }

  if (succeeded) {
    return (
      <Card padding="lg" className="text-center">
        <div className="mx-auto w-12 h-12 rounded-[var(--radius-xl)] bg-[var(--color-success-bg)] flex items-center justify-center">
          <CheckCircle2 className="w-6 h-6 text-[var(--color-success)]" />
        </div>
        <h1 className="mt-4 text-[18px] font-semibold text-[var(--color-text-heading)]">Password reset</h1>
        <p className="mt-1.5 text-[13px] text-[var(--color-text-muted)]">Your password has been updated. Sign in with your new password.</p>
        <Link to="/login" className="mt-6 inline-block">
          <Button type="button" variant="primary">
            Return to login
          </Button>
        </Link>
      </Card>
    )
  }

  const formError = mutation.error ? normalizeApiError(mutation.error) : null

  return (
    <div>
      <div className="text-center mb-6">
        <h1 className="text-[22px] font-semibold text-[var(--color-text-heading)] tracking-tight">Set a new password</h1>
        <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">Choose a strong password for your account.</p>
      </div>

      <Card padding="lg">
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          {formError && (
            <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-3 py-2.5 text-[12px] text-[var(--color-danger-fg)]">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{formError.message}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="newPassword">New password</Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                icon={<Lock size={14} />}
                invalid={!!errors.newPassword}
                className="pr-9"
                {...register('newPassword')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {errors.newPassword && <p className="text-[11px] text-[var(--color-danger)]">{errors.newPassword.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                icon={<Lock size={14} />}
                invalid={!!errors.confirmPassword}
                className="pr-9"
                {...register('confirmPassword')}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {errors.confirmPassword && <p className="text-[11px] text-[var(--color-danger)]">{errors.confirmPassword.message}</p>}
          </div>

          <Button type="submit" variant="primary" size="lg" className="w-full" loading={mutation.isPending}>
            Reset password
          </Button>
        </form>
      </Card>
    </div>
  )
}
