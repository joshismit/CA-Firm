// src/modules/notifications/pages/NotificationListPage.tsx
// Reference composition: PageLayout > PageHeader (+ PageActions) > PageContent > DataTable, same
// as BusinessListPage/InvoiceListPage. Notifications are self-service (a user's own inbox), so
// mark-as-read/delete aren't wrapped in <Can> - matches how auth's own change-password/sessions
// actions aren't permission-gated either. The Unread/All toggle is a Tabs row (unreadOnly), with
// channel/delivery-status as DataTable toolbarFilters.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCheck, Trash2 } from 'lucide-react'
import type { RowSelectionState, SortingState } from '@tanstack/react-table'
import { PageLayout, PageHeader, PageContent, PageActions } from '@/components/page'
import { DataTable } from '@/components/tables'
import { Tabs } from '@/components/shared/Tabs/Tabs'
import { Button } from '@/components/ui/button'
import { ExportButton } from '@/components/shared/ExportButton/ExportButton'
import { FilterChips, type FilterChip } from '@/components/shared/FilterChips/FilterChips'
import { normalizeApiError } from '@/services/api-error'
import { useDebounce } from '@/hooks'
import {
  useNotificationsQuery,
  useDeleteNotificationMutation,
  useMarkNotificationAsReadMutation,
  useMarkAllNotificationsAsReadMutation,
} from '../hooks'
import { notificationTableColumns, NotificationFilters, NotificationStatsCards } from '../components'
import { NOTIFICATION_CHANNEL_LABELS, NOTIFICATION_STATUS_LABELS } from '../constants'
import type { Notification, NotificationChannel, NotificationListFilters, NotificationStatus } from '../types'

type ReadTab = 'all' | 'unread'

