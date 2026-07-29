// src/modules/client-billing/components/InvoiceStatsCards.tsx
// Same real, separately-cached GET+limit=1 pattern as BusinessStatsCards/ProjectStatsCards - except
// every one of these genuinely 501s (no backend module exists yet), so StatCard's existing isError
// branch renders "—" honestly instead of a fabricated number.
import { FileText, CheckCircle2, Send, AlertTriangle } from 'lucide-react'
import { StatCard, StatsGrid } from '@/components/shared/StatCard/StatCard'
import { useInvoicesQuery } from '../hooks'

export function InvoiceStatsCards() {
  const total = useInvoicesQuery({ page: 1, limit: 1 })
  const paid = useInvoicesQuery({ page: 1, limit: 1, status: 'PAID' })
  const sent = useInvoicesQuery({ page: 1, limit: 1, status: 'SENT' })
  const overdue = useInvoicesQuery({ page: 1, limit: 1, status: 'OVERDUE' })

  return (
    <StatsGrid>
      <StatCard label="Total Invoices" value={total.data?.meta.total ?? 0} isLoading={total.isLoading} isError={total.isError} icon={FileText} />
      <StatCard label="Paid" value={paid.data?.meta.total ?? 0} isLoading={paid.isLoading} isError={paid.isError} icon={CheckCircle2} />
      <StatCard label="Sent" value={sent.data?.meta.total ?? 0} isLoading={sent.isLoading} isError={sent.isError} icon={Send} />
      <StatCard label="Overdue" value={overdue.data?.meta.total ?? 0} isLoading={overdue.isLoading} isError={overdue.isError} icon={AlertTriangle} />
    </StatsGrid>
  )
}
