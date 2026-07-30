// src/modules/client-portal/pages/ClientPortalHomePage.tsx
// Landing page for the external /portal shell - overview stats wired to the portal-summary stub.
// Rendered inside ClientPortalLayout's own minimal header, so no PageHeader actions row is needed.
import { Link } from 'react-router-dom'
import { ArrowRight, FileText } from 'lucide-react'
import { PageLayout, PageHeader, PageContent } from '@/components/page'
import { Card } from '@/components/shared/Card/Card'
import { StatCard, StatsGrid } from '@/components/shared/StatCard/StatCard'
import { usePortalSummaryQuery } from '../hooks'

export function ClientPortalHomePage() {
  const { data, isLoading, isError } = usePortalSummaryQuery()

  return (
    <PageLayout>
      <PageHeader title="Welcome" description="Documents and updates shared with you by your firm." />
      <PageContent>
        <StatsGrid>
          <StatCard
            label="Documents Shared"
            value={data?.documentsSharedCount ?? 0}
            isLoading={isLoading}
            isError={isError}
            icon={FileText}
          />
          <StatCard
            label="Pending Signatures"
            value={data?.pendingSignaturesCount ?? 0}
            isLoading={isLoading}
            isError={isError}
          />
        </StatsGrid>

        <Link to="/portal/documents" className="block">
          <Card className="hover:border-[var(--color-primary-300)] hover:shadow-[var(--shadow-md)] transition-all">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--color-primary-50)] flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-[var(--color-primary-600)]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[14px] font-semibold text-[var(--color-text-heading)]">My Documents</h3>
                <p className="text-[12px] text-[var(--color-text-muted)]">View documents your firm has shared with you.</p>
              </div>
              <ArrowRight className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
            </div>
          </Card>
        </Link>
      </PageContent>
    </PageLayout>
  )
}
