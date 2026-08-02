// src/modules/dashboard/components/KpiStatsWidget.tsx
// Extracted from DashboardPage.tsx's former inline StatsGrid block so it can be a single,
// independently show/hide-able entry in the widget registry (see ../constants) - same real
// KPI queries as before, no behavior change.
import { Landmark, IdCard, Handshake, Briefcase } from 'lucide-react'
import { StatCard, StatsGrid } from '@/components/shared/StatCard/StatCard'
import { useBusinessesQuery } from '@/modules/business/hooks'
import { useContactsQuery } from '@/modules/contacts/hooks'
import { useLeadsQuery } from '@/modules/crm/hooks'
import { useProjectsQuery } from '@/modules/projects/hooks'

export function KpiStatsWidget() {
  const businesses = useBusinessesQuery({ page: 1, limit: 1 })
  const contacts = useContactsQuery({ page: 1, limit: 1 })
  const activeLeads = useLeadsQuery({ page: 1, limit: 1 })
  const projects = useProjectsQuery({ page: 1, limit: 1, status: 'ACTIVE' })

  return (
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
  )
}
