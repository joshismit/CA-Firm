// src/modules/client-billing/pages/PaymentEditPage.tsx
// Mirrors BusinessEditPage/ProjectEditPage's loading/error guard exactly - it just never gets past
// the error branch, since getPayment always 501s.
import { useParams } from 'react-router-dom'
import { PageLayout, PageContent } from '@/components/page'
import { Spinner, ErrorState } from '@/components/feedback'
import { normalizeApiError } from '@/services/api-error'
import { usePaymentQuery } from '../hooks'

export function PaymentEditPage() {
  const { id } = useParams<{ id: string }>()
  const { isLoading, isError, error, refetch } = usePaymentQuery(id!)

  return (
    <PageLayout>
      <PageContent>
        {isLoading ? (
          <Spinner fullScreen={false} label="Loading payment…" className="py-16" />
        ) : (
          <ErrorState
            title="Can't edit this payment"
            message={isError ? normalizeApiError(error).message : "Payments don't have a backend module yet, so there's no payment to edit."}
            onRetry={refetch}
          />
        )}
      </PageContent>
    </PageLayout>
  )
}
