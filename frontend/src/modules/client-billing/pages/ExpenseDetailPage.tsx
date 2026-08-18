// src/modules/client-billing/pages/ExpenseDetailPage.tsx
// getExpense always 501s (no backend module exists) - same reasoning as InvoiceDetailPage.
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { PageLayout, PageContent } from '@/components/page'
import { Spinner, ErrorState } from '@/components/feedback'
import { normalizeApiError } from '@/services/api-error'
import { useExpenseQuery } from '../hooks'

export function ExpenseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { isLoading, isError, error, refetch } = useExpenseQuery(id!)

  return (
    <PageLayout>
      <Link
        to="/billing/expenses"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-body)] mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Expenses
      </Link>

      <PageContent>
        {isLoading ? (
          <Spinner fullScreen={false} label="Loading expense…" className="py-16" />
        ) : (
          <ErrorState
            title="This expense isn't available"
            message={
              isError
                ? normalizeApiError(error).message
                : "Expenses don't have a backend module yet, so individual expenses can't be loaded. Once it exists, this page will show the expense's category, vendor, receipt attachments, approval history, and quick actions."
            }
            onRetry={refetch}
          />
        )}
      </PageContent>
    </PageLayout>
  )
}
