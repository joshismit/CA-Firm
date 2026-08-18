// src/modules/client-portal/components/SharedDocumentTableColumns.tsx
// Column definitions consumed by the shared DataTable - no table-rendering logic lives here.
import type { ColumnDef } from '@tanstack/react-table'
import { formatDate, formatFileSize } from '@/lib/utils'
import type { SharedDocument } from '../types'

export const sharedDocumentTableColumns: ColumnDef<SharedDocument>[] = [
  {
    accessorKey: 'fileName',
    header: 'File name',
    cell: ({ row }) => <p className="font-medium text-[var(--color-text-body)] truncate max-w-[280px]">{row.original.fileName}</p>,
  },
  {
    accessorKey: 'category',
    header: 'Category',
    cell: ({ row }) => <span className="text-[12px] text-[var(--color-text-secondary)]">{row.original.category}</span>,
  },
  {
    accessorKey: 'sizeBytes',
    header: 'Size',
    cell: ({ row }) => (
      <span className="font-mono tabular-nums text-[12px] text-[var(--color-text-secondary)]">{formatFileSize(row.original.sizeBytes)}</span>
    ),
  },
  {
    accessorKey: 'sharedAt',
    header: 'Shared',
    cell: ({ row }) => <span className="text-[12px] text-[var(--color-text-secondary)]">{formatDate(row.original.sharedAt)}</span>,
  },
]
