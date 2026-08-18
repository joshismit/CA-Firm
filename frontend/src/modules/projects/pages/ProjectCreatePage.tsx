// src/modules/projects/pages/ProjectCreatePage.tsx
import { useNavigate } from 'react-router-dom'
import { PageLayout, PageHeader, PageContent } from '@/components/page'
import { Card } from '@/components/shared/Card/Card'
import { normalizeApiError } from '@/services/api-error'
import { useCreateProjectMutation } from '../hooks'
import { ProjectForm } from '../components'
import type { CreateProjectFormValues } from '../schemas'
import type { CreateProjectPayload } from '../types'

export function ProjectCreatePage() {
  const navigate = useNavigate()
  const createMutation = useCreateProjectMutation()

  const handleSubmit = (values: CreateProjectFormValues) => {
    const payload: CreateProjectPayload = {
      clientId: values.clientId,
      managerId: values.managerId || undefined,
      code: values.code,
      name: values.name,
      startDate: values.startDate ? values.startDate.toISOString() : undefined,
      dueDate: values.dueDate ? values.dueDate.toISOString() : undefined,
    }
    createMutation.mutate(payload, {
      onSuccess: (project) => navigate(`/projects/${project.id}`),
    })
  }

  return (
    <PageLayout>
      <PageHeader title="New Project" description="Create an engagement for a client." />
      <PageContent>
        <Card>
          <ProjectForm
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
