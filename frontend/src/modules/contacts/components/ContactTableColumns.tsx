// src/modules/contacts/components/ContactTableColumns.tsx
// Column definitions consumed by the shared DataTable - no table-rendering logic lives here.
import type { ColumnDef } from '@tanstack/react-table'
import { formatDate } from '@/lib/utils'
import { ContactStatusBadge } from './ContactStatusBadge'
import type { Contact } from '../types'

export const contactTableColumns: ColumnDef<Contact>[] = [
  {
    id: 'name',
    accessorFn: (row) => `${row.firstName} ${row.lastName ?? ''}`.trim(),
    header: 'Name',
    cell: ({ row }) => (
      <p className="font-medium text-[var(--color-text-body)] truncate max-w-[220px]">
        {row.original.firstName} {row.original.lastName ?? ''}
      </p>
    ),
  },
  {
    accessorKey: 'email',
    header: 'Email',
    cell: ({ row }) => (
      <span className="text-[12px] text-[var(--color-text-secondary)]">{row.original.email ?? '—'}</span>
    ),
  },
  {
    accessorKey: 'phone',
    header: 'Phone',
    cell: ({ row }) => (
      <span className="font-mono text-[12px] text-[var(--color-text-secondary)]">{row.original.phone ?? '—'}</span>
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
    accessorKey: 'portalUserId',
    header: 'Status',
    enableSorting: false,
    cell: ({ row }) => <ContactStatusBadge portalUserId={row.original.portalUserId} />,
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: ({ row }) => (
      <span className="text-[12px] text-[var(--color-text-secondary)]">{formatDate(row.original.createdAt)}</span>
    ),
  },
]
