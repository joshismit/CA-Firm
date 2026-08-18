// src/modules/compliance/components/ComplianceTableColumns.tsx
// Column definitions consumed by the shared DataTable - no table-rendering logic lives here.
// Generic, provisional field set (reference/period/status/dueDate/created) per the "no invented
// domain-specific fields" decision in types/index.ts - shared unchanged across all four Compliance
// areas. In practice these columns never render actual rows: listComplianceFilings always 501s, so
// DataTable shows its ErrorState branch instead - this exists so the table has real column
// definitions ready the moment a real backend/list response exists.
import type { ColumnDef } from '@tanstack/react-table'
import { formatDate } from '@/lib/utils'
import { ComplianceStatusBadge } from './ComplianceStatusBadge'
import type { ComplianceFiling } from '../types'

export const complianceTableColumns: ColumnDef<ComplianceFiling>[] = [
  {
    accessorKey: 'reference',
    header: 'Reference',
    cell: ({ row }) => <span className="font-mono text-[12px] text-[var(--color-text-body)]">{row.original.reference}</span>,
  },
  {
    accessorKey: 'period',
    header: 'Period',
    cell: ({ row }) => <span className="text-[12px] text-[var(--color-text-secondary)]">{row.original.period}</span>,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <ComplianceStatusBadge status={row.original.status} />,
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
