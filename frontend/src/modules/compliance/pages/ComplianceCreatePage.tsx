// src/modules/compliance/pages/ComplianceCreatePage.tsx
// One generic create page shared by all four Compliance areas. The form is fully real and
// client-side validated, but submitting genuinely calls the (currently-stubbed) create API - the
// user sees the real "not available yet" error in the same submitError slot BusinessCreatePage/
// ProjectCreatePage already use, never a fake success or a silently-discarded submission.
import { PageLayout, PageHeader, PageContent } from '@/components/page'
import { Card } from '@/components/shared/Card/Card'
import { normalizeApiError } from '@/services/api-error'
import { useCreateComplianceFilingMutation } from '../hooks'
import { ComplianceFilingForm } from '../components'
import { COMPLIANCE_MODULES } from '../constants'
import type { CreateComplianceFilingFormValues } from '../schemas'
import type { ComplianceModuleKey, CreateComplianceFilingPayload } from '../types'

export interface ComplianceCreatePageProps {
  moduleKey: ComplianceModuleKey
}

export function ComplianceCreatePage({ moduleKey }: ComplianceCreatePageProps) {
  const config = COMPLIANCE_MODULES[moduleKey]
  const createMutation = useCreateComplianceFilingMutation(moduleKey)

  const handleSubmit = (values: CreateComplianceFilingFormValues) => {
    const payload: CreateComplianceFilingPayload = {
      reference: values.reference,
      period: values.period,
      dueDate: values.dueDate ? values.dueDate.toISOString() : undefined,
      notes: values.notes || undefined,
    }
    createMutation.mutate(payload)
  }

  return (
    <PageLayout>
      <PageHeader title={`New ${config.singular}`} description="Record a new filing for this compliance area." />
      <PageContent>
        <Card>
          <ComplianceFilingForm
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
