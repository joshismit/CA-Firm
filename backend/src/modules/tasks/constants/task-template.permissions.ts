import { PermissionAction, PermissionResource } from '@shared/enums';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Task Template Permissions
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Every permission code the Task Templates sub-module checks via
 * `requirePermission()`. Composed from the shared `PermissionAction`/
 * `PermissionResource` enums (never hand-typed), mirrors `task.permissions.ts`.
 *
 * `POST /task-templates/:id/instantiate` is deliberately NOT gated by one of
 * these — it creates a real `Task`, so it's gated by `TASK_PERMISSIONS.CREATE`
 * instead (see `routes/task-template.routes.ts`).
 * ─────────────────────────────────────────────────────────────────────────────
 */
const RESOURCE = PermissionResource.TASK_TEMPLATES;

export const TASK_TEMPLATE_PERMISSIONS = {
  CREATE: `${RESOURCE}:${PermissionAction.CREATE}`,
  READ: `${RESOURCE}:${PermissionAction.READ}`,
  UPDATE: `${RESOURCE}:${PermissionAction.UPDATE}`,
  DELETE: `${RESOURCE}:${PermissionAction.DELETE}`,
} as const;

export type TaskTemplatePermission = (typeof TASK_TEMPLATE_PERMISSIONS)[keyof typeof TASK_TEMPLATE_PERMISSIONS];
