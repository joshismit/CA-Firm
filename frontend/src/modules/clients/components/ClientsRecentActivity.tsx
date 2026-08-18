// src/modules/clients/components/ClientsRecentActivity.tsx
// "Recent activity" backed by real data: there is no audit/activity-log backend (see
// modules/audit/api's notImplemented stubs), so rather than fabricate an activity feed this shows
// the most recently created businesses and contacts - two real GET calls each already sorted
// server-side (sortBy=createdAt&sortOrder=desc is a genuine, already-supported query param on both
// endpoints), merged and capped to the 5 most recent overall.
import { Building2, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { Skeleton, ErrorState, EmptyState } from '@/components/feedback'
import { formatDate } from '@/lib/utils'
import { useBusinessesQuery } from '@/modules/business/hooks'
import { useContactsQuery } from '@/modules/contacts/hooks'

interface ActivityRow {
  id: string
  type: 'business' | 'contact'
  label: string
  createdAt: string
  href: string
}

export function ClientsRecentActivity() {
  const businesses = useBusinessesQuery({ page: 1, limit: 5, sortBy: 'createdAt', sortOrder: 'desc' })
  const contacts = useContactsQuery({ page: 1, limit: 5, sortBy: 'createdAt', sortOrder: 'desc' })

  const isLoading = businesses.isLoading || contacts.isLoading
  const isError = businesses.isError || contacts.isError

  const rows: ActivityRow[] = [
    ...(businesses.data?.data ?? []).map((b) => ({
      id: b.id,
      type: 'business' as const,
      label: b.name,
      createdAt: b.createdAt,
      href: `/business/${b.id}`,
    })),
    ...(contacts.data?.data ?? []).map((c) => ({
      id: c.id,
      type: 'contact' as const,
      label: `${c.firstName} ${c.lastName ?? ''}`.trim(),
      createdAt: c.createdAt,
      href: `/contacts/${c.id}`,
    })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)

  return (
    <Card padding="sm">
      <CardHeader title="Recently Added" />
      {isLoading ? (
        <Skeleton variant="table" rows={5} height={32} />
      ) : isError ? (
        <ErrorState message="Couldn't load recent activity." />
      ) : rows.length === 0 ? (
        <EmptyState title="No activity yet" description="New businesses and contacts will show up here." />
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {rows.map((row) => {
            const Icon = row.type === 'business' ? Building2 : UserRound
            return (
              <li key={`${row.type}-${row.id}`}>
                <Link
                  to={row.href}
                  className="flex items-center gap-3 py-2.5 -mx-1 px-1 rounded-[var(--radius-sm)] hover:bg-[var(--color-hover)] transition-colors"
                >
                  <div className="w-7 h-7 rounded-[var(--radius-md)] bg-[var(--color-surface)] flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium text-[var(--color-text-body)] truncate">{row.label}</p>
                    <p className="text-[11px] text-[var(--color-text-muted)]">
                      {row.type === 'business' ? 'Business' : 'Contact'} added {formatDate(row.createdAt)}
                    </p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
