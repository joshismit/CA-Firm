import { Router } from 'express';
import { authMiddleware } from '@middlewares/auth.middleware';
import { tenantMiddleware } from '@middlewares/tenant.middleware';
import { requirePermission } from '@middlewares/permission.middleware';
import { validate } from '@middlewares/validation.middleware';
import { IntegrationController } from '../controller/integration.controller';
import { INTEGRATION_PERMISSIONS } from '../constants/integration.permissions';
import {
  connectIntegrationSchema,
  disconnectIntegrationSchema,
  triggerSyncSchema,
  listConnectionsQuerySchema,
  syncHistoryQuerySchema,
  healthQuerySchema,
} from '../schemas';

/** Mounted at `${API.PREFIX}/integrations` (PRD §17 Step 9 — generic APIs only). */
const router = Router();

router.get(
  '/providers',
  authMiddleware,
  tenantMiddleware,
  requirePermission(INTEGRATION_PERMISSIONS.READ),
  IntegrationController.listProviders,
);

router.get(
  '/sync-history',
  authMiddleware,
  tenantMiddleware,
  requirePermission(INTEGRATION_PERMISSIONS.READ),
  validate({ query: syncHistoryQuerySchema }),
  IntegrationController.syncHistory,
);

router.get(
  '/health',
  authMiddleware,
  tenantMiddleware,
  requirePermission(INTEGRATION_PERMISSIONS.READ),
  validate({ query: healthQuerySchema }),
  IntegrationController.health,
);

router.get(
  '/',
  authMiddleware,
  tenantMiddleware,
  requirePermission(INTEGRATION_PERMISSIONS.READ),
  validate({ query: listConnectionsQuerySchema }),
  IntegrationController.listConnections,
);

router.post(
  '/connect',
  authMiddleware,
  tenantMiddleware,
  requirePermission(INTEGRATION_PERMISSIONS.MANAGE),
  validate({ body: connectIntegrationSchema }),
  IntegrationController.connect,
);

router.post(
  '/disconnect',
  authMiddleware,
  tenantMiddleware,
  requirePermission(INTEGRATION_PERMISSIONS.MANAGE),
  validate({ body: disconnectIntegrationSchema }),
  IntegrationController.disconnect,
);

router.post(
  '/sync',
  authMiddleware,
  tenantMiddleware,
  requirePermission(INTEGRATION_PERMISSIONS.MANAGE),
  validate({ body: triggerSyncSchema }),
  IntegrationController.triggerSync,
);

export default router;
