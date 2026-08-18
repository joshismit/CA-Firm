// src/modules/client-billing/components/PaymentTableColumns.tsx
// Column definitions consumed by the shared DataTable - no table-rendering logic lives here.
import type { ColumnDef } from '@tanstack/react-table'
import { formatDate, formatINR } from '@/lib/utils'
import { PaymentStatusBadge } from './PaymentStatusBadge'
import { PAYMENT_METHOD_OPTIONS } from '../constants'
import type { Payment } from '../types'

const METHOD_LABELS: Record<string, string> = Object.fromEntries(PAYMENT_METHOD_OPTIONS.map((m) => [m.value, m.label]))

export const paymentTableColumns: ColumnDef<Payment>[] = [
  {
    accessorKey: 'paymentNumber',
    header: 'Payment #',
    cell: ({ row }) => <span className="font-mono text-[12px] text-[var(--color-text-body)]">{row.original.paymentNumber}</span>,
  },
  {
    accessorKey: 'invoiceId',
    header: 'Invoice',
    enableSorting: false,
    cell: ({ row }) => (
      <span className="font-mono text-[11px] text-[var(--color-text-secondary)]">
        {row.original.invoiceId ? `${row.original.invoiceId.slice(0, 8)}…` : '—'}
      </span>
    ),
  },
  {
    accessorKey: 'amount',
    header: 'Amount',
    cell: ({ row }) => (
      <span className="font-mono text-[12px] font-semibold text-[var(--color-text-body)]">{formatINR(row.original.amount, 0)}</span>
    ),
  },
  {
    accessorKey: 'method',
    header: 'Method',
    cell: ({ row }) => (
      <span className="text-[12px] text-[var(--color-text-secondary)]">
        {row.original.method ? (METHOD_LABELS[row.original.method] ?? row.original.method) : '—'}
      </span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <PaymentStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: 'paidDate',
    header: 'Paid',
    cell: ({ row }) => (
      <span className="text-[12px] text-[var(--color-text-secondary)]">
        {row.original.paidDate ? formatDate(row.original.paidDate) : '—'}
      </span>
    ),
  },
]
