import { Router } from 'express';
import { authMiddleware } from '@middlewares/auth.middleware';
import { tenantMiddleware } from '@middlewares/tenant.middleware';
import { requirePermission } from '@middlewares/permission.middleware';
import { NotificationProviderController } from '../controller/notification-provider.controller';
import { NOTIFICATION_PERMISSIONS } from '../constants/notification.permissions';

/** PRD §11.16 — tenant-wide admin surface, gated by `NOTIFICATION_PERMISSIONS.READ`. */
const router = Router();

router.get('/', authMiddleware, tenantMiddleware, requirePermission(NOTIFICATION_PERMISSIONS.READ), NotificationProviderController.list);

router.get(
  '/health',
  authMiddleware,
  tenantMiddleware,
  requirePermission(NOTIFICATION_PERMISSIONS.READ),
  NotificationProviderController.health,
);

export default router;
