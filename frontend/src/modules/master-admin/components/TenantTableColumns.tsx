// src/modules/master-admin/components/TenantTableColumns.tsx
// Column definitions consumed by the shared DataTable - no table-rendering logic lives here.
import type { ColumnDef } from '@tanstack/react-table'
import { formatDate } from '@/lib/utils'
import { TenantStatusBadge } from './TenantStatusBadge'
import type { Tenant } from '../types'

export const tenantTableColumns: ColumnDef<Tenant>[] = [
  {
    accessorKey: 'firmName',
    header: 'Firm',
    cell: ({ row }) => <p className="font-medium text-[var(--color-text-body)] truncate max-w-[240px]">{row.original.firmName}</p>,
  },
  {
    accessorKey: 'planName',
    header: 'Plan',
    cell: ({ row }) => <span className="text-[12px] text-[var(--color-text-secondary)]">{row.original.planName}</span>,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <TenantStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: 'staffCount',
    header: 'Staff',
    cell: ({ row }) => (
      <span className="font-mono tabular-nums text-[12px] text-[var(--color-text-secondary)]">{row.original.staffCount}</span>
    ),
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: ({ row }) => <span className="text-[12px] text-[var(--color-text-secondary)]">{formatDate(row.original.createdAt)}</span>,
  },
]
