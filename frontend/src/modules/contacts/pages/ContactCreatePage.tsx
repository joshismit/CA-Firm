// src/modules/contacts/pages/ContactCreatePage.tsx
import { useNavigate } from 'react-router-dom'
import { PageLayout, PageHeader, PageContent } from '@/components/page'
import { Card } from '@/components/shared/Card/Card'
import { normalizeApiError } from '@/services/api-error'
import { useCreateContactMutation } from '../hooks'
import { ContactForm } from '../components'
import type { CreateContactFormValues } from '../schemas'
import type { CreateContactPayload } from '../types'

export function ContactCreatePage() {
  const navigate = useNavigate()
  const createMutation = useCreateContactMutation()

  const handleSubmit = (values: CreateContactFormValues) => {
    const payload: CreateContactPayload = {
      firstName: values.firstName,
      lastName: values.lastName || undefined,
      email: values.email || undefined,
      phone: values.phone || undefined,
      pan: values.pan || undefined,
    }
    createMutation.mutate(payload, {
      onSuccess: (contact) => navigate(`/contacts/${contact.id}`),
    })
  }

  return (
    <PageLayout>
      <PageHeader title="New Contact" description="Add a contact to your firm's directory." />
      <PageContent>
        <Card>
          <ContactForm
            mode="create"
            onSubmit={handleSubmit}
            isSubmitting={createMutation.isPending}
            submitError={createMutation.isError ? normalizeApiError(createMutation.error).message : undefined}
          />
        </Card>
      </PageContent>
    </PageLayout>
  )
}
