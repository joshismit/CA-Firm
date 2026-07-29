// src/modules/audit/components/AuditTableColumns.tsx
// Column definitions consumed by the shared DataTable - no table-rendering logic lives here.
import type { ColumnDef } from '@tanstack/react-table'
import { formatDate } from '@/lib/utils'
import { AuditEventBadge } from './AuditEventBadge'
import type { AuditLogEntry } from '../types'

export const auditTableColumns: ColumnDef<AuditLogEntry>[] = [
  {
    accessorKey: 'eventType',
    header: 'Event',
    cell: ({ row }) => <AuditEventBadge eventType={row.original.eventType} />,
  },
  {
    accessorKey: 'actorName',
    header: 'Actor',
    cell: ({ row }) => <span className="text-[12px] text-[var(--color-text-body)]">{row.original.actorName}</span>,
  },
  {
    accessorKey: 'targetType',
    header: 'Target',
    enableSorting: false,
    cell: ({ row }) => (
      <span className="font-mono text-[11px] text-[var(--color-text-secondary)]">
        {row.original.targetType ? `${row.original.targetType}${row.original.targetId ? ` · ${row.original.targetId.slice(0, 8)}…` : ''}` : '—'}
      </span>
    ),
  },
  {
    accessorKey: 'description',
    header: 'Description',
    enableSorting: false,
    cell: ({ row }) => (
      <span className="text-[12px] text-[var(--color-text-secondary)] truncate max-w-[280px] inline-block">{row.original.description}</span>
    ),
  },
  {
    accessorKey: 'ipAddress',
    header: 'IP Address',
    enableSorting: false,
    cell: ({ row }) => <span className="font-mono text-[11px] text-[var(--color-text-muted)]">{row.original.ipAddress ?? '—'}</span>,
  },
  {
    accessorKey: 'createdAt',
    header: 'Timestamp',
    cell: ({ row }) => (
      <span className="text-[12px] text-[var(--color-text-secondary)]">{formatDate(row.original.createdAt)}</span>
    ),
  },
]
