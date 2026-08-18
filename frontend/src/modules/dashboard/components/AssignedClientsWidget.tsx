// src/modules/dashboard/components/AssignedClientsWidget.tsx
// PRD §10.1/§10.5 "Assigned Clients" - Clients on the caller's assigned Businesses for STAFF (PRD
// §10.11); unrestricted roles get a tenant-wide total only (no per-user Business filter to list
// against - see DashboardAggregationService.assignedClientsWidget()'s own comment on the backend).
import { Link } from 'react-router-dom'
import { Users } from 'lucide-react'
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { StatusBadge } from '@/components/shared/StatusBadge/StatusBadge'
import { Skeleton, ErrorState, EmptyState } from '@/components/feedback'
import { useDashboardWidgetDataQuery } from '../hooks'
import type { ClientSummaryItem } from '../types'

export function AssignedClientsWidget() {
  const { data, isLoading, isError } = useDashboardWidgetDataQuery(['assigned-clients'], 6)
  const entry = data?.['assigned-clients']
  const items = (entry?.items as ClientSummaryItem[] | undefined) ?? []

  return (
    <Card>
      <CardHeader title="Assigned Clients" action={<span className="text-[11px] text-[var(--color-text-muted)]">{entry?.total ?? 0} total</span>} />
      {isLoading ? (
        <Skeleton variant="table" rows={4} height={32} />
      ) : isError ? (
        <ErrorState message="Couldn't load assigned clients." />
      ) : items.length === 0 ? (
        <EmptyState icon={Users} title="No assigned clients" description="Clients on your assigned businesses will show up here." />
      ) : (
        <ul className="space-y-2">
          {items.map((client) => (
            <li key={client.id}>
              <Link
                to={`/business/${client.businessId}`}
                className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] hover:bg-[var(--color-hover)] transition-colors -mx-1 px-1 py-1.5"
              >
                <span className="text-[12px] font-medium text-[var(--color-text-body)] truncate">{client.businessName ?? 'Unnamed business'}</span>
                <StatusBadge variant={client.status === 'ACTIVE' ? 'success' : 'default'}>{client.status}</StatusBadge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
