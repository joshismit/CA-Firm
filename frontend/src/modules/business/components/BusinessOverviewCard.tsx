// src/modules/business/components/BusinessOverviewCard.tsx
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { formatDate } from '@/lib/utils'
import { BusinessStatusBadge } from './BusinessStatusBadge'
import type { Business } from '../types'

const MONTH_NAMES = [
  '',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export interface BusinessOverviewCardProps {
  business: Business
}

export function BusinessOverviewCard({ business }: BusinessOverviewCardProps) {
  return (
    <Card>
      <CardHeader title="Overview" />
      <dl className="grid grid-cols-2 gap-4 text-[13px]">
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Status</dt>
          <dd className="mt-1">
            <BusinessStatusBadge status={business.status} />
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Industry</dt>
          <dd className="mt-0.5 text-[var(--color-text-body)]">{business.industry ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Incorporated</dt>
          <dd className="mt-0.5 text-[var(--color-text-body)]">
            {business.incorporationDate ? formatDate(business.incorporationDate) : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Financial Year Start</dt>
          <dd className="mt-0.5 text-[var(--color-text-body)]">{MONTH_NAMES[business.financialYearStart] ?? '—'}</dd>
        </div>
      </dl>
    </Card>
  )
}
