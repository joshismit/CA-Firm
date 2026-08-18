// src/modules/permissions/pages/PermissionDetailPage.tsx
// There is no singular GET /permissions/:id planned anywhere in this module's api layer - only a
// list endpoint. Rather than invent a get-by-id endpoint, this finds the permission by id from the
// same usePermissionsQuery() catalog fetch (real REST APIs commonly expose only a list for small
// reference/lookup data like this). Read-only - no edit/delete actions exist for a permission.
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { PageLayout, PageContent } from '@/components/page'
import { Spinner, ErrorState } from '@/components/feedback'
import { normalizeApiError } from '@/services/api-error'
import { usePermissionsQuery } from '../hooks'
import { PermissionOverviewCard } from '../components'

export function PermissionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading, isError, error, refetch } = usePermissionsQuery()
  const permission = data?.find((p) => p.id === id)

  return (
    <PageLayout>
      <Link
        to="/staff/permissions"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-body)] mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to permissions
      </Link>

      <PageContent>
        {isLoading ? (
          <Spinner fullScreen={false} label="Loading permission…" className="py-16" />
        ) : isError || !permission ? (
          <ErrorState
            title="Couldn't load this permission"
            message={isError ? normalizeApiError(error).message : 'Permission not found.'}
            onRetry={refetch}
          />
        ) : (
          <PermissionOverviewCard permission={permission} />
        )}
      </PageContent>
    </PageLayout>
  )
}
