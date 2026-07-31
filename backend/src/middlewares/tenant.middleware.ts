import { Request, Response, NextFunction, RequestHandler } from 'express';
import { SubscriptionStatus as PrismaSubscriptionStatus } from '@prisma/client';
import { prisma } from '@config/database';
import { ForbiddenError, NotFoundError } from '@shared/errors';
import { MESSAGES } from '@shared/constants';
import { TenantStatus } from '@shared/enums';
import { asyncHandler } from '@shared/utils';

/** Subscription states that block access outright — PAST_DUE is deliberately excluded (a failed
 *  payment retry gets a grace period, not an instant lockout; matches every other SaaS's norm). */
const BLOCKED_SUBSCRIPTION_STATUSES: PrismaSubscriptionStatus[] = [
  PrismaSubscriptionStatus.EXPIRED,
  PrismaSubscriptionStatus.CANCELLED,
  PrismaSubscriptionStatus.SUSPENDED,
];

/**
 * Tenant Middleware.
 * Resolves the current tenant from the authenticated user's tenantId.
 * Attaches tenant data to req.tenant.
 *
 * Must run AFTER authMiddleware.
 *
 * CRITICAL: Every multi-tenant query must be scoped by tenantId.
 * This middleware ensures req.tenant is always populated for protected routes.
 *
 * Also enforces platform subscription billing (PRD §12): a tenant whose
 * 7-day trial (`BILLING.TRIAL_DAYS`) has lapsed, or whose paid subscription
 * has expired/been cancelled/suspended, is blocked here — the single
 * chokepoint every tenant-scoped request passes through, rather than
 * duplicating this check per module.
 *
 * Exported wrapped in `asyncHandler` — Express 4 does not await middleware
 * functions, so an unwrapped `async` middleware that throws (every branch
 * below) produces an unhandled promise rejection instead of calling
 * `next(err)`: the request just hangs until the client times out, rather
 * than returning the 403/404 it should. (Historically unnoticed because the
 * only two failure branches that existed before — tenant-not-found and
 * tenant-inactive — were never actually exercised by tenant fixtures, which
 * always create an ACTIVE tenant; the subscription-enforcement branches
 * added for billing were the first to hit this via a real HTTP request.)
 */
async function tenantMiddlewareHandler(
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
      subscriptionStatus: true,
      subscriptionExpiresAt: true,
    },
  });

  if (!tenant) {
    throw new NotFoundError('Tenant');
  }

  const isActive = tenant.status === TenantStatus.ACTIVE;

  if (!isActive) {
    throw new ForbiddenError(MESSAGES.TENANT_INACTIVE);
  }

  const trialExpired =
    tenant.subscriptionStatus === PrismaSubscriptionStatus.TRIAL &&
    tenant.subscriptionExpiresAt !== null &&
    tenant.subscriptionExpiresAt < new Date();

  if (trialExpired) {
    throw new ForbiddenError(MESSAGES.TRIAL_EXPIRED);
  }

  if (BLOCKED_SUBSCRIPTION_STATUSES.includes(tenant.subscriptionStatus)) {
    throw new ForbiddenError(MESSAGES.SUBSCRIPTION_INACTIVE);
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

export const tenantMiddleware: RequestHandler = asyncHandler(tenantMiddlewareHandler);
