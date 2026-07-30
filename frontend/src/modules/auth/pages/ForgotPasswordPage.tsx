// src/modules/auth/pages/ForgotPasswordPage.tsx
// Form -> Email Sent flow. forgotPasswordRequest is a NOT_IMPLEMENTED stub (api/index.ts), so the
// "Email Sent" state only ever renders on a genuine mutation success - today that means submitting
// always surfaces the honest error banner instead, never a fabricated "check your inbox" message.
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Mail, MailCheck } from 'lucide-react'
import { Card } from '@/components/shared/Card/Card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { normalizeApiError } from '@/services/api-error'
import { forgotPasswordSchema, type ForgotPasswordFormValues } from '../schemas'
import { useForgotPasswordMutation } from '../hooks'

export function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const mutation = useForgotPasswordMutation()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  })

  const onSubmit = (values: ForgotPasswordFormValues) =>
    mutation.mutate(values, { onSuccess: () => setSentTo(values.email) })

  const formError = mutation.error ? normalizeApiError(mutation.error) : null

  if (sentTo) {
    return (
      <div>
        <Card padding="lg" className="text-center">
          <div className="mx-auto w-12 h-12 rounded-[var(--radius-xl)] bg-[var(--color-success-bg)] flex items-center justify-center">
            <MailCheck className="w-6 h-6 text-[var(--color-success)]" />
          </div>
          <h1 className="mt-4 text-[18px] font-semibold text-[var(--color-text-heading)]">Check your email</h1>
          <p className="mt-1.5 text-[13px] text-[var(--color-text-muted)]">
            If an account exists for <span className="font-medium text-[var(--color-text-body)]">{sentTo}</span>, we've sent a link
            to reset your password.
          </p>
          <Link to="/login" className="mt-6 inline-block">
            <Button type="button" variant="secondary">
              Return to login
            </Button>
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <div className="text-center mb-6">
        <h1 className="text-[22px] font-semibold text-[var(--color-text-heading)] tracking-tight">Forgot your password?</h1>
        <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
          Enter your email and we'll send you a link to reset it.
        </p>
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
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              icon={<Mail size={14} />}
              invalid={!!errors.email}
              {...register('email')}
            />
            {errors.email && <p className="text-[11px] text-[var(--color-danger)]">{errors.email.message}</p>}
          </div>

          <Button type="submit" variant="primary" size="lg" className="w-full" loading={mutation.isPending}>
            Send reset link
          </Button>
        </form>
      </Card>

      <p className="mt-6 text-center text-[12px] text-[var(--color-text-muted)]">
        <Link to="/login" className="inline-flex items-center gap-1 text-[var(--color-text-link)] hover:text-[var(--color-text-link-hover)]">
          <ArrowLeft className="w-3 h-3" />
          Back to login
        </Link>
      </p>
    </div>
  )
}
