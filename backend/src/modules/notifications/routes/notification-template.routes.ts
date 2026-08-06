import { Router } from 'express';
import { authMiddleware } from '@middlewares/auth.middleware';
import { tenantMiddleware } from '@middlewares/tenant.middleware';
import { requirePermission } from '@middlewares/permission.middleware';
import { validate } from '@middlewares/validation.middleware';
import { NotificationTemplateController } from '../controller/notification-template.controller';
import { NOTIFICATION_PERMISSIONS } from '../constants/notification.permissions';
import {
  createNotificationTemplateSchema,
  updateNotificationTemplateSchema,
  listNotificationTemplatesQuerySchema,
  notificationTemplateIdParamSchema,
} from '../schemas/notification-template.schema';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Notification Template Routes (PRD §11.9)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Tenant-wide admin surface — every route gated by `NOTIFICATION_PERMISSIONS`,
 * unlike the personal-inbox routes in `notification.routes.ts`. `READ` for
 * viewing the merged catalog (globals + this tenant's overrides); `MANAGE`
 * for every mutation.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const router = Router();

router.get(
  '/',
  authMiddleware,
  tenantMiddleware,
  requirePermission(NOTIFICATION_PERMISSIONS.READ),
  validate({ query: listNotificationTemplatesQuerySchema }),
  NotificationTemplateController.list,
);

router.get(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(NOTIFICATION_PERMISSIONS.READ),
  validate({ params: notificationTemplateIdParamSchema }),
  NotificationTemplateController.getById,
);

router.post(
  '/',
  authMiddleware,
  tenantMiddleware,
  requirePermission(NOTIFICATION_PERMISSIONS.MANAGE),
  validate({ body: createNotificationTemplateSchema }),
  NotificationTemplateController.create,
);

router.patch(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(NOTIFICATION_PERMISSIONS.MANAGE),
  validate({ params: notificationTemplateIdParamSchema, body: updateNotificationTemplateSchema }),
  NotificationTemplateController.update,
);

router.delete(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(NOTIFICATION_PERMISSIONS.MANAGE),
  validate({ params: notificationTemplateIdParamSchema }),
  NotificationTemplateController.delete,
);

export default router;
