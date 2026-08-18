// src/modules/projects/components/ProjectTimelineCard.tsx
// Derived only from Project's own real lifecycle fields (createdAt/startDate/dueDate/completedAt/
// archivedAt/updatedAt) - no invented activity feed or audit-log API call, same precedent as
// BusinessTimelineCard.
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { formatDateLong } from '@/lib/utils'
import type { Project } from '../types'

export interface ProjectTimelineCardProps {
  project: Project
}

export function ProjectTimelineCard({ project }: ProjectTimelineCardProps) {
  const events: { label: string; date: string }[] = [
    { label: 'Project created', date: project.createdAt },
    ...(project.startDate ? [{ label: 'Start date', date: project.startDate }] : []),
    ...(project.dueDate ? [{ label: project.isOverdue ? 'Due date (overdue)' : 'Due date', date: project.dueDate }] : []),
    ...(project.completedAt ? [{ label: 'Completed', date: project.completedAt }] : []),
    ...(project.archivedAt ? [{ label: 'Archived', date: project.archivedAt }] : []),
    ...(project.updatedAt !== project.createdAt ? [{ label: 'Last updated', date: project.updatedAt }] : []),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return (
    <Card>
      <CardHeader title="Timeline" />
      <div className="space-y-3">
        {events.map((event, i) => (
          <div key={`${event.label}-${i}`} className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary-500)] shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-[var(--color-text-body)]">{event.label}</p>
              <p className="text-[11px] text-[var(--color-text-muted)]">{formatDateLong(event.date)}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
