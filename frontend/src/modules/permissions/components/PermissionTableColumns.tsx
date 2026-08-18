// src/modules/permissions/components/PermissionTableColumns.tsx
// Column definitions consumed by the shared DataTable - no table-rendering logic lives here.
// Read-only catalog - no actions column.
import type { ColumnDef } from '@tanstack/react-table'
import { StatusBadge } from '@/components/shared/StatusBadge/StatusBadge'
import type { Permission } from '../types'

export const permissionTableColumns: ColumnDef<Permission>[] = [
  {
    accessorKey: 'code',
    header: 'Code',
    cell: ({ row }) => <span className="font-mono text-[12px] text-[var(--color-text-body)]">{row.original.code}</span>,
  },
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => <span className="text-[12px] text-[var(--color-text-secondary)]">{row.original.name}</span>,
  },
  {
    accessorKey: 'resource',
    header: 'Resource',
    cell: ({ row }) => <span className="text-[12px] text-[var(--color-text-secondary)]">{row.original.resource}</span>,
  },
  {
    accessorKey: 'action',
    header: 'Action',
    cell: ({ row }) => <span className="text-[12px] text-[var(--color-text-secondary)]">{row.original.action}</span>,
  },
  {
    accessorKey: 'isSensitive',
    header: 'Sensitive',
    cell: ({ row }) =>
      row.original.isSensitive ? (
        <StatusBadge variant="danger" dot>
          Sensitive
        </StatusBadge>
      ) : (
        <span className="text-[12px] text-[var(--color-text-muted)]">—</span>
      ),
  },
]
