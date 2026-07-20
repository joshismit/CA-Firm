import { Request, Response, NextFunction } from 'express';
import { prisma } from '@config/database';
import { ForbiddenError, NotFoundError } from '@shared/errors';
import { MESSAGES } from '@shared/constants';
import { TenantStatus } from '@shared/enums';

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
      planCode: true,
      status: true,
    },
  });

  if (!tenant) {
    throw new NotFoundError('Tenant');
  }

  const isActive = tenant.status === TenantStatus.ACTIVE;

  if (!isActive) {
    throw new ForbiddenError(MESSAGES.TENANT_INACTIVE);
  }

  req.tenant = {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    planCode: tenant.planCode,
    isActive,
  };

  next();
}
