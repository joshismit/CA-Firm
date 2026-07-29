// src/modules/projects/components/ProjectOverviewCard.tsx
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { formatDate } from '@/lib/utils'
import { ProjectStatusBadge } from './ProjectStatusBadge'
import type { Project } from '../types'

export interface ProjectOverviewCardProps {
  project: Project
}

export function ProjectOverviewCard({ project }: ProjectOverviewCardProps) {
  return (
    <Card>
      <CardHeader title="Overview" />
      <dl className="grid grid-cols-2 gap-4 text-[13px]">
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Status</dt>
          <dd className="mt-1">
            <ProjectStatusBadge status={project.status} />
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Manager</dt>
          <dd className="mt-0.5 text-[var(--color-text-body)] font-mono">{project.managerId ?? 'Unassigned'}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Start date</dt>
          <dd className="mt-0.5 text-[var(--color-text-body)]">{project.startDate ? formatDate(project.startDate) : '—'}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Due date</dt>
          <dd className={project.isOverdue ? 'mt-0.5 font-medium text-[var(--color-danger)]' : 'mt-0.5 text-[var(--color-text-body)]'}>
            {project.dueDate ? formatDate(project.dueDate) : '—'}
            {project.isOverdue && ' · Overdue'}
          </dd>
        </div>
        {project.completedAt && (
          <div>
            <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Completed</dt>
            <dd className="mt-0.5 text-[var(--color-text-body)]">{formatDate(project.completedAt)}</dd>
          </div>
        )}
        {project.archivedAt && (
          <div>
            <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Archived</dt>
            <dd className="mt-0.5 text-[var(--color-text-body)]">{formatDate(project.archivedAt)}</dd>
          </div>
        )}
      </dl>
    </Card>
  )
}
