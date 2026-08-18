// src/modules/master-admin/pages/CreateTenantPage.tsx
// One atomic create action (tenant + owner bootstrap invite), so this follows modules/auth's
// LoginPage/RegisterPage pattern (a single validated react-hook-form + zodResolver form in a
// Card) rather than TenantDetailPage's plain-useState pattern, which exists there because that
// page has two independent, unrelated update actions instead of one create.
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Mail, User } from 'lucide-react'
import { PageLayout, PageHeader, PageContent } from '@/components/page'
import { Card } from '@/components/shared/Card/Card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { normalizeApiError } from '@/services/api-error'
import { useCreateTenantMutation } from '../hooks'
import { createTenantSchema, type CreateTenantFormValues } from '../schemas'

export function CreateTenantPage() {
  const mutation = useCreateTenantMutation()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateTenantFormValues>({
    resolver: zodResolver(createTenantSchema),
    defaultValues: { name: '', ownerFirstName: '', ownerLastName: '', ownerEmail: '' },
  })

  const onSubmit = (values: CreateTenantFormValues) => mutation.mutate(values)
  const formError = mutation.error ? normalizeApiError(mutation.error) : null

  return (
    <PageLayout>
      <Link
        to="/master-admin/tenants"
        className="inline-flex items-center gap-1.5 text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] mb-3"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        All tenants
      </Link>

      <PageHeader title="Create tenant" description="Provisions the firm and emails its owner an invitation to set up their account." />

      <PageContent>
        <Card padding="lg" className="max-w-lg">
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
            {formError && (
              <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-3 py-2.5 text-[12px] text-[var(--color-danger-fg)]">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{formError.message}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="name">Firm name</Label>
              <Input id="name" autoComplete="organization" invalid={!!errors.name} {...register('name')} />
              {errors.name && <p className="text-[11px] text-[var(--color-danger)]">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ownerFirstName">Owner first name</Label>
                <Input
                  id="ownerFirstName"
                  autoComplete="given-name"
                  icon={<User size={14} />}
                  invalid={!!errors.ownerFirstName}
                  {...register('ownerFirstName')}
                />
                {errors.ownerFirstName && <p className="text-[11px] text-[var(--color-danger)]">{errors.ownerFirstName.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ownerLastName">Owner last name</Label>
                <Input
                  id="ownerLastName"
                  autoComplete="family-name"
                  invalid={!!errors.ownerLastName}
                  {...register('ownerLastName')}
                />
                {errors.ownerLastName && <p className="text-[11px] text-[var(--color-danger)]">{errors.ownerLastName.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ownerEmail">Owner email</Label>
              <Input
                id="ownerEmail"
                type="email"
                autoComplete="email"
                icon={<Mail size={14} />}
                invalid={!!errors.ownerEmail}
                {...register('ownerEmail')}
              />
              {errors.ownerEmail && <p className="text-[11px] text-[var(--color-danger)]">{errors.ownerEmail.message}</p>}
            </div>

            <Button type="submit" variant="primary" size="lg" className="w-full" loading={mutation.isPending}>
              Create tenant &amp; send invitation
            </Button>
          </form>
        </Card>
      </PageContent>
    </PageLayout>
  )
}
