// src/modules/master-admin/pages/MasterAdminAuditDetailPage.tsx (PRD §4.1 — system-level audit monitoring)
// Mirrors @/modules/audit/pages/AuditDetailPage.tsx's layout exactly, plus one extra field
// (Tenant) that only the cross-tenant view has, backed by GET /master-admin/audit-logs/:id
// instead of the tenant-scoped GET /audit-logs/:id.
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { PageLayout, PageHeader, PageContent } from '@/components/page'
import { Card } from '@/components/shared/Card/Card'
import { Spinner, ErrorState } from '@/components/feedback'
import { normalizeApiError } from '@/services/api-error'
import { formatDateLong } from '@/lib/utils'
import { AuditEventBadge } from '@/modules/audit/components'
import { useMasterAdminAuditLogEntryQuery } from '../hooks'

export function MasterAdminAuditDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading, isError, error, refetch } = useMasterAdminAuditLogEntryQuery(id!)

  return (
    <PageLayout>
      <Link
        to="/master-admin/audit"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-body)] mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Audit Logs
      </Link>

      <PageContent>
        {isLoading ? (
          <Spinner fullScreen={false} label="Loading audit event…" className="py-16" />
        ) : isError || !data ? (
          <ErrorState
            title="This audit event isn't available"
            message={isError ? normalizeApiError(error).message : 'No audit event found with this ID.'}
            onRetry={refetch}
          />
        ) : (
          <>
            <PageHeader title="Audit Event" description={data.description} />
            <Card>
              <dl className="grid grid-cols-2 gap-4 text-[12px]">
                <div>
                  <dt className="text-[var(--color-text-muted)]">Tenant</dt>
                  <dd className="mt-1 text-[var(--color-text-body)]">{data.tenantName ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-[var(--color-text-muted)]">Event</dt>
                  <dd className="mt-1">
                    <AuditEventBadge eventType={data.eventType} />
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--color-text-muted)]">Actor</dt>
                  <dd className="mt-1 text-[var(--color-text-body)]">{data.actorName}</dd>
                </div>
                <div>
                  <dt className="text-[var(--color-text-muted)]">Target</dt>
                  <dd className="mt-1 font-mono text-[11px] text-[var(--color-text-secondary)]">
                    {data.targetType ? `${data.targetType}${data.targetId ? ` · ${data.targetId}` : ''}` : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--color-text-muted)]">IP Address</dt>
                  <dd className="mt-1 font-mono text-[11px] text-[var(--color-text-secondary)]">{data.ipAddress ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-[var(--color-text-muted)]">Timestamp</dt>
                  <dd className="mt-1 text-[var(--color-text-body)]">{formatDateLong(data.createdAt)}</dd>
                </div>
              </dl>
            </Card>
          </>
        )}
      </PageContent>
    </PageLayout>
  )
}
