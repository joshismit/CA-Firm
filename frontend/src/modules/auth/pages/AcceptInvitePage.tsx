// src/modules/auth/pages/AcceptInvitePage.tsx
// Invite lookup -> Form flow. getInviteInfo/acceptInviteRequest are NOT_IMPLEMENTED stubs
// (api/index.ts), so the lookup genuinely 501s and this honestly shows "invalid or expired
// invitation" today rather than fabricating invite details or a fake accept form. The full form
// UI is still built below so it renders correctly the moment a real invite backend exists.
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useParams } from 'react-router-dom'
import { AlertCircle, Eye, EyeOff, Lock, User } from 'lucide-react'
import { Card } from '@/components/shared/Card/Card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ErrorState, Spinner } from '@/components/feedback'
import { normalizeApiError } from '@/services/api-error'
import { acceptInviteSchema, type AcceptInviteFormValues } from '../schemas'
import { useAcceptInviteMutation, useInviteInfoQuery } from '../hooks'

export function AcceptInvitePage() {
  const { token = '' } = useParams<{ token: string }>()
  const inviteQuery = useInviteInfoQuery(token)
  const mutation = useAcceptInviteMutation()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AcceptInviteFormValues>({
    resolver: zodResolver(acceptInviteSchema),
    defaultValues: { fullName: '', password: '', confirmPassword: '' },
  })

  const onSubmit = (values: AcceptInviteFormValues) =>
    mutation.mutate({ token, fullName: values.fullName, password: values.password })

  if (inviteQuery.isLoading) {
    return (
      <Card padding="lg">
        <Spinner label="Checking invitation…" />
      </Card>
    )
  }

  if (inviteQuery.isError) {
    return (
      <Card padding="lg">
        <ErrorState
          title="Invalid or expired invitation"
          message={normalizeApiError(inviteQuery.error).message}
          onRetry={() => inviteQuery.refetch()}
          className="py-4"
        />
        <Link to="/login" className="mt-2 block">
          <Button type="button" variant="secondary" className="w-full">
            Back to login
          </Button>
        </Link>
      </Card>
    )
  }

  const invite = inviteQuery.data
  const formError = mutation.error ? normalizeApiError(mutation.error) : null

  return (
    <div>
      <div className="text-center mb-6">
        <h1 className="text-[22px] font-semibold text-[var(--color-text-heading)] tracking-tight">You're invited</h1>
        <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
          {invite?.inviterName ?? 'Someone'} invited you to join{' '}
          <span className="font-medium text-[var(--color-text-body)]">{invite?.tenantName}</span> as {invite?.role}.
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
            <Input id="email" type="email" value={invite?.email ?? ''} disabled />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              autoComplete="name"
              icon={<User size={14} />}
              invalid={!!errors.fullName}
              {...register('fullName')}
            />
            {errors.fullName && <p className="text-[11px] text-[var(--color-danger)]">{errors.fullName.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                icon={<Lock size={14} />}
                invalid={!!errors.password}
                className="pr-9"
                {...register('password')}
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
            {errors.password && <p className="text-[11px] text-[var(--color-danger)]">{errors.password.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirm password</Label>
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
            Accept invitation
          </Button>
        </form>
      </Card>
    </div>
  )
}
