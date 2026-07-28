// src/modules/contacts/components/ContactForm.tsx
// Single reusable form for create/edit/view - no per-mode duplicate forms. Built entirely from
// existing shared primitives (FormField, Input, Button) and the existing, locked contact schema.
// Unlike BusinessForm, createContactSchema has no z.coerce fields, so the form-state shape and the
// submit-callback shape are identical - a single generic on useForm is enough here.
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createContactSchema, type CreateContactFormValues } from '../schemas'
import type { Contact } from '../types'

export type ContactFormMode = 'create' | 'edit' | 'view'

// The `uppercase` class on PAN below is CSS-only (text-transform) - it makes the field *display*
// uppercase without changing the actual value, so typing "abcde1234f" would still submit lowercase
// and fail the schema's `[A-Z]{5}[0-9]{4}[A-Z]` regex despite looking correct on screen. This
// upper-cases the real value before it ever reaches the resolver - same fix as BusinessForm's.
const toUpperCase = (value: string) => value.toUpperCase()

export interface ContactFormProps {
  mode: ContactFormMode
  contact?: Contact
  onSubmit?: (values: CreateContactFormValues) => void
  isSubmitting?: boolean
  submitError?: string
  submitLabel?: string
}

export function ContactForm({ mode, contact, onSubmit, isSubmitting = false, submitError, submitLabel }: ContactFormProps) {
  const isView = mode === 'view'
  const isCreate = mode === 'create'

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateContactFormValues>({
    resolver: zodResolver(createContactSchema),
    defaultValues: contact
      ? {
          firstName: contact.firstName,
          lastName: contact.lastName ?? '',
          email: contact.email ?? '',
          phone: contact.phone ?? '',
          pan: contact.pan ?? '',
        }
      : undefined,
  })

  const content = (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <FormField label="First name" htmlFor="firstName" error={errors.firstName?.message}>
        <Input id="firstName" disabled={isView} invalid={!!errors.firstName} {...register('firstName')} />
      </FormField>

      <FormField label="Last name" htmlFor="lastName" error={errors.lastName?.message}>
        <Input id="lastName" disabled={isView} invalid={!!errors.lastName} {...register('lastName')} />
      </FormField>

      <FormField label="Email" htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" disabled={isView} invalid={!!errors.email} {...register('email')} />
      </FormField>

      <FormField label="Phone" htmlFor="phone" error={errors.phone?.message}>
        <Input id="phone" type="tel" disabled={isView} invalid={!!errors.phone} {...register('phone')} />
      </FormField>

      <FormField label="PAN" htmlFor="pan" error={errors.pan?.message}>
        <Input
          id="pan"
          disabled={isView}
          invalid={!!errors.pan}
          className="uppercase"
          {...register('pan', { setValueAs: toUpperCase })}
        />
      </FormField>
    </div>
  )

  if (isView || !onSubmit) {
    return <div className="space-y-4">{content}</div>
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {content}

      {submitError && <p className="text-[12px] text-[var(--color-danger)]">{submitError}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" loading={isSubmitting}>
          {submitLabel ?? (isCreate ? 'Create contact' : 'Save changes')}
        </Button>
      </div>
    </form>
  )
}
