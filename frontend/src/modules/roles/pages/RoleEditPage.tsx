// src/modules/roles/pages/RoleEditPage.tsx
import { useNavigate, useParams } from 'react-router-dom'
import { PageLayout, PageHeader, PageContent } from '@/components/page'
import { Card } from '@/components/shared/Card/Card'
import { Spinner, ErrorState } from '@/components/feedback'
import { normalizeApiError } from '@/services/api-error'
import { useRoleQuery, useUpdateRoleMutation } from '../hooks'
import { RoleForm } from '../components'
import type { CreateRoleFormValues } from '../schemas'

export function RoleEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: role, isLoading, isError, error, refetch } = useRoleQuery(id!)
  const updateMutation = useUpdateRoleMutation(id!)

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

  const handleSubmit = (values: CreateRoleFormValues) => {
    updateMutation.mutate(
      {
        name: values.name,
        description: values.description || undefined,
        color: values.color || undefined,
        permissionCodes: values.permissionCodes,
      },
      { onSuccess: () => navigate(`/staff/roles/${id}`) }
    )
  }

  return (
    <PageLayout>
      <PageHeader title={`Edit ${role.name}`} />
      <PageContent>
        <Card>
          <RoleForm
            mode="edit"
            role={role}
            onSubmit={handleSubmit}
            isSubmitting={updateMutation.isPending}
            submitError={updateMutation.isError ? normalizeApiError(updateMutation.error).message : undefined}
          />
        </Card>
      </PageContent>
    </PageLayout>
  )
}
