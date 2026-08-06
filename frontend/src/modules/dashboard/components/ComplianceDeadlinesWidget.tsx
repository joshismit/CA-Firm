// src/modules/dashboard/components/ComplianceDeadlinesWidget.tsx
// PRD §10.1/§10.5 "Compliance Deadlines" - tenant-wide for every role (ComplianceFiling has no
// assignee/business column to scope by - a deliberate backend limitation, not a bug here, see
// DashboardAggregationService's own header comment).
import { Link } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { StatusBadge } from '@/components/shared/StatusBadge/StatusBadge'
import { Skeleton, ErrorState, EmptyState } from '@/components/feedback'
import { formatDate } from '@/lib/utils'
import { useDashboardWidgetDataQuery } from '../hooks'
import type { ComplianceFilingSummaryItem } from '../types'

export function ComplianceDeadlinesWidget() {
  const { data, isLoading, isError } = useDashboardWidgetDataQuery(['compliance-deadlines'], 6)
  const entry = data?.['compliance-deadlines']
  const items = (entry?.items as ComplianceFilingSummaryItem[] | undefined) ?? []

  return (
    <Card>
      <CardHeader title="Compliance Deadlines" action={<ShieldAlert className="w-4 h-4 text-[var(--color-text-muted)]" />} />
      {isLoading ? (
        <Skeleton variant="table" rows={4} height={32} />
      ) : isError ? (
        <ErrorState message="Couldn't load compliance deadlines." />
      ) : items.length === 0 ? (
        <EmptyState title="No pending filings" description="GST, ITR, TDS, and MCA filings not yet filed will show up here." />
      ) : (
        <ul className="space-y-2">
          {items.map((filing) => (
            <li key={filing.id}>
              <Link
                to={`/${filing.category.toLowerCase()}/${filing.id}`}
                className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] hover:bg-[var(--color-hover)] transition-colors -mx-1 px-1 py-1.5"
              >
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-[var(--color-text-body)] truncate">
                    {filing.category} — {filing.reference}
                  </p>
                  <p className="text-[10px] text-[var(--color-text-muted)] truncate">{filing.period}</p>
                </div>
                <span className="flex items-center gap-2 shrink-0">
                  {filing.dueDate && <span className="text-[11px] text-[var(--color-text-muted)]">{formatDate(filing.dueDate)}</span>}
                  <StatusBadge variant={filing.status === 'OVERDUE' ? 'danger' : 'default'}>{filing.status}</StatusBadge>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
