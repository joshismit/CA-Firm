// src/modules/users/pages/UserEditPage.tsx
import { useNavigate, useParams } from 'react-router-dom'
import { PageLayout, PageHeader, PageContent } from '@/components/page'
import { Card } from '@/components/shared/Card/Card'
import { Spinner, ErrorState } from '@/components/feedback'
import { normalizeApiError } from '@/services/api-error'
import { useUserQuery, useUpdateUserMutation } from '../hooks'
import { UserForm } from '../components'
import type { UpdateUserFormValues } from '../schemas'

export function UserEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: user, isLoading, isError, error, refetch } = useUserQuery(id!)
  const updateMutation = useUpdateUserMutation(id!)

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
        <ErrorState title="Couldn't load this user" message={error ? normalizeApiError(error).message : 'User not found.'} onRetry={refetch} />
      </PageLayout>
    )
  }

  const handleSubmit = (values: UpdateUserFormValues) => {
    updateMutation.mutate(values, {
      onSuccess: () => navigate(`/staff/users/${id}`),
    })
  }

  return (
    <PageLayout>
      <PageHeader title={`Edit ${user.firstName} ${user.lastName}`} />
      <PageContent>
        <Card>
          <UserForm
            mode="edit"
            user={user}
            onUpdate={handleSubmit}
            isSubmitting={updateMutation.isPending}
            submitError={updateMutation.isError ? normalizeApiError(updateMutation.error).message : undefined}
          />
        </Card>
      </PageContent>
    </PageLayout>
  )
}
