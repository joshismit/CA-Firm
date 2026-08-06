import { PermissionAction, PermissionResource } from '@shared/enums';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Notification Permissions
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Only READ/CREATE/MANAGE — reuses the existing `PermissionAction` values
 * rather than adding new `SETTINGS`/`TEMPLATES` actions, which would mean
 * touching two already-drifted enums (`shared/enums/permission.enum.ts` vs
 * the Prisma schema's own `PermissionAction`, see `permissions.seed.ts`'s
 * header comment) for a naming preference with no functional gain. `MANAGE`
 * gates every tenant-wide admin surface this module adds (send/schedule/
 * test/cancel, template mutation, firm settings mutation, provider health);
 * `CREATE` gates ad-hoc/scheduled sends specifically; `READ` gates read-only
 * admin views (history, templates list, firm settings, providers).
 *
 * The personal-inbox routes (`GET /notifications`, `/:id`, `/read-all`,
 * `/:id/read`, `DELETE /:id`) and the self-service `GET/PATCH
 * /notification-settings` stay ungated, matching the existing precedent in
 * `routes/notification.routes.ts`'s header comment — this file's constants
 * are applied only to the new tenant-wide/admin routes.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const RESOURCE = PermissionResource.NOTIFICATIONS;

export const NOTIFICATION_PERMISSIONS = {
  READ: `${RESOURCE}:${PermissionAction.READ}`,
  CREATE: `${RESOURCE}:${PermissionAction.CREATE}`,
  MANAGE: `${RESOURCE}:${PermissionAction.MANAGE}`,
} as const;

export type NotificationPermission = (typeof NOTIFICATION_PERMISSIONS)[keyof typeof NOTIFICATION_PERMISSIONS];
