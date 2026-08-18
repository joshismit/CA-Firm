// src/modules/roles/pages/RoleDetailPage.tsx
// Full BusinessDetailPage-style composition so that once a real backend exists, only the API
// layer needs connecting - not this page.
import { useParams } from 'react-router-dom'
import { PageLayout, PageContent } from '@/components/page'
import { Spinner, ErrorState } from '@/components/feedback'
import { normalizeApiError } from '@/services/api-error'
import { useRoleQuery } from '../hooks'
import { RoleHeader, RolePermissionsCard, RoleUsersCard, RoleTimelineCard } from '../components'

export function RoleDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: role, isLoading, isError, error, refetch } = useRoleQuery(id!)

  if (isLoading) {
    return (
      <PageLayout>
        <Spinner fullScreen={false} label="Loading role…" className="py-16" />
      </PageLayout>
    )
  }

  if (isError || !role) {
    return (
      <PageLayout>
        <ErrorState title="Couldn't load this role" message={error ? normalizeApiError(error).message : 'Role not found.'} onRetry={refetch} />
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <RoleHeader role={role} />

      <PageContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <RolePermissionsCard role={role} />
            <RoleUsersCard roleId={role.id} />
          </div>
          <div className="space-y-4">
            <RoleTimelineCard role={role} />
          </div>
        </div>
      </PageContent>
    </PageLayout>
  )
}
