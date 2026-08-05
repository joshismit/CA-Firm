// src/modules/master-admin/components/MasterAdminAuditTableColumns.tsx
// Column definitions for the cross-tenant audit view - reuses @/modules/audit's own
// AuditEventBadge cell renderer (same badge, same event-type -> variant mapping) rather than
// re-implementing it, and otherwise mirrors modules/audit/components/AuditTableColumns.tsx
// column-for-column, with one addition: a "Tenant" column up front (the whole point of this
// cross-tenant view - PRD §4.1 "view tenant name on every audit row").
import type { ColumnDef } from '@tanstack/react-table'
import { formatDate } from '@/lib/utils'
import { AuditEventBadge } from '@/modules/audit/components'
import type { MasterAdminAuditLogEntry } from '../types'

export const masterAdminAuditTableColumns: ColumnDef<MasterAdminAuditLogEntry>[] = [
  {
    accessorKey: 'tenantName',
    header: 'Tenant',
    cell: ({ row }) => (
      <span className="text-[12px] font-medium text-[var(--color-text-heading)]">
        {row.original.tenantName ?? '—'}
      </span>
    ),
  },
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
      <span className="text-[12px] text-[var(--color-text-secondary)] truncate max-w-[240px] inline-block">{row.original.description}</span>
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
