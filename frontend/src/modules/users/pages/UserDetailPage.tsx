// src/modules/users/pages/UserDetailPage.tsx
// Full BusinessDetailPage-style composition (fetch -> loading/error guard -> real card layout) so
// that once a real backend exists, only the API layer needs connecting - not this page.
import { useParams } from 'react-router-dom'
import { PageLayout, PageContent } from '@/components/page'
import { Spinner, ErrorState } from '@/components/feedback'
import { normalizeApiError } from '@/services/api-error'
import { useUserQuery } from '../hooks'
import {
  UserHeader,
  UserOverviewCard,
  UserRolesCard,
  UserPermissionsCard,
  UserSessionsCard,
  UserTimelineCard,
} from '../components'

export function UserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: user, isLoading, isError, error, refetch } = useUserQuery(id!)

  if (isLoading) {
    return (
      <PageLayout>
        <Spinner fullScreen={false} label="Loading user…" className="py-16" />
      </PageLayout>
    )
  }

  if (isError || !user) {
    return (
      <PageLayout>
        <ErrorState
          title="Couldn't load this user"
          message={error ? normalizeApiError(error).message : 'User not found.'}
          onRetry={refetch}
        />
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <UserHeader user={user} />

      <PageContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <UserOverviewCard user={user} />
            <UserRolesCard userId={user.id} />
            <UserPermissionsCard userId={user.id} />
            <UserSessionsCard userId={user.id} />
          </div>
          <div className="space-y-4">
            <UserTimelineCard user={user} />
          </div>
        </div>
      </PageContent>
    </PageLayout>
  )
}
