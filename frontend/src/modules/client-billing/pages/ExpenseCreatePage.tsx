// src/modules/client-billing/pages/ExpenseCreatePage.tsx
// The form is fully real and client-side validated, but submitting genuinely calls the
// (currently-stubbed) create API - never a fake success.
import { PageLayout, PageHeader, PageContent } from '@/components/page'
import { Card } from '@/components/shared/Card/Card'
import { normalizeApiError } from '@/services/api-error'
import { useCreateExpenseMutation } from '../hooks'
import { ExpenseForm } from '../components'
import type { CreateExpenseFormValues } from '../schemas'
import type { CreateExpensePayload } from '../types'

export function ExpenseCreatePage() {
  const createMutation = useCreateExpenseMutation()

  const handleSubmit = (values: CreateExpenseFormValues) => {
    const payload: CreateExpensePayload = {
      expenseNumber: values.expenseNumber,
      category: values.category,
      vendor: values.vendor || undefined,
      amount: values.amount,
      date: values.date ? values.date.toISOString() : undefined,
      paymentMethod: values.paymentMethod || undefined,
      notes: values.notes || undefined,
    }
    createMutation.mutate(payload)
  }

  return (
    <PageLayout>
      <PageHeader title="New Expense" description="Record a new expense for the firm." />
      <PageContent>
        <Card>
          <ExpenseForm
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
