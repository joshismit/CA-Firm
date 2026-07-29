// src/modules/client-billing/pages/PaymentCreatePage.tsx
// The form is fully real and client-side validated, but submitting genuinely calls the
// (currently-stubbed) create API - never a fake success.
import { PageLayout, PageHeader, PageContent } from '@/components/page'
import { Card } from '@/components/shared/Card/Card'
import { normalizeApiError } from '@/services/api-error'
import { useCreatePaymentMutation } from '../hooks'
import { PaymentForm } from '../components'
import type { CreatePaymentFormValues } from '../schemas'
import type { CreatePaymentPayload } from '../types'

export function PaymentCreatePage() {
  const createMutation = useCreatePaymentMutation()

  const handleSubmit = (values: CreatePaymentFormValues) => {
    const payload: CreatePaymentPayload = {
      paymentNumber: values.paymentNumber,
      invoiceId: values.invoiceId || undefined,
      amount: values.amount,
      method: values.method || undefined,
      reference: values.reference || undefined,
      paidDate: values.paidDate ? values.paidDate.toISOString() : undefined,
      notes: values.notes || undefined,
    }
    createMutation.mutate(payload)
  }

  return (
    <PageLayout>
      <PageHeader title="New Payment" description="Record a payment received from a client." />
      <PageContent>
        <Card>
          <PaymentForm
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
