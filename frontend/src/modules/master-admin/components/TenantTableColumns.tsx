// src/modules/master-admin/components/TenantTableColumns.tsx
// Column definitions consumed by the shared DataTable - no table-rendering logic lives here.
import type { ColumnDef } from '@tanstack/react-table'
import { formatDate } from '@/lib/utils'
import { TenantStatusBadge } from './TenantStatusBadge'
import type { Tenant } from '../types'

export const tenantTableColumns: ColumnDef<Tenant>[] = [
  {
    accessorKey: 'name',
    header: 'Firm',
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="font-medium text-[var(--color-text-body)] truncate max-w-[240px]">{row.original.name}</p>
        <p className="text-[11px] text-[var(--color-text-muted)] truncate max-w-[240px]">{row.original.slug}</p>
      </div>
    ),
  },
  {
    accessorKey: 'planCode',
    header: 'Plan',
    cell: ({ row }) => <span className="text-[12px] text-[var(--color-text-secondary)]">{row.original.planCode ?? 'No plan'}</span>,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <TenantStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: 'userCount',
    header: 'Users',
    cell: ({ row }) => (
      <span className="font-mono tabular-nums text-[12px] text-[var(--color-text-secondary)]">{row.original.userCount}</span>
    ),
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: ({ row }) => <span className="text-[12px] text-[var(--color-text-secondary)]">{formatDate(row.original.createdAt)}</span>,
  },
]
