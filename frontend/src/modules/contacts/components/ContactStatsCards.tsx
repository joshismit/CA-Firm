// src/modules/contacts/components/ContactStatsCards.tsx
// Real count, not fabricated: `meta.total` from a real GET /contacts call (limit=1). Contact has no
// status enum and ContactListFilters exposes only `businessId`/`search` beyond pagination (see
// backend/src/modules/contacts/schemas/contact.schema.ts) - so unlike Business's per-status
// breakdown, there is no second real dimension to slice this by without a raw client-side scan of
// every contact, which would misrepresent tenant-wide totals as soon as pagination kicks in.
import { Users } from 'lucide-react'
import { StatCard, StatsGrid } from '@/components/shared/StatCard/StatCard'
import { useContactsQuery } from '../hooks'

export function ContactStatsCards() {
  const total = useContactsQuery({ page: 1, limit: 1 })

  return (
    <StatsGrid>
      <StatCard
        label="Total Contacts"
        value={total.data?.meta.total ?? 0}
        isLoading={total.isLoading}
        isError={total.isError}
        icon={Users}
      />
    </StatsGrid>
  )
}
