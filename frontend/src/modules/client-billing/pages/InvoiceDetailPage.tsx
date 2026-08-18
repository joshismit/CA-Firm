// src/modules/client-billing/pages/InvoiceDetailPage.tsx
// getInvoice always 501s (no backend module exists), so there is never a real record to build an
// Overview/Timeline/Notes/Attachments/Quick Actions layout around - showing empty card husks with
// no subject would be hollower than one clear, honest ErrorState naming exactly what's missing and
// what this page will show once it exists (same reasoning as ComplianceDetailPage).
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { PageLayout, PageContent } from '@/components/page'
import { Spinner, ErrorState } from '@/components/feedback'
import { normalizeApiError } from '@/services/api-error'
import { useInvoiceQuery } from '../hooks'

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { isLoading, isError, error, refetch } = useInvoiceQuery(id!)

  return (
    <PageLayout>
      <Link
        to="/billing/invoices"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-body)] mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Invoices
      </Link>

      <PageContent>
        {isLoading ? (
          <Spinner fullScreen={false} label="Loading invoice…" className="py-16" />
        ) : (
          <ErrorState
            title="This invoice isn't available"
            message={
              isError
                ? normalizeApiError(error).message
                : "Invoices don't have a backend module yet, so individual invoices can't be loaded. Once it exists, this page will show the invoice's line items, tax breakdown, payment history, attachments, and quick actions."
            }
            onRetry={refetch}
          />
        )}
      </PageContent>
    </PageLayout>
  )
}