export function NotificationListPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<ReadTab>('all')
  const [search, setSearch] = useState('')
  const [channel, setChannel] = useState<NotificationChannel | undefined>()
  const [status, setStatus] = useState<NotificationStatus | undefined>()
  const [sorting, setSorting] = useState<SortingState>([])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(20)

  const debouncedSearch = useDebounce(search, 300)

  const filters: NotificationListFilters = {
    page: pageIndex + 1,
    limit: pageSize,
    search: debouncedSearch || undefined,
    channel,
    status,
    unreadOnly: tab === 'unread' || undefined,
    sortBy: sorting[0]?.id,
    sortOrder: sorting[0] ? (sorting[0].desc ? 'desc' : 'asc') : undefined,
  }

  const { data, isLoading, isError, error, refetch } = useNotificationsQuery(filters)
  const deleteMutation = useDeleteNotificationMutation()
  const markAsReadMutation = useMarkNotificationAsReadMutation()
  const markAllAsReadMutation = useMarkAllNotificationsAsReadMutation()

  const handleBulkDelete = async (selected: Notification[]) => {
    if (selected.length === 0) return
    if (!window.confirm(`Delete ${selected.length} notification${selected.length === 1 ? '' : 's'}? This cannot be undone.`)) return
    for (const notification of selected) {
      await deleteMutation.mutateAsync(notification.id)
    }
    setRowSelection({})
  }

  const handleBulkMarkAsRead = async (selected: Notification[]) => {
    if (selected.length === 0) return
    for (const notification of selected) {
      await markAsReadMutation.mutateAsync(notification.id)
    }
    setRowSelection({})
  }

  const chips: FilterChip[] = [
    ...(debouncedSearch ? [{ key: 'search', label: `Search: "${debouncedSearch}"` }] : []),
    ...(channel ? [{ key: 'channel', label: `Channel: ${NOTIFICATION_CHANNEL_LABELS[channel]}` }] : []),
    ...(status ? [{ key: 'status', label: `Delivery: ${NOTIFICATION_STATUS_LABELS[status]}` }] : []),
  ]

  const removeChip = (key: string) => {
    if (key === 'search') setSearch('')
    if (key === 'channel') setChannel(undefined)
    if (key === 'status') setStatus(undefined)
    setPageIndex(0)
  }

  const clearAllChips = () => {
    setSearch('')
    setChannel(undefined)
    setStatus(undefined)
    setPageIndex(0)
  }

  return (
    <PageLayout>
      <PageHeader
        title="Notifications"
        description="Stay on top of alerts across WhatsApp, email, SMS, and in-app."
        actions={
          <PageActions>
            <ExportButton
              rows={data?.data ?? []}
              filename="notifications"
              columns={[
                { header: 'Title', accessor: (n) => n.title },
                { header: 'Message', accessor: (n) => n.message },
                { header: 'Channel', accessor: (n) => n.channel },
                { header: 'Delivery Status', accessor: (n) => n.status },
                { header: 'Read', accessor: (n) => (n.isRead ? 'Yes' : 'No') },
                { header: 'Received', accessor: (n) => n.createdAt },
              ]}
            />
            <Button
              variant="secondary"
              leadingIcon={<CheckCheck className="w-3.5 h-3.5" />}
              onClick={() => markAllAsReadMutation.mutate()}
              loading={markAllAsReadMutation.isPending}
            >
              Mark all as read
            </Button>
          </PageActions>
        }
      />

      <PageContent>
        <div className="space-y-4">
          <NotificationStatsCards />

          <Tabs
            value={tab}
            onChange={(v) => {
              setTab(v as ReadTab)
              setPageIndex(0)
            }}
            tabs={[
              { value: 'all', label: 'All' },
              { value: 'unread', label: 'Unread' },
            ]}
          />

          <FilterChips chips={chips} onRemove={removeChip} onClearAll={clearAllChips} />

          {(markAllAsReadMutation.isError || deleteMutation.isError || markAsReadMutation.isError) && (
            <p className="text-[12px] text-[var(--color-danger)]">
              {normalizeApiError(
                markAllAsReadMutation.error ?? deleteMutation.error ?? markAsReadMutation.error
              ).message}
            </p>
          )}

          <DataTable<Notification>
            columns={notificationTableColumns}
            data={data?.data ?? []}
            isLoading={isLoading}
            isError={isError}
            errorMessage={isError ? normalizeApiError(error).message : undefined}
            onRetry={refetch}
            emptyTitle="No notifications"
            emptyDescription="You're all caught up - new notifications will show up here."
            searchValue={search}
            onSearchChange={(value) => {
              setSearch(value)
              setPageIndex(0)
            }}
            searchPlaceholder="Search by title or message…"
            toolbarFilters={
              <NotificationFilters
                channel={channel}
                onChannelChange={(next) => {
                  setChannel(next)
                  setPageIndex(0)
                }}
                status={status}
                onStatusChange={(next) => {
                  setStatus(next)
                  setPageIndex(0)
                }}
              />
            }
            sorting={sorting}
            onSortingChange={setSorting}
            pageIndex={pageIndex}
            pageSize={pageSize}
            pageCount={data?.meta?.totalPages ?? 0}
            totalRows={data?.meta?.total}
            onPageChange={setPageIndex}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setPageIndex(0)
            }}
            enableRowSelection
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            getRowId={(row) => row.id}
            bulkActions={(selected) => (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  leadingIcon={<CheckCheck className="w-3.5 h-3.5" />}
                  onClick={() => handleBulkMarkAsRead(selected)}
                  loading={markAsReadMutation.isPending}
                >
                  Mark as read
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  leadingIcon={<Trash2 className="w-3.5 h-3.5" />}
                  onClick={() => handleBulkDelete(selected)}
                  loading={deleteMutation.isPending}
                >
                  Delete selected
                </Button>
              </>
            )}
            onRowClick={(row) => navigate(`/notifications/${row.id}`)}
          />
        </div>
      </PageContent>
    </PageLayout>
  )
}
