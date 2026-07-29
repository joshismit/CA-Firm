// src/modules/settings/components/FirmSettingsForm.tsx
// Single form for the firm's company profile - built entirely from existing shared primitives
// (FormField, Input, Button) and the generic, provisional firm-settings schema (see
// schemas/index.ts and types/index.ts's header comment for why the fields are generic rather than
// a confirmed backend contract).
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { updateFirmSettingsSchema, type UpdateFirmSettingsFormValues } from '../schemas'
import type { FirmSettings } from '../types'

const toUpperCase = (value: string) => value.toUpperCase()

export interface FirmSettingsFormProps {
  firmSettings?: FirmSettings
  onSubmit: (values: UpdateFirmSettingsFormValues) => void
  isSubmitting?: boolean
  submitError?: string
  canManage: boolean
}

export function FirmSettingsForm({ firmSettings, onSubmit, isSubmitting = false, submitError, canManage }: FirmSettingsFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<UpdateFirmSettingsFormValues>({
    resolver: zodResolver(updateFirmSettingsSchema),
    defaultValues: {
      name: firmSettings?.name ?? '',
      legalName: firmSettings?.legalName ?? '',
      gstin: firmSettings?.gstin ?? '',
      pan: firmSettings?.pan ?? '',
      addressLine1: firmSettings?.addressLine1 ?? '',
      city: firmSettings?.city ?? '',
      state: firmSettings?.state ?? '',
      pincode: firmSettings?.pincode ?? '',
      phone: firmSettings?.phone ?? '',
      email: firmSettings?.email ?? '',
      website: firmSettings?.website ?? '',
    },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Firm name" htmlFor="name" error={errors.name?.message}>
          <Input id="name" disabled={!canManage} invalid={!!errors.name} {...register('name')} />
        </FormField>

        <FormField label="Legal name" htmlFor="legalName" error={errors.legalName?.message}>
          <Input id="legalName" disabled={!canManage} invalid={!!errors.legalName} {...register('legalName')} />
        </FormField>

        <FormField label="GSTIN" htmlFor="gstin" error={errors.gstin?.message}>
          <Input id="gstin" disabled={!canManage} invalid={!!errors.gstin} className="uppercase" {...register('gstin', { setValueAs: toUpperCase })} />
        </FormField>

        <FormField label="PAN" htmlFor="pan" error={errors.pan?.message}>
          <Input id="pan" disabled={!canManage} invalid={!!errors.pan} className="uppercase" {...register('pan', { setValueAs: toUpperCase })} />
        </FormField>

        <FormField label="Address" htmlFor="addressLine1" error={errors.addressLine1?.message} className="sm:col-span-2">
          <Input id="addressLine1" disabled={!canManage} invalid={!!errors.addressLine1} {...register('addressLine1')} />
        </FormField>

        <FormField label="City" htmlFor="city" error={errors.city?.message}>
          <Input id="city" disabled={!canManage} invalid={!!errors.city} {...register('city')} />
        </FormField>

        <FormField label="State" htmlFor="state" error={errors.state?.message}>
          <Input id="state" disabled={!canManage} invalid={!!errors.state} {...register('state')} />
        </FormField>

        <FormField label="Pincode" htmlFor="pincode" error={errors.pincode?.message}>
          <Input id="pincode" disabled={!canManage} invalid={!!errors.pincode} {...register('pincode')} />
        </FormField>

        <FormField label="Phone" htmlFor="phone" error={errors.phone?.message}>
          <Input id="phone" disabled={!canManage} invalid={!!errors.phone} {...register('phone')} />
        </FormField>

        <FormField label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" disabled={!canManage} invalid={!!errors.email} {...register('email')} />
        </FormField>

        <FormField label="Website" htmlFor="website" error={errors.website?.message}>
          <Input id="website" disabled={!canManage} invalid={!!errors.website} {...register('website')} />
        </FormField>
      </div>

      {submitError && <p className="text-[12px] text-[var(--color-danger)]">{submitError}</p>}

      {canManage && (
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" disabled={!isDirty || isSubmitting} onClick={() => reset()}>
            Reset
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Save changes
          </Button>
        </div>
      )}
    </form>
  )
}
