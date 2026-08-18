// src/modules/master-admin/pages/MasterAdminLoginPage.tsx
// Separate from the tenant AuthLayout's LoginPage - a MasterAdmin isn't a User row and has no
// tenant, so it can't go through /auth/login (see MasterAdminAuthService's header comment on the
// backend). Rendered standalone (not inside AuthLayout/GuestRoute) since this portal is visually
// and structurally distinct from the tenant app, mirroring MasterAdminLayout's own choice to not
// reuse AppLayout.
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react'
import { Card } from '@/components/shared/Card/Card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { normalizeApiError } from '@/services/api-error'
import { masterAdminLoginSchema, type MasterAdminLoginFormValues } from '../schemas'
import { useMasterAdminLoginMutation } from '../hooks'

export function MasterAdminLoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const mutation = useMasterAdminLoginMutation()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MasterAdminLoginFormValues>({
    resolver: zodResolver(masterAdminLoginSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = (values: MasterAdminLoginFormValues) => mutation.mutate(values)
  const formError = mutation.error ? normalizeApiError(mutation.error) : null

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-neutral-900)] px-4">
      <div className="w-full max-w-[380px]">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-[var(--radius-md)] bg-white/10 mb-3">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-[20px] font-semibold text-white tracking-tight">Master Admin</h1>
          <p className="mt-1 text-[13px] text-white/60">Platform administration portal.</p>
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
              {errors.password && <p className="text-[11px] text-[var(--color-danger)]">{errors.password.message}</p>}
            </div>

            <Button type="submit" variant="primary" size="lg" className="w-full" loading={mutation.isPending}>
              Sign in
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
