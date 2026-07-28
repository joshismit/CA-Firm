// src/modules/contacts/pages/ContactDetailPage.tsx
import { useParams } from 'react-router-dom'
import { PageLayout, PageContent } from '@/components/page'
import { Spinner, ErrorState } from '@/components/feedback'
import { normalizeApiError } from '@/services/api-error'
import { useContactQuery } from '../hooks'
import {
  ContactHeader,
  ContactOverviewCard,
  ContactInformationCard,
  ContactBusinessCard,
  ContactTimelineCard,
} from '../components'

export function ContactDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: contact, isLoading, isError, error, refetch } = useContactQuery(id!)

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

  return (
    <PageLayout>
      <ContactHeader contact={contact} />

      <PageContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <ContactOverviewCard contact={contact} />
            <ContactInformationCard contact={contact} />
            <ContactBusinessCard contactId={contact.id} />
          </div>
          <div className="space-y-4">
            <ContactTimelineCard contact={contact} />
          </div>
        </div>
      </PageContent>
    </PageLayout>
  )
}
