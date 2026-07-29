// src/modules/notifications/components/NotificationStatsCards.tsx
// Same real, separately-cached GET+limit=1 pattern as BusinessStatsCards/InvoiceStatsCards -
// except every one of these genuinely 501s (no backend module exists yet), so StatCard's existing
// isError branch renders "—" honestly instead of a fabricated number.
import { Bell, MailOpen, CheckCircle2, AlertTriangle } from 'lucide-react'
import { StatCard, StatsGrid } from '@/components/shared/StatCard/StatCard'
import { useNotificationsQuery } from '../hooks'

export function NotificationStatsCards() {
  const total = useNotificationsQuery({ page: 1, limit: 1 })
  const unread = useNotificationsQuery({ page: 1, limit: 1, unreadOnly: true })
  const delivered = useNotificationsQuery({ page: 1, limit: 1, status: 'DELIVERED' })
  const failed = useNotificationsQuery({ page: 1, limit: 1, status: 'FAILED' })

  return (
    <StatsGrid>
      <StatCard label="Total Notifications" value={total.data?.meta.total ?? 0} isLoading={total.isLoading} isError={total.isError} icon={Bell} />
      <StatCard label="Unread" value={unread.data?.meta.total ?? 0} isLoading={unread.isLoading} isError={unread.isError} icon={MailOpen} />
      <StatCard label="Delivered" value={delivered.data?.meta.total ?? 0} isLoading={delivered.isLoading} isError={delivered.isError} icon={CheckCircle2} />
      <StatCard label="Failed" value={failed.data?.meta.total ?? 0} isLoading={failed.isLoading} isError={failed.isError} icon={AlertTriangle} />
    </StatsGrid>
  )
}
