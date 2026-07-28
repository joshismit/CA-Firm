// src/modules/business/components/BusinessTableColumns.tsx
// Column definitions consumed by the shared DataTable - no table-rendering logic lives here.
import type { ColumnDef } from '@tanstack/react-table'
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

export const businessTableColumns: ColumnDef<Business>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="font-medium text-[var(--color-text-body)] truncate max-w-[220px]">{row.original.name}</p>
        {row.original.legalName && (
          <p className="text-[11px] text-[var(--color-text-muted)] truncate max-w-[220px]">{row.original.legalName}</p>
        )}
      </div>
    ),
  },
  {
    accessorKey: 'pan',
    header: 'PAN',
    cell: ({ row }) => (
      <span className="font-mono text-[12px] text-[var(--color-text-secondary)]">{row.original.pan ?? '—'}</span>
    ),
  },
  {
    accessorKey: 'gstin',
    header: 'GSTIN',
    cell: ({ row }) => (
      <span className="font-mono text-[12px] text-[var(--color-text-secondary)]">{row.original.gstin ?? '—'}</span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <BusinessStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: 'financialYearStart',
    header: 'FY Start',
    enableSorting: false,
    cell: ({ row }) => (
      <span className="text-[12px] text-[var(--color-text-secondary)]">
        {MONTH_NAMES[row.original.financialYearStart] ?? '—'}
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
