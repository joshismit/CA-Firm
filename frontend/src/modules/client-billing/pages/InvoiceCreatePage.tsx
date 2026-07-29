// src/modules/client-billing/pages/InvoiceCreatePage.tsx
// The form is fully real and client-side validated, but submitting genuinely calls the
// (currently-stubbed) create API - the user sees the real "not available yet" error in the same
// submitError slot BusinessCreatePage/ProjectCreatePage already use, never a fake success.
import { PageLayout, PageHeader, PageContent } from '@/components/page'
import { Card } from '@/components/shared/Card/Card'
import { normalizeApiError } from '@/services/api-error'
import { useCreateInvoiceMutation } from '../hooks'
import { InvoiceForm } from '../components'
import type { CreateInvoiceFormValues } from '../schemas'
import type { CreateInvoicePayload } from '../types'

export function InvoiceCreatePage() {
  const createMutation = useCreateInvoiceMutation()

  const handleSubmit = (values: CreateInvoiceFormValues) => {
    const payload: CreateInvoicePayload = {
      invoiceNumber: values.invoiceNumber,
      clientId: values.clientId || undefined,
      businessId: values.businessId || undefined,
      amount: values.amount,
      tax: values.tax,
      dueDate: values.dueDate ? values.dueDate.toISOString() : undefined,
      notes: values.notes || undefined,
    }
    createMutation.mutate(payload)
  }

  return (
    <PageLayout>
      <PageHeader title="New Invoice" description="Record a new invoice for a client." />
      <PageContent>
        <Card>
          <InvoiceForm
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
