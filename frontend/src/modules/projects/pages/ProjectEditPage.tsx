// src/modules/projects/pages/ProjectEditPage.tsx
import { useNavigate, useParams } from 'react-router-dom'
import { PageLayout, PageHeader, PageContent } from '@/components/page'
import { Card } from '@/components/shared/Card/Card'
import { Spinner, ErrorState } from '@/components/feedback'
import { normalizeApiError } from '@/services/api-error'
import { useProjectQuery, useUpdateProjectMutation } from '../hooks'
import { ProjectForm } from '../components'
import type { CreateProjectFormValues } from '../schemas'
import type { UpdateProjectPayload } from '../types'

export function ProjectEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: project, isLoading, isError, error, refetch } = useProjectQuery(id!)
  const updateMutation = useUpdateProjectMutation(id!)

  if (isLoading) {
    return (
      <PageLayout>
        <Spinner fullScreen={false} label="Loading project…" className="py-16" />
      </PageLayout>
    )
  }

  if (isError || !project) {
    return (
      <PageLayout>
        <ErrorState
          title="Couldn't load this project"
          message={error ? normalizeApiError(error).message : 'Project not found.'}
          onRetry={refetch}
        />
      </PageLayout>
    )
  }

  const handleSubmit = (values: CreateProjectFormValues) => {
    const payload: UpdateProjectPayload = {
      managerId: values.managerId || undefined,
      name: values.name,
      startDate: values.startDate ? values.startDate.toISOString() : undefined,
      dueDate: values.dueDate ? values.dueDate.toISOString() : undefined,
    }
    updateMutation.mutate(payload, {
      onSuccess: () => navigate(`/projects/${id}`),
    })
  }

  return (
    <PageLayout>
      <PageHeader title={`Edit ${project.name}`} />
      <PageContent>
        <Card>
          <ProjectForm
            mode="edit"
            project={project}
            onSubmit={handleSubmit}
            isSubmitting={updateMutation.isPending}
            submitError={updateMutation.isError ? normalizeApiError(updateMutation.error).message : undefined}
          />
        </Card>
      </PageContent>
    </PageLayout>
  )
}
