// src/modules/dashboard/components/RecentActivityWidget.tsx
// Real "recently added" feed across the app's real modules - no activity/audit backend exists
// (see modules/audit's own honest-unavailable page), so this merges the 5 most-recently-created
// businesses/contacts/projects/documents (each a real, already-supported sortBy=createdAt&
// sortOrder=desc call) instead of fabricating an activity log. Same reasoning as
// modules/clients/components/ClientsRecentActivity.tsx, just widened to every module a firm-wide
// dashboard should reasonably summarize.
import { Building2, IdCard, Briefcase, FileText } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { Skeleton, ErrorState, EmptyState } from '@/components/feedback'
import { formatDate } from '@/lib/utils'
import { useBusinessesQuery } from '@/modules/business/hooks'
import { useContactsQuery } from '@/modules/contacts/hooks'
import { useProjectsQuery } from '@/modules/projects/hooks'
import { useDocumentsQuery } from '@/modules/documents/hooks'

interface ActivityRow {
  id: string
  type: 'business' | 'contact' | 'project' | 'document'
  label: string
  createdAt: string
  href: string
}

const TYPE_ICON = {
  business: Building2,
  contact: IdCard,
  project: Briefcase,
  document: FileText,
} as const

const TYPE_LABEL = {
  business: 'Business',
  contact: 'Contact',
  project: 'Project',
  document: 'Document',
} as const

export function RecentActivityWidget() {
  const businesses = useBusinessesQuery({ page: 1, limit: 5, sortBy: 'createdAt', sortOrder: 'desc' })
  const contacts = useContactsQuery({ page: 1, limit: 5, sortBy: 'createdAt', sortOrder: 'desc' })
  const projects = useProjectsQuery({ page: 1, limit: 5, sortBy: 'createdAt', sortOrder: 'desc' })
  const documents = useDocumentsQuery({ page: 1, limit: 5, sortBy: 'createdAt', sortOrder: 'desc' })

  const isLoading = businesses.isLoading || contacts.isLoading || projects.isLoading || documents.isLoading
  const isError = businesses.isError || contacts.isError || projects.isError || documents.isError

  const rows: ActivityRow[] = [
    ...(businesses.data?.data ?? []).map((b) => ({ id: b.id, type: 'business' as const, label: b.name, createdAt: b.createdAt, href: `/business/${b.id}` })),
    ...(contacts.data?.data ?? []).map((c) => ({
      id: c.id,
      type: 'contact' as const,
      label: `${c.firstName} ${c.lastName ?? ''}`.trim(),
      createdAt: c.createdAt,
      href: `/contacts/${c.id}`,
    })),
    ...(projects.data?.data ?? []).map((p) => ({ id: p.id, type: 'project' as const, label: p.name, createdAt: p.createdAt, href: `/projects/${p.id}` })),
    ...(documents.data?.data ?? []).map((d) => ({ id: d.id, type: 'document' as const, label: d.fileName, createdAt: d.createdAt, href: `/documents/${d.id}` })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6)

  return (
    <Card>
      <CardHeader title="Recent Activity" />
      {isLoading ? (
        <Skeleton variant="table" rows={5} height={32} />
      ) : isError ? (
        <ErrorState message="Couldn't load recent activity." />
      ) : rows.length === 0 ? (
        <EmptyState title="No activity yet" description="New businesses, contacts, projects, and documents will show up here." />
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {rows.map((row) => {
            const Icon = TYPE_ICON[row.type]
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
                      {TYPE_LABEL[row.type]} added {formatDate(row.createdAt)}
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
