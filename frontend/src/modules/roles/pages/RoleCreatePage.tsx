// src/modules/roles/pages/RoleCreatePage.tsx
import { useNavigate } from 'react-router-dom'
import { PageLayout, PageHeader, PageContent } from '@/components/page'
import { Card } from '@/components/shared/Card/Card'
import { normalizeApiError } from '@/services/api-error'
import { useCreateRoleMutation } from '../hooks'
import { RoleForm } from '../components'
import type { CreateRoleFormValues } from '../schemas'

export function RoleCreatePage() {
  const navigate = useNavigate()
  const createMutation = useCreateRoleMutation()

  const handleSubmit = (values: CreateRoleFormValues) => {
    createMutation.mutate(
      {
        name: values.name,
        description: values.description || undefined,
        color: values.color || undefined,
        permissionCodes: values.permissionCodes,
      },
      { onSuccess: (role) => navigate(`/staff/roles/${role.id}`) }
    )
  }

  return (
    <PageLayout>
      <PageHeader title="New Role" description="Create a role and grant it permissions." />
      <PageContent>
        <Card>
          <RoleForm
            mode="create"
            onSubmit={handleSubmit}
            isSubmitting={createMutation.isPending}
            submitError={createMutation.isError ? normalizeApiError(createMutation.error).message : undefined}
          />
        </Card>
      </PageContent>
    </PageLayout>
  )
}
