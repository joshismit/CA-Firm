// src/modules/compliance/pages/ComplianceEditPage.tsx
// One generic edit page shared by all four Compliance areas. Mirrors BusinessEditPage/
// ProjectEditPage's loading/error guard exactly - it just never gets past the error branch, since
// getComplianceFiling always 501s (no record can ever be fetched to edit).
import { useParams } from 'react-router-dom'
import { PageLayout, PageContent } from '@/components/page'
import { Spinner, ErrorState } from '@/components/feedback'
import { normalizeApiError } from '@/services/api-error'
import { useComplianceFilingQuery } from '../hooks'
import { COMPLIANCE_MODULES } from '../constants'
import type { ComplianceModuleKey } from '../types'

export interface ComplianceEditPageProps {
  moduleKey: ComplianceModuleKey
}

export function ComplianceEditPage({ moduleKey }: ComplianceEditPageProps) {
  const config = COMPLIANCE_MODULES[moduleKey]
  const { id } = useParams<{ id: string }>()
  const { isLoading, isError, error, refetch } = useComplianceFilingQuery(moduleKey, id!)

  return (
    <PageLayout>
      <PageContent>
        {isLoading ? (
          <Spinner fullScreen={false} label={`Loading ${config.singular}…`} className="py-16" />
        ) : (
          <ErrorState
            title={`Can't edit this ${config.singular}`}
            message={
              isError
                ? normalizeApiError(error).message
                : `${config.label} doesn't have a backend module yet, so there's no filing to edit.`
            }
            onRetry={refetch}
          />
        )}
      </PageContent>
    </PageLayout>
  )
}
