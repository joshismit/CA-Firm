// src/modules/users/components/UsersTableColumns.tsx
// Column definitions consumed by the shared DataTable - no table-rendering logic lives here.
import type { ColumnDef } from '@tanstack/react-table'
import { formatDate } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'
import { UserStatusBadge } from './UserStatusBadge'
import type { User } from '../types'

export const usersTableColumns: ColumnDef<User>[] = [
  {
    accessorKey: 'firstName',
    header: 'Name',
    cell: ({ row }) => (
      <div className="flex items-center gap-2.5 min-w-0">
        <Avatar name={`${row.original.firstName} ${row.original.lastName}`} size="sm" />
        <div className="min-w-0">
          <p className="font-medium text-[var(--color-text-body)] truncate max-w-[200px]">
            {row.original.firstName} {row.original.lastName}
            {row.original.isOwner && <span className="ml-1.5 text-[10px] text-[var(--color-text-muted)]">(Owner)</span>}
          </p>
          <p className="text-[11px] text-[var(--color-text-muted)] truncate max-w-[200px]">{row.original.email}</p>
        </div>
      </div>
    ),
  },
  {
    accessorKey: 'jobTitle',
    header: 'Job Title',
    cell: ({ row }) => <span className="text-[12px] text-[var(--color-text-secondary)]">{row.original.jobTitle ?? '—'}</span>,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <UserStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: 'lastLoginAt',
    header: 'Last Login',
    cell: ({ row }) => (
      <span className="text-[12px] text-[var(--color-text-secondary)]">
        {row.original.lastLoginAt ? formatDate(row.original.lastLoginAt) : 'Never'}
      </span>
    ),
  },
  {
    accessorKey: 'createdAt',
    header: 'Joined',
    cell: ({ row }) => (
      <span className="text-[12px] text-[var(--color-text-secondary)]">{formatDate(row.original.createdAt)}</span>
    ),
  },
]
