// projects-scoped constants (enums, option lists, default values).

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  PLANNED: 'Planned',
  ACTIVE: 'Active',
  ON_HOLD: 'On Hold',
  COMPLETED: 'Completed',
  ARCHIVED: 'Archived',
  CANCELLED: 'Cancelled',
}

/** Statuses DELETE /projects/:id allows (backend/src/modules/projects/service/project.service.ts) - in-flight, completed, or archived projects cannot be deleted. */
export const PROJECT_DELETABLE_STATUSES = ['DRAFT', 'PLANNED', 'CANCELLED'] as const
