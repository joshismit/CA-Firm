// src/modules/documents/components/DocumentTableColumns.tsx
// Column definitions consumed by the shared DataTable - no table-rendering logic lives here.
import type { ColumnDef } from '@tanstack/react-table'
import { formatDate } from '@/lib/utils'
import { formatFileSize } from '../utils'
import { DocumentStatusBadge } from './DocumentStatusBadge'
import type { DocumentFile } from '../types'

export const documentTableColumns: ColumnDef<DocumentFile>[] = [
  {
    accessorKey: 'fileName',
    header: 'File name',
    cell: ({ row }) => (
      <p className="font-medium text-[var(--color-text-body)] truncate max-w-[260px]">{row.original.fileName}</p>
    ),
  },
  {
    accessorKey: 'category',
    header: 'Category',
    cell: ({ row }) => <DocumentStatusBadge category={row.original.category} />,
  },
  {
    accessorKey: 'sizeBytes',
    header: 'Size',
    cell: ({ row }) => (
      <span className="font-mono tabular-nums text-[12px] text-[var(--color-text-secondary)]">
        {formatFileSize(row.original.sizeBytes)}
      </span>
    ),
  },
  {
    accessorKey: 'version',
    header: 'Version',
    cell: ({ row }) => (
      <span className="font-mono tabular-nums text-[12px] text-[var(--color-text-secondary)]">v{row.original.version}</span>
    ),
  },
  {
    accessorKey: 'createdAt',
    header: 'Uploaded',
    cell: ({ row }) => (
      <span className="text-[12px] text-[var(--color-text-secondary)]">{formatDate(row.original.createdAt)}</span>
    ),
  },
]
