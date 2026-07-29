// src/modules/client-billing/components/InvoiceTableColumns.tsx
// Column definitions consumed by the shared DataTable - no table-rendering logic lives here.
// clientId/businessId are shown as raw UUIDs: no mounted Clients API exists to resolve either to a
// friendly name (same honest-raw-ID precedent as ProjectTableColumns).
import type { ColumnDef } from '@tanstack/react-table'
import { formatDate, formatINR } from '@/lib/utils'
import { InvoiceStatusBadge } from './InvoiceStatusBadge'
import type { Invoice } from '../types'

export const invoiceTableColumns: ColumnDef<Invoice>[] = [
  {
    accessorKey: 'invoiceNumber',
    header: 'Invoice #',
    cell: ({ row }) => <span className="font-mono text-[12px] text-[var(--color-text-body)]">{row.original.invoiceNumber}</span>,
  },
  {
    accessorKey: 'clientId',
    header: 'Client',
    enableSorting: false,
    cell: ({ row }) => (
      <span className="font-mono text-[11px] text-[var(--color-text-secondary)]">
        {row.original.clientId ? `${row.original.clientId.slice(0, 8)}…` : '—'}
      </span>
    ),
  },
  {
    accessorKey: 'amount',
    header: 'Amount',
    cell: ({ row }) => (
      <span className="font-mono text-[12px] font-semibold text-[var(--color-text-body)]">
        {formatINR(row.original.amount + row.original.tax, 0)}
      </span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <InvoiceStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: 'dueDate',
    header: 'Due',
    cell: ({ row }) => (
      <span className="text-[12px] text-[var(--color-text-secondary)]">
        {row.original.dueDate ? formatDate(row.original.dueDate) : '—'}
      </span>
    ),
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: ({ row }) => (
      <span className="text-[12px] text-[var(--color-text-secondary)]">{formatDate(row.original.createdAt)}</span>
    ),
  },
]
