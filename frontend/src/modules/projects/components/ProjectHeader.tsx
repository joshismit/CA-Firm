// src/modules/projects/components/ProjectHeader.tsx
// Composes the shared PageHeader/PageActions with project-specific content - pages never build
// this header inline.
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader, PageActions } from '@/components/page'
import { ProjectStatusBadge } from './ProjectStatusBadge'
import { ProjectQuickActions } from './ProjectQuickActions'
import type { Project } from '../types'

export interface ProjectHeaderProps {
  project: Project
}

export function ProjectHeader({ project }: ProjectHeaderProps) {
  return (
    <div className="space-y-3">
      <Link
        to="/projects"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-body)]"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to projects
      </Link>

      <PageHeader
        title={project.name}
        description={project.code}
        actions={
          <PageActions>
            <ProjectStatusBadge status={project.status} />
            <ProjectQuickActions project={project} />
          </PageActions>
        }
      />
    </div>
  )
}
