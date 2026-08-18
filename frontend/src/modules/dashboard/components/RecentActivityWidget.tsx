// src/modules/dashboard/components/RecentActivityWidget.tsx
// PRD §10.9 - real Recent Activity feed sourced from AuditLog via GET /dashboard/activity. Used
// to fake this by merging 4 unrelated "recently created" list calls client-side because no
// activity/audit backend existed yet at the time - that's no longer true (AuditLog is fully
// populated, see AuditTimelineReader.getRecentActivity() on the backend), so this now reflects
// real events: uploads, task completion, proposal acceptance, payments, new clients, document
// approvals - whatever AuditLogRecorder has actually recorded, scoped to "my activity" for STAFF
// and tenant-wide for unrestricted roles (PRD §10.11).
import { Link } from 'react-router-dom'
import {
  FileUp,
  CheckSquare,
  Handshake,
  Wallet,
  Building2,
  FileCheck2,
  Activity as ActivityIcon,
} from 'lucide-react'
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { Skeleton, ErrorState, EmptyState } from '@/components/feedback'
import { formatDate } from '@/lib/utils'
import { useDashboardActivityQuery } from '../hooks'

const EVENT_ICON: Record<string, typeof ActivityIcon> = {
  UPLOAD: FileUp,
  TASK_COMPLETED: CheckSquare,
  TASK_CREATED: CheckSquare,
  TASK_ASSIGNED: CheckSquare,
  PROPOSAL_ACCEPTED: Handshake,
  PAYMENT_RECEIVED: Wallet,
  BUSINESS_CREATED: Building2,
  DOCUMENT_APPROVED: FileCheck2,
}

/** Best-effort route for a targetType/targetId pair - falls back to no link when unknown. */
function hrefFor(targetType: string | null, targetId: string | null): string | null {
  if (!targetType || !targetId) return null
  const map: Record<string, string> = {
    Task: '/tasks',
    Lead: '/crm',
    Business: '/business',
    Document: '/documents',
    Invoice: '/billing/invoices',
    Client: '/business',
  }
  const base = map[targetType]
  return base ? `${base}/${targetId}` : null
}

export function RecentActivityWidget() {
  const { data, isLoading, isError } = useDashboardActivityQuery(6)
  const items = data?.items ?? []

  return (
    <Card>
      <CardHeader title="Recent Activity" />
      {isLoading ? (
        <Skeleton variant="table" rows={5} height={32} />
      ) : isError ? (
        <ErrorState message="Couldn't load recent activity." />
      ) : items.length === 0 ? (
        <EmptyState title="No activity yet" description="Uploads, task completions, payments, and other events will show up here." />
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {items.map((entry) => {
            const Icon = EVENT_ICON[entry.eventType] ?? ActivityIcon
            const href = hrefFor(entry.targetType, entry.targetId)
            const content = (
              <>
                <div className="w-7 h-7 rounded-[var(--radius-md)] bg-[var(--color-surface)] flex items-center justify-center shrink-0">
                  <Icon className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-medium text-[var(--color-text-body)] truncate">{entry.description}</p>
                  <p className="text-[11px] text-[var(--color-text-muted)]">
                    {entry.actorName} · {formatDate(entry.createdAt)}
                  </p>
                </div>
              </>
            )
            return (
              <li key={entry.id}>
                {href ? (
                  <Link to={href} className="flex items-center gap-3 py-2.5 -mx-1 px-1 rounded-[var(--radius-sm)] hover:bg-[var(--color-hover)] transition-colors">
                    {content}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 py-2.5 -mx-1 px-1">{content}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
