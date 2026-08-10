// src/modules/client-portal/pages/ClientPortalTasksPage.tsx
// Reuses the real, already-wired Tasks module (hooks/api) rather than the stubbed
// modules/client-portal/api - GET /tasks already server-scopes a CLIENT caller to their own
// client/business (TaskAccessScopeService's CLIENT branch), so no separate client-facing API
// surface is needed here.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { PageLayout, PageHeader, PageContent } from '@/components/page'
import { DataTable } from '@/components/tables'
import { StatusBadge } from '@/components/shared/StatusBadge/StatusBadge'
import { Can } from '@/components/common/Can'
import { PERMISSIONS } from '@/config/permissions.config'
import { normalizeApiError } from '@/services/api-error'
import { formatDate } from '@/lib/utils'
import { useTasksQuery } from '@/modules/tasks/hooks'
import { CreateTaskDialog } from '@/modules/tasks/components'
import type { Task, TaskStatus } from '@/modules/tasks/types'

const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  REVIEW: 'Review',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

const STATUS_VARIANT: Record<TaskStatus, 'default' | 'success' | 'warning' | 'info' | 'danger'> = {
  TODO: 'default',
  IN_PROGRESS: 'info',
  REVIEW: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
}

const columns: ColumnDef<Task>[] = [
  {
    accessorKey: 'title',
    header: 'Task',
    cell: ({ row }) => (
      <Link to={`/portal/tasks/${row.original.id}`} className="font-medium text-[var(--color-text-body)] hover:text-[var(--color-primary-600)]">
        {row.original.title}
      </Link>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <StatusBadge variant={STATUS_VARIANT[row.original.status]} dot>
        {STATUS_LABELS[row.original.status]}
      </StatusBadge>
    ),
  },
  {
    accessorKey: 'dueDate',
    header: 'Due',
    cell: ({ row }) =>
      row.original.dueDate ? (
        <span className={row.original.isOverdue ? 'font-medium text-[var(--color-danger)]' : 'text-[var(--color-text-secondary)]'}>
          {formatDate(row.original.dueDate)}
          {row.original.isOverdue && ' · Overdue'}
        </span>
      ) : (
        <span className="text-[var(--color-text-muted)]">—</span>
      ),
  },
]

export function ClientPortalTasksPage() {
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(20)

  const { data, isLoading, isError, error, refetch } = useTasksQuery({ page: pageIndex + 1, limit: pageSize })

  return (
    <PageLayout>
      <PageHeader
        title="My Tasks"
        description="Tasks you've created and their status."
        actions={
          <Can permission={PERMISSIONS.TASKS_CREATE}>
            <CreateTaskDialog />
          </Can>
        }
      />
      <PageContent>
        <DataTable<Task>
          columns={columns}
          data={data?.data ?? []}
          isLoading={isLoading}
          isError={isError}
          errorMessage={isError ? normalizeApiError(error).message : undefined}
          onRetry={refetch}
          emptyTitle="No tasks yet"
          emptyDescription="Create a task and assign it to your firm's staff to get started."
          pageIndex={pageIndex}
          pageSize={pageSize}
          pageCount={data?.meta?.totalPages ?? 0}
          totalRows={data?.meta?.total}
          onPageChange={setPageIndex}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPageIndex(0)
          }}
          getRowId={(row) => row.id}
        />
      </PageContent>
    </PageLayout>
  )
}
