// src/modules/client-billing/pages/ExpenseEditPage.tsx
// Mirrors BusinessEditPage/ProjectEditPage's loading/error guard exactly - it just never gets past
// the error branch, since getExpense always 501s.
import { useParams } from 'react-router-dom'
import { PageLayout, PageContent } from '@/components/page'
import { Spinner, ErrorState } from '@/components/feedback'
import { normalizeApiError } from '@/services/api-error'
import { useExpenseQuery } from '../hooks'

export function ExpenseEditPage() {
  const { id } = useParams<{ id: string }>()
  const { isLoading, isError, error, refetch } = useExpenseQuery(id!)

  return (
    <PageLayout>
      <PageContent>
        {isLoading ? (
          <Spinner fullScreen={false} label="Loading expense…" className="py-16" />
        ) : (
          <ErrorState
            title="Can't edit this expense"
            message={isError ? normalizeApiError(error).message : "Expenses don't have a backend module yet, so there's no expense to edit."}
            onRetry={refetch}
          />
        )}
      </PageContent>
    </PageLayout>
  )
}
