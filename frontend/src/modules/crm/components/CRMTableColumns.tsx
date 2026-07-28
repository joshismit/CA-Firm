// src/modules/crm/components/CRMTableColumns.tsx
// Column definitions consumed by the shared DataTable - no table-rendering logic lives here.
// Exported as a function (not a static array, unlike Business/Contacts) because stage names must
// be resolved from the real useLeadStagesQuery() result at the call site - Lead only stores a
// stageId, and LeadStage is a tenant-configurable lookup table, not a hardcoded enum.
import type { ColumnDef } from '@tanstack/react-table'
import { formatCompactINR, formatDate } from '@/lib/utils'
import { CRMStatusBadge } from './CRMStatusBadge'
import type { Lead, LeadStage } from '../types'

export function getCrmTableColumns(stages: LeadStage[]): ColumnDef<Lead>[] {
  const stageName = (stageId: string) => stages.find((s) => s.id === stageId)?.name

  return [
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }) => (
        <p className="font-medium text-[var(--color-text-body)] truncate max-w-[260px]">{row.original.title}</p>
      ),
    },
    {
      accessorKey: 'stageId',
      header: 'Stage',
      enableSorting: false,
      cell: ({ row }) => <CRMStatusBadge stageName={stageName(row.original.stageId)} />,
    },
    {
      accessorKey: 'expectedRevenue',
      header: 'Expected Revenue',
      cell: ({ row }) => (
        <span className="font-mono tabular-nums text-[12px] text-[var(--color-text-secondary)]">
          {row.original.expectedRevenue != null ? formatCompactINR(row.original.expectedRevenue) : '—'}
        </span>
      ),
    },
    {
      accessorKey: 'probability',
      header: 'Probability',
      cell: ({ row }) => (
        <span className="font-mono tabular-nums text-[12px] text-[var(--color-text-secondary)]">
          {row.original.probability != null ? `${row.original.probability}%` : '—'}
        </span>
      ),
    },
    {
      accessorKey: 'expectedCloseDate',
      header: 'Expected Close',
      cell: ({ row }) => (
        <span className="text-[12px] text-[var(--color-text-secondary)]">
          {row.original.expectedCloseDate ? formatDate(row.original.expectedCloseDate) : '—'}
        </span>
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
}
