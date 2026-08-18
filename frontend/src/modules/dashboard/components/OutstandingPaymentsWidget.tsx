// src/modules/dashboard/components/OutstandingPaymentsWidget.tsx
// PRD §10.1/§10.5/§10.7 "Outstanding Payments" - amount + count come straight from the backend's
// InvoiceRepository.sumAmountByStatus() aggregate (never computed client-side, PRD §10.7). Known
// limitation: InvoiceStatus.OVERDUE is never set by any write path in this codebase yet, so this
// only ever reflects SENT invoices today - see the backend service's own header comment.
import { Link } from 'react-router-dom'
import { Wallet } from 'lucide-react'
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { StatusBadge } from '@/components/shared/StatusBadge/StatusBadge'
import { Skeleton, ErrorState, EmptyState } from '@/components/feedback'
import { formatDate, formatINR } from '@/lib/utils'
import { useDashboardWidgetDataQuery } from '../hooks'
import type { InvoiceSummaryItem } from '../types'

export function OutstandingPaymentsWidget() {
  const { data, isLoading, isError } = useDashboardWidgetDataQuery(['outstanding-payments'], 6)
  const entry = data?.['outstanding-payments']
  const items = (entry?.items as InvoiceSummaryItem[] | undefined) ?? []

  return (
    <Card>
      <CardHeader
        title="Outstanding Payments"
        action={<Wallet className="w-4 h-4 text-[var(--color-text-muted)]" />}
      />
      {isLoading ? (
        <Skeleton variant="table" rows={4} height={32} />
      ) : isError ? (
        <ErrorState message="Couldn't load outstanding payments." />
      ) : items.length === 0 ? (
        <EmptyState title="Nothing outstanding" description="Sent invoices not yet paid will show up here." />
      ) : (
        <>
          <p className="mb-3 text-[20px] font-semibold text-[var(--color-text-body)]">{formatINR(entry?.totalAmount ?? 0)}</p>
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
                    <span className="text-[11px] font-medium text-[var(--color-text-body)]">{formatINR(invoice.amount)}</span>
                    {invoice.dueDate && <span className="text-[10px] text-[var(--color-text-muted)]">{formatDate(invoice.dueDate)}</span>}
                    <StatusBadge variant={invoice.status === 'OVERDUE' ? 'danger' : 'warning'}>{invoice.status}</StatusBadge>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  )
}
