// src/modules/auth/pages/LoginPage.tsx
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { AlertCircle, Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { Card } from '@/components/shared/Card/Card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { normalizeApiError } from '@/services/api-error'
import { loginSchema, type LoginFormValues } from '../schemas'
import { useLoginMutation } from '../hooks'

export function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const mutation = useLoginMutation()

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
  })

  const onSubmit = (values: LoginFormValues) => mutation.mutate(values)

  const formError = mutation.error ? normalizeApiError(mutation.error) : null

  return (
    <div>
      <div className="text-center mb-6">
        <h1 className="text-[22px] font-semibold text-[var(--color-text-heading)] tracking-tight">
          Sign in to your firm
        </h1>
        <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
          Enter your credentials to access your workspace.
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
            {errors.email && (
              <p className="text-[11px] text-[var(--color-danger)]">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
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
            {errors.password && (
              <p className="text-[11px] text-[var(--color-danger)]">{errors.password.message}</p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-[13px] text-[var(--color-text-secondary)] cursor-pointer">
              <Controller
                name="rememberMe"
                control={control}
                render={({ field }) => (
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
              Remember me
            </label>
            <Link
              to="/forgot-password"
              className="text-[13px] text-[var(--color-text-link)] hover:text-[var(--color-text-link-hover)]"
            >
              Forgot password?
            </Link>
          </div>

          <Button type="submit" variant="primary" size="lg" className="w-full" loading={mutation.isPending}>
            Sign in
          </Button>
        </form>
      </Card>
    </div>
  )
}
