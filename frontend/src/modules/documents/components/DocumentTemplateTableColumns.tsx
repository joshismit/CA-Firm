// src/modules/documents/components/DocumentTemplateTableColumns.tsx
// Column definitions consumed by the shared DataTable - no table-rendering logic lives here.
import type { ColumnDef } from '@tanstack/react-table'
import { formatDate } from '@/lib/utils'
import { DOCUMENT_CATEGORY_LABELS } from '../constants'
import type { DocumentTemplate } from '../types'

export const documentTemplateTableColumns: ColumnDef<DocumentTemplate>[] = [
  {
    accessorKey: 'name',
    header: 'Template name',
    cell: ({ row }) => <p className="font-medium text-[var(--color-text-body)] truncate max-w-[280px]">{row.original.name}</p>,
  },
  {
    accessorKey: 'category',
    header: 'Category',
    cell: ({ row }) => (
      <span className="text-[12px] text-[var(--color-text-secondary)]">
        {DOCUMENT_CATEGORY_LABELS[row.original.category] ?? row.original.category}
      </span>
    ),
  },
  {
    accessorKey: 'description',
    header: 'Description',
    cell: ({ row }) => (
      <span className="text-[12px] text-[var(--color-text-secondary)] truncate max-w-[320px] block">
        {row.original.description ?? '—'}
      </span>
    ),
  },
  {
    accessorKey: 'updatedAt',
    header: 'Updated',
    cell: ({ row }) => <span className="text-[12px] text-[var(--color-text-secondary)]">{formatDate(row.original.updatedAt)}</span>,
  },
]
