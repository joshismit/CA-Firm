// src/modules/projects/pages/ProjectDetailPage.tsx
import { useParams } from 'react-router-dom'
import { PageLayout, PageContent } from '@/components/page'
import { Spinner, ErrorState } from '@/components/feedback'
import { normalizeApiError } from '@/services/api-error'
import { useProjectQuery } from '../hooks'
import {
  ProjectHeader,
  ProjectOverviewCard,
  ProjectRelatedBusinessCard,
  ProjectTasksCard,
  ProjectTimelineCard,
} from '../components'

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: project, isLoading, isError, error, refetch } = useProjectQuery(id!)

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

  return (
    <PageLayout>
      <ProjectHeader project={project} />

      <PageContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <ProjectOverviewCard project={project} />
            <ProjectRelatedBusinessCard clientId={project.clientId} />
            <ProjectTasksCard projectId={project.id} />
          </div>
          <div className="space-y-4">
            <ProjectTimelineCard project={project} />
          </div>
        </div>
      </PageContent>
    </PageLayout>
  )
}
