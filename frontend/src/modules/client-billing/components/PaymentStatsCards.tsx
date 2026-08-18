// src/modules/client-billing/components/PaymentStatsCards.tsx
// Same real, separately-cached GET+limit=1 pattern as BusinessStatsCards/ProjectStatsCards - except
// every one of these genuinely 501s (no backend module exists yet), so StatCard's existing isError
// branch renders "—" honestly instead of a fabricated number.
import { Wallet, CheckCircle2, Clock, RotateCcw } from 'lucide-react'
import { StatCard, StatsGrid } from '@/components/shared/StatCard/StatCard'
import { usePaymentsQuery } from '../hooks'

export function PaymentStatsCards() {
  const total = usePaymentsQuery({ page: 1, limit: 1 })
  const completed = usePaymentsQuery({ page: 1, limit: 1, status: 'COMPLETED' })
  const pending = usePaymentsQuery({ page: 1, limit: 1, status: 'PENDING' })
  const refunded = usePaymentsQuery({ page: 1, limit: 1, status: 'REFUNDED' })

  return (
    <StatsGrid>
      <StatCard label="Total Payments" value={total.data?.meta.total ?? 0} isLoading={total.isLoading} isError={total.isError} icon={Wallet} />
      <StatCard label="Completed" value={completed.data?.meta.total ?? 0} isLoading={completed.isLoading} isError={completed.isError} icon={CheckCircle2} />
      <StatCard label="Pending" value={pending.data?.meta.total ?? 0} isLoading={pending.isLoading} isError={pending.isError} icon={Clock} />
      <StatCard label="Refunded" value={refunded.data?.meta.total ?? 0} isLoading={refunded.isLoading} isError={refunded.isError} icon={RotateCcw} />
    </StatsGrid>
  )
}
