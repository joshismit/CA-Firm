// src/modules/client-billing/components/ExpenseTableColumns.tsx
// Column definitions consumed by the shared DataTable - no table-rendering logic lives here.
import type { ColumnDef } from '@tanstack/react-table'
import { formatDate, formatINR } from '@/lib/utils'
import { ExpenseStatusBadge } from './ExpenseStatusBadge'
import { EXPENSE_CATEGORY_OPTIONS } from '../constants'
import type { Expense } from '../types'

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  EXPENSE_CATEGORY_OPTIONS.map((c) => [c.value, c.label])
)

export const expenseTableColumns: ColumnDef<Expense>[] = [
  {
    accessorKey: 'expenseNumber',
    header: 'Expense #',
    cell: ({ row }) => <span className="font-mono text-[12px] text-[var(--color-text-body)]">{row.original.expenseNumber}</span>,
  },
  {
    accessorKey: 'category',
    header: 'Category',
    cell: ({ row }) => (
      <span className="text-[12px] text-[var(--color-text-secondary)]">
        {CATEGORY_LABELS[row.original.category] ?? row.original.category}
      </span>
    ),
  },
  {
    accessorKey: 'vendor',
    header: 'Vendor',
    cell: ({ row }) => <span className="text-[12px] text-[var(--color-text-secondary)]">{row.original.vendor ?? '—'}</span>,
  },
  {
    accessorKey: 'amount',
    header: 'Amount',
    cell: ({ row }) => (
      <span className="font-mono text-[12px] font-semibold text-[var(--color-text-body)]">{formatINR(row.original.amount, 0)}</span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <ExpenseStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: 'date',
    header: 'Date',
    cell: ({ row }) => (
      <span className="text-[12px] text-[var(--color-text-secondary)]">{row.original.date ? formatDate(row.original.date) : '—'}</span>
    ),
  },
]
