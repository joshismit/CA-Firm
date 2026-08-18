// src/modules/contacts/pages/ContactEditPage.tsx
import { useNavigate, useParams } from 'react-router-dom'
import { PageLayout, PageHeader, PageContent } from '@/components/page'
import { Card } from '@/components/shared/Card/Card'
import { Spinner, ErrorState } from '@/components/feedback'
import { normalizeApiError } from '@/services/api-error'
import { useContactQuery, useUpdateContactMutation } from '../hooks'
import { ContactForm } from '../components'
import type { CreateContactFormValues } from '../schemas'
import type { UpdateContactPayload } from '../types'

export function ContactEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: contact, isLoading, isError, error, refetch } = useContactQuery(id!)
  const updateMutation = useUpdateContactMutation(id!)

  if (isLoading) {
    return (
      <PageLayout>
        <Spinner fullScreen={false} label="Loading contact…" className="py-16" />
      </PageLayout>
    )
  }

  if (isError || !contact) {
    return (
      <PageLayout>
        <ErrorState
          title="Couldn't load this contact"
          message={error ? normalizeApiError(error).message : 'Contact not found.'}
          onRetry={refetch}
        />
      </PageLayout>
    )
  }

  const handleSubmit = (values: CreateContactFormValues) => {
    const payload: UpdateContactPayload = {
      firstName: values.firstName,
      lastName: values.lastName || undefined,
      email: values.email || undefined,
      phone: values.phone || undefined,
      pan: values.pan || undefined,
    }
    updateMutation.mutate(payload, {
      onSuccess: () => navigate(`/contacts/${id}`),
    })
  }

  return (
    <PageLayout>
      <PageHeader title={`Edit ${contact.firstName} ${contact.lastName ?? ''}`.trim()} />
      <PageContent>
        <Card>
          <ContactForm
            mode="edit"
            contact={contact}
            onSubmit={handleSubmit}
            isSubmitting={updateMutation.isPending}
            submitError={updateMutation.isError ? normalizeApiError(updateMutation.error).message : undefined}
          />
        </Card>
      </PageContent>
    </PageLayout>
  )
}
