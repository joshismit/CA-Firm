// src/modules/dashboard/pages/AnalyticsPage.tsx
// Upgraded from a static FeatureUnavailable screen to match how every other stub module looks
// (Compliance/Reports/Master Admin): a full UI - stat cards + charts - wired to a genuinely
// 501-ing API (api/index.ts), with StatCard/ErrorState honestly surfacing "not available yet"
// instead of a fabricated number or chart. ChartCard and the recharts wrappers (components/charts)
// exist already but were unused anywhere in the app until now.
import { DollarSign, Users, FileClock } from 'lucide-react'
import { PageLayout, PageHeader, PageContent } from '@/components/page'
import { StatCard, StatsGrid } from '@/components/shared/StatCard/StatCard'
import { ErrorState, Skeleton } from '@/components/feedback'
import { AreaChart, BarChart } from '@/components/charts'
import { ChartCard } from '../components'
import { normalizeApiError } from '@/services/api-error'
import { useAnalyticsSummaryQuery, useClientGrowthTrendQuery, useRevenueTrendQuery } from '../hooks'
import type { AnalyticsFilters } from '../types'

const NO_FILTERS: AnalyticsFilters = {}

export function AnalyticsPage() {
  const summary = useAnalyticsSummaryQuery(NO_FILTERS)
  const revenueTrend = useRevenueTrendQuery(NO_FILTERS)
  const clientGrowth = useClientGrowthTrendQuery(NO_FILTERS)

  return (
    <PageLayout>
      <PageHeader title="Analytics" description="Revenue, filings, and client-growth trends across your firm." />
      <PageContent>
        <StatsGrid>
          <StatCard
            label="Total Revenue"
            value={summary.data ? `₹${summary.data.totalRevenue.toLocaleString('en-IN')}` : 0}
            isLoading={summary.isLoading}
            isError={summary.isError}
            icon={DollarSign}
          />
          <StatCard
            label="Active Clients"
            value={summary.data?.activeClients ?? 0}
            isLoading={summary.isLoading}
            isError={summary.isError}
            icon={Users}
          />
          <StatCard
            label="Pending Filings"
            value={summary.data?.pendingFilings ?? 0}
            isLoading={summary.isLoading}
            isError={summary.isError}
            icon={FileClock}
          />
        </StatsGrid>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Revenue vs Collections">
            {revenueTrend.isLoading ? (
              <Skeleton height={200} />
            ) : revenueTrend.isError ? (
              <ErrorState
                title="Not available yet"
                message={normalizeApiError(revenueTrend.error).message}
                onRetry={revenueTrend.refetch}
              />
            ) : (
              <AreaChart
                data={revenueTrend.data ?? []}
                xKey="month"
                series={[
                  { key: 'revenue', name: 'Revenue', color: 'var(--color-primary-600)' },
                  { key: 'collections', name: 'Collections', color: 'var(--color-success)' },
                ]}
              />
            )}
          </ChartCard>

          <ChartCard title="Client Growth">
            {clientGrowth.isLoading ? (
              <Skeleton height={200} />
            ) : clientGrowth.isError ? (
              <ErrorState
                title="Not available yet"
                message={normalizeApiError(clientGrowth.error).message}
                onRetry={clientGrowth.refetch}
              />
            ) : (
              <BarChart data={clientGrowth.data ?? []} dataKey="newClients" xKey="month" height={200} />
            )}
          </ChartCard>
        </div>
      </PageContent>
    </PageLayout>
  )
}
