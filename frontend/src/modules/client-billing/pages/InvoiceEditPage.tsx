// src/modules/client-billing/pages/InvoiceEditPage.tsx
// Mirrors BusinessEditPage/ProjectEditPage's loading/error guard exactly - it just never gets past
// the error branch, since getInvoice always 501s (no record can ever be fetched to edit).
import { useParams } from 'react-router-dom'
import { PageLayout, PageContent } from '@/components/page'
import { Spinner, ErrorState } from '@/components/feedback'
import { normalizeApiError } from '@/services/api-error'
import { useInvoiceQuery } from '../hooks'

export function InvoiceEditPage() {
  const { id } = useParams<{ id: string }>()
  const { isLoading, isError, error, refetch } = useInvoiceQuery(id!)

  return (
    <PageLayout>
      <PageContent>
        {isLoading ? (
          <Spinner fullScreen={false} label="Loading invoice…" className="py-16" />
        ) : (
          <ErrorState
            title="Can't edit this invoice"
            message={isError ? normalizeApiError(error).message : "Invoices don't have a backend module yet, so there's no invoice to edit."}
            onRetry={refetch}
          />
        )}
      </PageContent>
    </PageLayout>
  )
}
