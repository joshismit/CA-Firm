// src/modules/client-billing/components/ExpenseStatsCards.tsx
// Same real, separately-cached GET+limit=1 pattern as BusinessStatsCards/ProjectStatsCards - except
// every one of these genuinely 501s (no backend module exists yet), so StatCard's existing isError
// branch renders "—" honestly instead of a fabricated number.
import { Receipt, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { StatCard, StatsGrid } from '@/components/shared/StatCard/StatCard'
import { useExpensesQuery } from '../hooks'

export function ExpenseStatsCards() {
  const total = useExpensesQuery({ page: 1, limit: 1 })
  const approved = useExpensesQuery({ page: 1, limit: 1, status: 'APPROVED' })
  const pending = useExpensesQuery({ page: 1, limit: 1, status: 'PENDING' })
  const rejected = useExpensesQuery({ page: 1, limit: 1, status: 'REJECTED' })

  return (
    <StatsGrid>
      <StatCard label="Total Expenses" value={total.data?.meta.total ?? 0} isLoading={total.isLoading} isError={total.isError} icon={Receipt} />
      <StatCard label="Approved" value={approved.data?.meta.total ?? 0} isLoading={approved.isLoading} isError={approved.isError} icon={CheckCircle2} />
      <StatCard label="Pending" value={pending.data?.meta.total ?? 0} isLoading={pending.isLoading} isError={pending.isError} icon={Clock} />
      <StatCard label="Rejected" value={rejected.data?.meta.total ?? 0} isLoading={rejected.isLoading} isError={rejected.isError} icon={XCircle} />
    </StatsGrid>
  )
}
