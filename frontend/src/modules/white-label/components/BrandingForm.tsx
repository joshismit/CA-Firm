// src/modules/white-label/components/BrandingForm.tsx
// Text/color fields only - logo/favicon/login background uploads are a separate concern
// (BrandingAssetUploader) since they hit a different endpoint (multipart, not JSON).
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { brandingFormSchema, type BrandingFormValues } from '../schemas'
import type { TenantBranding, UpdateTenantBrandingPayload } from '../types'

export interface BrandingFormProps {
  branding: TenantBranding | undefined
  onSubmit: (payload: UpdateTenantBrandingPayload) => void
  isSubmitting?: boolean
  submitError?: string
  canManage: boolean
}

const EMPTY_VALUES: BrandingFormValues = {
  firmName: '',
  primaryColor: '',
  secondaryColor: '',
  accentColor: '',
  backgroundColor: '',
  supportEmail: '',
  supportPhone: '',
  footerText: '',
}

export function BrandingForm({ branding, onSubmit, isSubmitting, submitError, canManage }: BrandingFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<BrandingFormValues>({ resolver: zodResolver(brandingFormSchema), defaultValues: EMPTY_VALUES })

  useEffect(() => {
    if (!branding) return
    reset({
      firmName: branding.firmName ?? '',
      primaryColor: branding.primaryColor ?? '',
      secondaryColor: branding.secondaryColor ?? '',
      accentColor: branding.accentColor ?? '',
      backgroundColor: branding.backgroundColor ?? '',
      supportEmail: branding.supportEmail ?? '',
      supportPhone: branding.supportPhone ?? '',
      footerText: branding.footerText ?? '',
    })
  }, [branding, reset])

  const submit = (values: BrandingFormValues) => {
    const payload: UpdateTenantBrandingPayload = {}
    for (const [key, value] of Object.entries(values) as [keyof BrandingFormValues, string][]) {
      if (value) payload[key] = value
    }
    onSubmit(payload)
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(submit)} noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Firm name" htmlFor="firmName" error={errors.firmName?.message}>
          <Input id="firmName" placeholder="Acme & Associates" disabled={!canManage} invalid={!!errors.firmName} {...register('firmName')} />
        </FormField>
        <FormField label="Support email" htmlFor="supportEmail" error={errors.supportEmail?.message}>
          <Input id="supportEmail" type="email" disabled={!canManage} invalid={!!errors.supportEmail} {...register('supportEmail')} />
        </FormField>
        <FormField label="Primary color" htmlFor="primaryColor" error={errors.primaryColor?.message}>
          <Input id="primaryColor" placeholder="#1a73e8" disabled={!canManage} invalid={!!errors.primaryColor} {...register('primaryColor')} />
        </FormField>
        <FormField label="Accent color" htmlFor="accentColor" error={errors.accentColor?.message}>
          <Input id="accentColor" placeholder="#f59e0b" disabled={!canManage} invalid={!!errors.accentColor} {...register('accentColor')} />
        </FormField>
        <FormField label="Secondary color" htmlFor="secondaryColor" error={errors.secondaryColor?.message}>
          <Input id="secondaryColor" placeholder="#6366f1" disabled={!canManage} invalid={!!errors.secondaryColor} {...register('secondaryColor')} />
        </FormField>
        <FormField label="Background color" htmlFor="backgroundColor" error={errors.backgroundColor?.message}>
          <Input id="backgroundColor" placeholder="#ffffff" disabled={!canManage} invalid={!!errors.backgroundColor} {...register('backgroundColor')} />
        </FormField>
        <FormField label="Support phone" htmlFor="supportPhone" error={errors.supportPhone?.message}>
          <Input id="supportPhone" disabled={!canManage} invalid={!!errors.supportPhone} {...register('supportPhone')} />
        </FormField>
        <FormField label="Footer text" htmlFor="footerText" error={errors.footerText?.message}>
          <Input id="footerText" placeholder="© 2026 Acme & Associates" disabled={!canManage} invalid={!!errors.footerText} {...register('footerText')} />
        </FormField>
      </div>

      {submitError && <p className="text-[12px] text-[var(--color-danger)]">{submitError}</p>}

      {canManage && (
        <Button type="submit" variant="primary" loading={isSubmitting} disabled={!isDirty}>
          Save branding
        </Button>
      )}
    </form>
  )
}
