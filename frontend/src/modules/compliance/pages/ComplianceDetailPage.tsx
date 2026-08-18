// src/modules/compliance/pages/ComplianceDetailPage.tsx
// One generic detail page shared by all four Compliance areas. getComplianceFiling always 501s (no
// backend module exists), so there is never a real record to build an Overview/Timeline/Notes/
// Documents/Activity/Quick Actions layout around - showing empty card husks with no subject would
// be hollower than one clear, honest ErrorState explaining exactly what's missing and what this
// page will show once it exists. See the module's final report for the full reasoning.
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { PageLayout, PageContent } from '@/components/page'
import { Spinner, ErrorState } from '@/components/feedback'
import { normalizeApiError } from '@/services/api-error'
import { useComplianceFilingQuery } from '../hooks'
import { COMPLIANCE_MODULES } from '../constants'
import type { ComplianceModuleKey } from '../types'

export interface ComplianceDetailPageProps {
  moduleKey: ComplianceModuleKey
}

export function ComplianceDetailPage({ moduleKey }: ComplianceDetailPageProps) {
  const config = COMPLIANCE_MODULES[moduleKey]
  const { id } = useParams<{ id: string }>()
  const { isLoading, isError, error, refetch } = useComplianceFilingQuery(moduleKey, id!)

  return (
    <PageLayout>
      <Link
        to={`/${config.path}`}
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-body)] mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to {config.label}
      </Link>

      <PageContent>
        {isLoading ? (
          <Spinner fullScreen={false} label={`Loading ${config.singular}…`} className="py-16" />
        ) : (
          <ErrorState
            title={`This ${config.singular} isn't available`}
            message={
              isError
                ? normalizeApiError(error).message
                : `${config.label} doesn't have a backend module yet, so individual filings can't be loaded. Once it exists, this page will show Overview, Timeline, Notes, Documents, Activity, and Quick Actions for this filing.`
            }
            onRetry={refetch}
          />
        )}
      </PageContent>
    </PageLayout>
  )
}
