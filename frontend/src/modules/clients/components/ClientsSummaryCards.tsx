// src/modules/clients/components/ClientsSummaryCards.tsx
// Cross-domain summary row for the "All Clients" hub - composes real counts from the Business and
// Contacts APIs (each a real GET call with limit=1, same `meta.total`-only pattern as
// BusinessStatsCards/ContactStatsCards) rather than a new aggregate endpoint. This is a distinct
// card set from BusinessStatsCards/ContactStatsCards (different labels, mixes both domains), not a
// duplicate of either.
//
// "Portal Users" has no backing query: ContactListFilters/the backend's listContactsQuerySchema
// expose only `search`/`businessId` beyond pagination - there is no portal-access filter to ask the
// API for a real total. Scanning every contact page client-side to count `portalUserId` would
// silently over-fetch and, per ContactStatsCards' own documented reasoning, "misrepresent
// tenant-wide totals" the moment the list is large enough to paginate. So this tile is left
// honestly unavailable (dash + hint) rather than showing a fabricated or partial number.
import { Building2, CheckCircle2, Users, KeyRound } from 'lucide-react'
import { StatCard, StatsGrid } from '@/components/shared/StatCard/StatCard'
import { useBusinessesQuery } from '@/modules/business/hooks'
import { useContactsQuery } from '@/modules/contacts/hooks'

export function ClientsSummaryCards() {
  const totalBusinesses = useBusinessesQuery({ page: 1, limit: 1 })
  const activeBusinesses = useBusinessesQuery({ page: 1, limit: 1, status: 'ACTIVE' })
  const totalContacts = useContactsQuery({ page: 1, limit: 1 })

  return (
    <StatsGrid>
      <StatCard
        label="Total Businesses"
        value={totalBusinesses.data?.meta.total ?? 0}
        isLoading={totalBusinesses.isLoading}
        isError={totalBusinesses.isError}
        icon={Building2}
      />
      <StatCard
        label="Active Businesses"
        value={activeBusinesses.data?.meta.total ?? 0}
        isLoading={activeBusinesses.isLoading}
        isError={activeBusinesses.isError}
        icon={CheckCircle2}
      />
      <StatCard
        label="Total Contacts"
        value={totalContacts.data?.meta.total ?? 0}
        isLoading={totalContacts.isLoading}
        isError={totalContacts.isError}
        icon={Users}
      />
      <StatCard
        label="Portal Users"
        value="—"
        hint="No portal-access filter in the Contacts API yet"
        icon={KeyRound}
      />
    </StatsGrid>
  )
}
