import { Request, Response, NextFunction } from 'express';
import { prisma } from '@config/database';
import { ForbiddenError, NotFoundError } from '@shared/errors';
import { MESSAGES } from '@shared/constants';

/**
 * Tenant Middleware.
 * Resolves the current tenant from the authenticated user's tenantId.
 * Attaches tenant data to req.tenant.
 *
 * Must run AFTER authMiddleware.
 *
 * CRITICAL: Every multi-tenant query must be scoped by tenantId.
 * This middleware ensures req.tenant is always populated for protected routes.
 */
export async function tenantMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.user) {
    throw new ForbiddenError('Authentication required before tenant resolution');
  }

  const { tenantId } = req.user;

  // Fetch tenant from DB (consider caching with Redis in production)
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      slug: true,
      name: true,
      plan: true,
      isActive: true,
    },
  });

  if (!tenant) {
    throw new NotFoundError('Tenant');
  }

  if (!tenant.isActive) {
    throw new ForbiddenError(MESSAGES.TENANT_INACTIVE);
  }

  req.tenant = tenant;

  next();
}
