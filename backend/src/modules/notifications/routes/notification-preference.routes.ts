import { Router } from 'express';
import { authMiddleware } from '@middlewares/auth.middleware';
import { tenantMiddleware } from '@middlewares/tenant.middleware';
import { requirePermission } from '@middlewares/permission.middleware';
import { validate } from '@middlewares/validation.middleware';
import { NotificationPreferenceController } from '../controller/notification-preference.controller';
import { NOTIFICATION_PERMISSIONS } from '../constants/notification.permissions';
import { updateNotificationPreferenceSchema, updateFirmNotificationSettingsSchema } from '../schemas/notification-preference.schema';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Notification Preference / Firm Settings Routes (PRD §11.7/§11.8)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Mounted at `/notification-settings`. `GET`/`PATCH /` (the caller's own
 * preferences) stay ungated — self-service, matching
 * `notification.routes.ts`'s existing precedent. `/firm` is the tenant-wide
 * admin surface, gated by `NOTIFICATION_PERMISSIONS.READ`/`MANAGE`.
 *
 * `/firm` is registered before `/` — not strictly necessary here (no `:id`
 * segment to collide with), but kept consistent with `notification.routes
 * .ts`'s own "more specific route before the generic one" convention.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const router = Router();

router.get(
  '/firm',
  authMiddleware,
  tenantMiddleware,
  requirePermission(NOTIFICATION_PERMISSIONS.READ),
  NotificationPreferenceController.getFirmSettings,
);

router.patch(
  '/firm',
  authMiddleware,
  tenantMiddleware,
  requirePermission(NOTIFICATION_PERMISSIONS.MANAGE),
  validate({ body: updateFirmNotificationSettingsSchema }),
  NotificationPreferenceController.updateFirmSettings,
);

router.get('/', authMiddleware, tenantMiddleware, NotificationPreferenceController.get);

router.patch(
  '/',
  authMiddleware,
  tenantMiddleware,
  validate({ body: updateNotificationPreferenceSchema }),
  NotificationPreferenceController.update,
);

export default router;
