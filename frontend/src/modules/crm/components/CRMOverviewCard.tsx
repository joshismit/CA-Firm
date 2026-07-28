// src/modules/crm/components/CRMOverviewCard.tsx
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { formatCompactINR, formatDate } from '@/lib/utils'
import { CRMStatusBadge } from './CRMStatusBadge'
import type { Lead } from '../types'

export interface CRMOverviewCardProps {
  lead: Lead
  stageName: string | undefined
}

export function CRMOverviewCard({ lead, stageName }: CRMOverviewCardProps) {
  return (
    <Card>
      <CardHeader title="Overview" />
      <dl className="grid grid-cols-2 gap-4 text-[13px]">
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Stage</dt>
          <dd className="mt-1">
            <CRMStatusBadge stageName={stageName} />
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Expected Revenue</dt>
          <dd className="mt-0.5 text-[var(--color-text-body)] font-mono">
            {lead.expectedRevenue != null ? formatCompactINR(lead.expectedRevenue) : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Probability</dt>
          <dd className="mt-0.5 text-[var(--color-text-body)]">{lead.probability != null ? `${lead.probability}%` : '—'}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Expected Close</dt>
          <dd className="mt-0.5 text-[var(--color-text-body)]">
            {lead.expectedCloseDate ? formatDate(lead.expectedCloseDate) : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Contact ID</dt>
          <dd className="mt-0.5 text-[var(--color-text-body)] font-mono text-[12px]">{lead.contactId ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Created</dt>
          <dd className="mt-0.5 text-[var(--color-text-body)]">{formatDate(lead.createdAt)}</dd>
        </div>
      </dl>
    </Card>
  )
}
