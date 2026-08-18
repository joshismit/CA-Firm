// src/modules/client-billing/pages/PaymentDetailPage.tsx
// getPayment always 501s (no backend module exists) - same reasoning as InvoiceDetailPage.
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { PageLayout, PageContent } from '@/components/page'
import { Spinner, ErrorState } from '@/components/feedback'
import { normalizeApiError } from '@/services/api-error'
import { usePaymentQuery } from '../hooks'

export function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { isLoading, isError, error, refetch } = usePaymentQuery(id!)

  return (
    <PageLayout>
      <Link
        to="/billing/payments"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-body)] mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Payments
      </Link>

      <PageContent>
        {isLoading ? (
          <Spinner fullScreen={false} label="Loading payment…" className="py-16" />
        ) : (
          <ErrorState
            title="This payment isn't available"
            message={
              isError
                ? normalizeApiError(error).message
                : "Payments don't have a backend module yet, so individual payments can't be loaded. Once it exists, this page will show the linked invoice, payment method, reference details, and quick actions."
            }
            onRetry={refetch}
          />
        )}
      </PageContent>
    </PageLayout>
  )
}
