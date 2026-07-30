// src/modules/clients/pages/ClientCreatePage.tsx
// "Add Client" is a 2-step wizard over two real, independent modules: step 1 creates a Business
// (POST /business), step 2 optionally creates a Contact (POST /contacts) and links it to the
// business just created via the ContactRole join (POST /contacts/roles) - there's no dedicated
// Client backend to call directly (see ClientsPage.tsx's own header comment), so this composes
// the same mutations BusinessCreatePage/ContactCreatePage already use rather than inventing one.
// No wizard/stepper primitive exists elsewhere in the app yet, so step state/indicator are local.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { PageLayout, PageHeader, PageContent } from '@/components/page'
import { Card } from '@/components/shared/Card/Card'
import { Button } from '@/components/ui/button'
import { normalizeApiError } from '@/services/api-error'
import { useCreateBusinessMutation } from '@/modules/business/hooks'
import { BusinessForm } from '@/modules/business/components'
import type { CreateBusinessFormValues } from '@/modules/business/schemas'
import type { Business, CreateBusinessPayload } from '@/modules/business/types'
import { useCreateContactMutation, useAssignContactRoleMutation } from '@/modules/contacts/hooks'
import { ContactForm } from '@/modules/contacts/components'
import type { CreateContactFormValues } from '@/modules/contacts/schemas'
import type { CreateContactPayload } from '@/modules/contacts/types'

type WizardStep = 'business' | 'contact'

const STEPS: { key: WizardStep; label: string }[] = [
  { key: 'business', label: 'Business details' },
  { key: 'contact', label: 'Primary contact' },
]

export function ClientCreatePage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<WizardStep>('business')
  const [business, setBusiness] = useState<Business | null>(null)

  const createBusinessMutation = useCreateBusinessMutation()
  const createContactMutation = useCreateContactMutation()
  const assignRoleMutation = useAssignContactRoleMutation()

  const handleCreateBusiness = (values: CreateBusinessFormValues) => {
    const payload: CreateBusinessPayload = {
      typeId: values.typeId,
      name: values.name,
      legalName: values.legalName || undefined,
      pan: values.pan || undefined,
      gstin: values.gstin || undefined,
      cin: values.cin || undefined,
      incorporationDate: values.incorporationDate ? values.incorporationDate.toISOString() : undefined,
      financialYearStart: values.financialYearStart,
      industry: values.industry || undefined,
    }
    createBusinessMutation.mutate(payload, {
      onSuccess: (created) => {
        setBusiness(created)
        setStep('contact')
      },
    })
  }

  const handleCreateContact = (values: CreateContactFormValues) => {
    if (!business) return
    const payload: CreateContactPayload = {
      firstName: values.firstName,
      lastName: values.lastName || undefined,
      email: values.email || undefined,
      phone: values.phone || undefined,
      pan: values.pan || undefined,
    }
    createContactMutation.mutate(payload, {
      onSuccess: (contact) => {
        assignRoleMutation.mutate(
          { businessId: business.id, contactId: contact.id, roleType: 'OWNER', isPrimary: true },
          { onSuccess: () => navigate(`/business/${business.id}`) },
        )
      },
    })
  }

  const isLinkingContact = createContactMutation.isPending || assignRoleMutation.isPending
  const contactStepError = createContactMutation.isError
    ? normalizeApiError(createContactMutation.error).message
    : assignRoleMutation.isError
      ? normalizeApiError(assignRoleMutation.error).message
      : undefined

  return (
    <PageLayout>
      <PageHeader title="Add Client" description="Create a business, then link its primary contact." />
      <PageContent>
        <div className="flex items-center gap-3 mb-2">
          {STEPS.map((s, index) => {
            const isDone = s.key === 'business' && step === 'contact'
            const isCurrent = s.key === step
            return (
              <div key={s.key} className="flex items-center gap-3">
                {index > 0 && <div className="w-8 h-px bg-[var(--color-border)]" />}
                <div className="flex items-center gap-2">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 ${
                      isDone
                        ? 'bg-[var(--color-success)] text-white'
                        : isCurrent
                          ? 'bg-[var(--color-primary-600)] text-white'
                          : 'bg-[var(--color-bg-muted)] text-[var(--color-text-muted)]'
                    }`}
                  >
                    {isDone ? <Check className="w-3 h-3" /> : index + 1}
                  </div>
                  <span
                    className={`text-[13px] ${isCurrent ? 'font-semibold text-[var(--color-text-heading)]' : 'text-[var(--color-text-muted)]'}`}
                  >
                    {s.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        <Card>
          {step === 'business' ? (
            <BusinessForm
              mode="create"
              onSubmit={handleCreateBusiness}
              isSubmitting={createBusinessMutation.isPending}
              submitError={createBusinessMutation.isError ? normalizeApiError(createBusinessMutation.error).message : undefined}
              submitLabel="Continue"
            />
          ) : (
            <div className="space-y-4">
              <p className="text-[13px] text-[var(--color-text-muted)]">
                Add the primary contact for <span className="font-medium text-[var(--color-text-heading)]">{business?.name}</span>, or
                skip this step and add contacts later.
              </p>
              <ContactForm
                mode="create"
                onSubmit={handleCreateContact}
                isSubmitting={isLinkingContact}
                submitError={contactStepError}
                submitLabel="Create client"
              />
              <div className="flex justify-end pt-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => business && navigate(`/business/${business.id}`)}>
                  Skip — I'll add contacts later
                </Button>
              </div>
            </div>
          )}
        </Card>
      </PageContent>
    </PageLayout>
  )
}
