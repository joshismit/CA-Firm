// src/modules/dashboard/components/PaymentRemindersWidget.tsx
// PRD §10.1/§10.5 "Payment Reminders" - invoices that are SENT (or, once the billing module's
// status-transition gap closes, OVERDUE - see DashboardAggregationService's own header comment on
// the backend for why OVERDUE never appears yet), scoped to the caller's assigned Businesses for
// STAFF (PRD §10.11).
import { Link } from 'react-router-dom'
import { BellRing } from 'lucide-react'
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { StatusBadge } from '@/components/shared/StatusBadge/StatusBadge'
import { Skeleton, ErrorState, EmptyState } from '@/components/feedback'
import { formatDate, formatINR } from '@/lib/utils'
import { useDashboardWidgetDataQuery } from '../hooks'
import type { InvoiceSummaryItem } from '../types'

export function PaymentRemindersWidget() {
  const { data, isLoading, isError } = useDashboardWidgetDataQuery(['payment-reminders'], 6)
  const entry = data?.['payment-reminders']
  const items = (entry?.items as InvoiceSummaryItem[] | undefined) ?? []

  return (
    <Card>
      <CardHeader title="Payment Reminders" action={<BellRing className="w-4 h-4 text-[var(--color-warning)]" />} />
      {isLoading ? (
        <Skeleton variant="table" rows={4} height={32} />
      ) : isError ? (
        <ErrorState message="Couldn't load payment reminders." />
      ) : items.length === 0 ? (
        <EmptyState title="No reminders" description="Sent invoices awaiting payment will show up here." />
      ) : (
        <ul className="space-y-2">
          {items.map((invoice) => (
            <li key={invoice.id}>
              <Link
                to={`/billing/invoices/${invoice.id}`}
                className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] hover:bg-[var(--color-hover)] transition-colors -mx-1 px-1 py-1.5"
              >
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-[var(--color-text-body)] truncate">{invoice.invoiceNumber}</p>
                  {invoice.businessName && <p className="text-[10px] text-[var(--color-text-muted)] truncate">{invoice.businessName}</p>}
                </div>
                <span className="flex items-center gap-2 shrink-0">
                  {invoice.dueDate && <span className="text-[11px] text-[var(--color-text-muted)]">{formatDate(invoice.dueDate)}</span>}
                  <StatusBadge variant={invoice.status === 'OVERDUE' ? 'danger' : 'warning'}>{invoice.status}</StatusBadge>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {entry?.totalAmount != null && items.length > 0 && (
        <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">Total outstanding: {formatINR(entry.totalAmount)}</p>
      )}
    </Card>
  )
}
