// src/modules/projects/pages/ProjectsPage.tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, Download, Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader/PageHeader'
import { Tabs } from '@/components/shared/Tabs/Tabs'
import { Card } from '@/components/shared/Card/Card'
import { Separator } from '@/components/shared/Separator/Separator'
import { StatusBadge } from '@/components/shared/StatusBadge/StatusBadge'
import { Can } from '@/components/common/Can'
import { PERMISSIONS } from '@/config/permissions.config'
import { normalizeApiError } from '@/services/api-error'
import { cn, formatDate } from '@/lib/utils'
import { useProjectsQuery } from '../hooks'
import type { ProjectStatus } from '../types'

type TabValue = 'all' | ProjectStatus

const STATUS_CONFIG: Record<ProjectStatus, { variant: 'default' | 'success' | 'warning' | 'info' | 'danger'; label: string }> = {
  DRAFT: { variant: 'default', label: 'Draft' },
  PLANNED: { variant: 'default', label: 'Planned' },
  ACTIVE: { variant: 'success', label: 'Active' },
  ON_HOLD: { variant: 'warning', label: 'On Hold' },
  COMPLETED: { variant: 'info', label: 'Completed' },
  ARCHIVED: { variant: 'default', label: 'Archived' },
  CANCELLED: { variant: 'danger', label: 'Cancelled' },
}

const secondaryBtn = cn(
  'flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-md)]',
  'text-[12px] font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)]',
  'hover:bg-[var(--color-hover)] transition-colors'
)

const primaryBtn = cn(
  'flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-md)]',
  'text-[12px] font-medium text-white bg-[var(--color-primary-600)]',
  'hover:bg-[var(--color-primary-700)] transition-colors shadow-[var(--shadow-xs)]'
)

export function ProjectsPage() {
  const [tab, setTab] = useState<TabValue>('all')

  const { data, isLoading, isError, error } = useProjectsQuery({
    status: tab === 'all' ? undefined : tab,
    page: 1,
    limit: 20,
  })

  const projects = data?.data ?? []
  const total = data?.meta?.total ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description={`${total} engagement${total === 1 ? '' : 's'}`}
        actions={
          <>
            <button className={secondaryBtn}>
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
            <Can permission={PERMISSIONS.PROJECTS_CREATE}>
              <button className={primaryBtn}>
                <Plus className="w-3.5 h-3.5" />
                New Project
              </button>
            </Can>
          </>
        }
      />

      <Tabs
        value={tab}
        onChange={(v) => setTab(v as TabValue)}
        tabs={[
          { value: 'all', label: 'All' },
          { value: 'ACTIVE', label: 'Active' },
          { value: 'ON_HOLD', label: 'On Hold' },
          { value: 'COMPLETED', label: 'Completed' },
          { value: 'CANCELLED', label: 'Cancelled' },
        ]}
      />

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="h-[104px] shimmer">{null}</Card>
          ))}
        </div>
      )}

      {isError && (
        <Card>
          <div className="flex items-start gap-2 text-[13px] text-[var(--color-danger-fg)]">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{normalizeApiError(error).message || "Couldn't load projects. Please try again."}</span>
          </div>
        </Card>
      )}

      {!isLoading && !isError && projects.length === 0 && (
        <Card>
          <p className="text-center text-[13px] text-[var(--color-text-muted)] py-6">
            No projects found for this filter.
          </p>
        </Card>
      )}

      <div className="space-y-3">
        {projects.map((project) => {
          const status = STATUS_CONFIG[project.status]
          return (
            <Card key={project.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                    {project.code}
                  </p>
                  <h4 className="text-[15px] font-semibold text-[var(--color-text-heading)]">{project.name}</h4>
                </div>
                <StatusBadge variant={status.variant} dot>
                  {status.label}
                </StatusBadge>
              </div>

              <div className="mt-3 flex items-center justify-between gap-4 text-[12px]">
                <p className="text-[var(--color-text-muted)]">
                  {project.managerId ? `Manager assigned` : 'Unassigned'}
                </p>
                {project.dueDate && (
                  <p className={project.isOverdue ? 'font-medium text-[var(--color-danger)]' : 'text-[var(--color-text-muted)]'}>
                    Due {formatDate(project.dueDate)}
                    {project.isOverdue && ' · Overdue'}
                  </p>
                )}
              </div>

              <Separator className="my-3.5" />

              <div className="flex items-center gap-2">
                <Link
                  to={`/projects/${project.id}`}
                  className="h-7 rounded-[var(--radius-sm)] bg-[var(--color-surface)] px-2.5 text-[12px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] inline-flex items-center"
                >
                  View
                </Link>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
