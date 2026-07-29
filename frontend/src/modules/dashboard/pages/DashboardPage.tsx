// src/modules/dashboard/pages/DashboardPage.tsx
// Full rewrite: every number on this page now comes from a real, already-existing hook pointed at
// a real endpoint (Business/Contacts/CRM/Projects/Tasks/Documents all have real backends), or is
// an honest, clearly-labeled "not available yet" placeholder (Revenue/Charts/Team Performance/
// Calendar - none of those have any backing data source anywhere in this app). Nothing here is
// hardcoded or fabricated, unlike the previous version's entirely mock KPI/revenue/GST/task data.
import { RefreshCw, Landmark, IdCard, Handshake, Briefcase, LineChart, BarChart3, Users2, CalendarDays } from 'lucide-react'
import { PageLayout, PageHeader, PageContent, PageActions } from '@/components/page'
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { StatCard, StatsGrid } from '@/components/shared/StatCard/StatCard'
import { EmptyState } from '@/components/feedback'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/auth.store'
import { useBusinessesQuery } from '@/modules/business/hooks'
import { useContactsQuery } from '@/modules/contacts/hooks'
import { useLeadsQuery } from '@/modules/crm/hooks'
import { CRMPipelineSummary } from '@/modules/crm/components/CRMPipelineSummary'
import { useProjectsQuery } from '@/modules/projects/hooks'
import {
  RecentActivityWidget,
  TaskSummaryWidget,
  UpcomingDeadlinesWidget,
  RecentDocumentsWidget,
  NotificationsPreviewWidget,
  QuickActionsWidget,
} from '../components'

// CRM's own list page fetches up to this many leads to compute pipeline stats client-side (no
// aggregate endpoint exists) - mirrored here so the dashboard's preview matches that established
// "capped at 100" convention exactly (see CRMListPage.tsx / CRMPipelineSummary.tsx).
const CRM_PIPELINE_FETCH_LIMIT = 100

export function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const today = new Date()

  const businesses = useBusinessesQuery({ page: 1, limit: 1 })
  const contacts = useContactsQuery({ page: 1, limit: 1 })
  const activeLeads = useLeadsQuery({ page: 1, limit: 1 })
  const projects = useProjectsQuery({ page: 1, limit: 1, status: 'ACTIVE' })
  const pipelineQuery = useLeadsQuery({ page: 1, limit: CRM_PIPELINE_FETCH_LIMIT })

  const displayName = user ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email : ''

  return (
    <PageLayout>
      <PageHeader
        title="Dashboard"
        description={`${displayName ? `Good morning, ${displayName}. ` : ''}Here's what's happening today — ${today.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`}
        actions={
          <PageActions>
            <Button variant="secondary" leadingIcon={<RefreshCw className="w-3.5 h-3.5" />} onClick={() => window.location.reload()}>
              Refresh
            </Button>
          </PageActions>
        }
      />

      <PageContent>
        <div className="space-y-4">
          {/* Real KPIs */}
          <StatsGrid>
            <StatCard
              label="Total Businesses"
              value={businesses.data?.meta.total ?? 0}
              isLoading={businesses.isLoading}
              isError={businesses.isError}
              icon={Landmark}
            />
            <StatCard
              label="Total Contacts"
              value={contacts.data?.meta.total ?? 0}
              isLoading={contacts.isLoading}
              isError={contacts.isError}
              icon={IdCard}
            />
            <StatCard
              label="Active Leads"
              value={activeLeads.data?.meta.total ?? 0}
              isLoading={activeLeads.isLoading}
              isError={activeLeads.isError}
              icon={Handshake}
            />
            <StatCard
              label="Active Projects"
              value={projects.data?.meta.total ?? 0}
              isLoading={projects.isLoading}
              isError={projects.isError}
              icon={Briefcase}
            />
          </StatsGrid>

          {/* Recent Activity + Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <RecentActivityWidget />
            </div>
            <QuickActionsWidget />
          </div>

          {/* CRM Pipeline - full width so its 4 StatCards get the same room they have on the CRM
              page itself; squeezing them into a 2/3 column truncated labels like "Weighted Pipeline". */}
          <Card>
            <CardHeader title="CRM Pipeline" />
            <CRMPipelineSummary
              leads={pipelineQuery.data?.data ?? []}
              totalCount={pipelineQuery.data?.meta.total ?? 0}
              isLoading={pipelineQuery.isLoading}
              isError={pipelineQuery.isError}
            />
          </Card>

          {/* Tasks, Deadlines, Documents, Notifications */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <TaskSummaryWidget />
            <UpcomingDeadlinesWidget />
            <RecentDocumentsWidget />
            <NotificationsPreviewWidget />
          </div>

          {/* Honest placeholders - no backend exists for any of these yet */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader title="Revenue" />
              <EmptyState
                icon={LineChart}
                title="Not available yet"
                description="Revenue tracking needs a billing backend, which doesn't exist yet - see the Client Billing module."
              />
            </Card>
            <Card>
              <CardHeader title="Trends" />
              <EmptyState
                icon={BarChart3}
                title="Not available yet"
                description="Trend charts need historical data the backend doesn't track yet."
              />
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader title="Team Performance" />
              <EmptyState
                icon={Users2}
                title="Not available yet"
                description="Per-staff workload and completion analytics need a reporting backend that doesn't exist yet."
              />
            </Card>
            <Card>
              <CardHeader title="Calendar" />
              <EmptyState
                icon={CalendarDays}
                title="Not available yet"
                description="A shared firm calendar needs a scheduling backend that doesn't exist yet."
              />
            </Card>
          </div>
        </div>
      </PageContent>
    </PageLayout>
  )
}
