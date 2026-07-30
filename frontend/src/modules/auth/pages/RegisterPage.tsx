// src/modules/auth/pages/RegisterPage.tsx
// Same structure/markup as LoginPage.tsx (header + Card form) - no second auth design language.
// registerRequest is a NOT_IMPLEMENTED stub (api/index.ts), so submitting always surfaces the
// honest "not available yet" banner below instead of a fabricated account/success state.
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { AlertCircle, Eye, EyeOff, Lock, Mail, User } from 'lucide-react'
import { Card } from '@/components/shared/Card/Card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { normalizeApiError } from '@/services/api-error'
import { registerSchema, type RegisterFormValues } from '../schemas'
import { useRegisterMutation } from '../hooks'

export function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const mutation = useRegisterMutation()

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '', acceptTerms: false },
  })

  const onSubmit = (values: RegisterFormValues) =>
    mutation.mutate({ fullName: values.fullName, email: values.email, password: values.password })

  const formError = mutation.error ? normalizeApiError(mutation.error) : null

  return (
    <div>
      <div className="text-center mb-6">
        <h1 className="text-[22px] font-semibold text-[var(--color-text-heading)] tracking-tight">Create your firm's workspace</h1>
        <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">Set up an account to get started.</p>
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

          <div>
            <label className="flex items-start gap-2 text-[13px] text-[var(--color-text-secondary)] cursor-pointer">
              <Controller
                name="acceptTerms"
                control={control}
                render={({ field }) => (
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} className="mt-0.5" />
                )}
              />
              <span>
                I agree to the Terms of Service and Privacy Policy.
              </span>
            </label>
            {errors.acceptTerms && <p className="mt-1 text-[11px] text-[var(--color-danger)]">{errors.acceptTerms.message}</p>}
          </div>

          <Button type="submit" variant="primary" size="lg" className="w-full" loading={mutation.isPending}>
            Create account
          </Button>
        </form>
      </Card>

      <p className="mt-6 text-center text-[12px] text-[var(--color-text-muted)]">
        Already have an account?{' '}
        <Link to="/login" className="text-[var(--color-text-link)] hover:text-[var(--color-text-link-hover)]">
          Sign in
        </Link>
      </p>
    </div>
  )
}
