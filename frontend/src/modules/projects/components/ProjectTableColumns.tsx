// src/modules/projects/components/ProjectTableColumns.tsx
// Column definitions consumed by the shared DataTable - no table-rendering logic lives here.
// clientId/managerId are shown as raw UUIDs (truncated): there is no mounted Clients or Users API
// to resolve either to a friendly name (see ProjectRelatedBusinessCard's header comment for the
// clientId case) - same honest-raw-ID precedent CRMForm/ContactFilters already use.
import type { ColumnDef } from '@tanstack/react-table'
import { formatDate } from '@/lib/utils'
import { ProjectStatusBadge } from './ProjectStatusBadge'
import type { Project } from '../types'

export const projectTableColumns: ColumnDef<Project>[] = [
  {
    accessorKey: 'code',
    header: 'Code',
    cell: ({ row }) => (
      <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
        {row.original.code}
      </span>
    ),
  },
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <p className="font-medium text-[var(--color-text-body)] truncate max-w-[240px]">{row.original.name}</p>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <ProjectStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: 'clientId',
    header: 'Client',
    enableSorting: false,
    cell: ({ row }) => (
      <span className="font-mono text-[11px] text-[var(--color-text-secondary)]">
        {row.original.clientId.slice(0, 8)}…
      </span>
    ),
  },
  {
    accessorKey: 'managerId',
    header: 'Manager',
    enableSorting: false,
    cell: ({ row }) => (
      <span className="text-[12px] text-[var(--color-text-secondary)]">
        {row.original.managerId ? `${row.original.managerId.slice(0, 8)}…` : 'Unassigned'}
      </span>
    ),
  },
  {
    accessorKey: 'dueDate',
    header: 'Due',
    cell: ({ row }) => {
      const { dueDate, isOverdue } = row.original
      if (!dueDate) return <span className="text-[12px] text-[var(--color-text-muted)]">—</span>
      return (
        <span className={isOverdue ? 'text-[12px] font-medium text-[var(--color-danger)]' : 'text-[12px] text-[var(--color-text-secondary)]'}>
          {formatDate(dueDate)}
          {isOverdue && ' · Overdue'}
        </span>
      )
    },
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: ({ row }) => (
      <span className="text-[12px] text-[var(--color-text-secondary)]">{formatDate(row.original.createdAt)}</span>
    ),
  },
]
