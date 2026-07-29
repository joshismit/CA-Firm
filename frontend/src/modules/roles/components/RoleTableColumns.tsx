// src/modules/roles/components/RoleTableColumns.tsx
// Column definitions consumed by the shared DataTable - no table-rendering logic lives here.
import type { ColumnDef } from '@tanstack/react-table'
import { formatDate } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/StatusBadge/StatusBadge'
import { RoleTypeBadge } from './RoleTypeBadge'
import type { Role } from '../types'

export const roleTableColumns: ColumnDef<Role>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <div className="flex items-center gap-2 min-w-0">
        {row.original.color && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: row.original.color }} />}
        <div className="min-w-0">
          <p className="font-medium text-[var(--color-text-body)] truncate max-w-[200px]">{row.original.name}</p>
          {row.original.description && (
            <p className="text-[11px] text-[var(--color-text-muted)] truncate max-w-[200px]">{row.original.description}</p>
          )}
        </div>
      </div>
    ),
  },
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ row }) => <RoleTypeBadge type={row.original.type} />,
  },
  {
    accessorKey: 'permissionCodes',
    header: 'Permissions',
    enableSorting: false,
    cell: ({ row }) => (
      <span className="text-[12px] text-[var(--color-text-secondary)]">{row.original.permissionCodes.length} granted</span>
    ),
  },
  {
    accessorKey: 'isActive',
    header: 'Status',
    cell: ({ row }) => (
      <StatusBadge variant={row.original.isActive ? 'success' : 'default'} dot>
        {row.original.isActive ? 'Active' : 'Inactive'}
      </StatusBadge>
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
