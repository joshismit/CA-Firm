import { Request, Response, NextFunction, RequestHandler } from 'express';
import { SubscriptionStatus as PrismaSubscriptionStatus, NotificationChannel } from '@prisma/client';
import { prisma } from '@config/database';
import { ForbiddenError, NotFoundError } from '@shared/errors';
import { MESSAGES } from '@shared/constants';
import { TenantStatus } from '@shared/enums';
import { asyncHandler } from '@shared/utils';
import { logger } from '@config/logger';
// Imported from its concrete path, not the `@modules/notifications` barrel —
// that barrel also re-exports `notificationRoutes`, which itself imports
// `tenantMiddleware` (this file), so importing the barrel here would create
// a module-load cycle (`tenant.middleware.ts` → notifications barrel →
// `notification.routes.ts` → `tenant.middleware.ts`, still mid-initialization)
// that left `tenantMiddleware` `undefined` wherever it's used as an Express
// route callback. Every other consumer below has the same fix for the same
// reason, even though most of them aren't on the cycle themselves — it's the
// correct import either way, since none of them need `notificationRoutes`.
import { NotificationDispatchService } from '@modules/notifications/service/notification-dispatch.service';
import { UserRepository } from '@modules/users/repository/user.repository';

const userRepository = new UserRepository(prisma);
const notificationDispatchService = new NotificationDispatchService();

/** IN_APP-only — no PRD text mandates EMAIL/SMS/WhatsApp for this event. Best-effort: never blocks the 403 this fires alongside. */
async function notifyOwnerOfExpiry(tenantId: string, title: string, message: string): Promise<void> {
  try {
    const owner = await userRepository.findOwnerByTenant(tenantId);
    if (!owner) return;
    await notificationDispatchService.send({ tenantId, userId: owner.id, title, message, channels: [NotificationChannel.IN_APP] });
  } catch (err) {
    logger.warn({ err, tenantId, title }, 'Failed to dispatch notification');
  }
}

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
 * 7-day trial (`BILLING.TRIAL_DAYS`) has lapsed, or whose paid (`ACTIVE`)
 * subscription's `subscriptionExpiresAt` has passed without a renewal ever
 * landing, or whose subscription has been explicitly
 * expired/cancelled/suspended, is blocked here — the single chokepoint every
 * tenant-scoped request passes through, rather than duplicating this check
 * per module. No scheduled job exists anywhere in this codebase to expire a
 * lapsed subscription proactively, so this request-time check is the only
 * enforcement there is; the first request to observe the lapse also persists
 * the `EXPIRED` transition (see below) so the tenant's real state — e.g. in
 * the master-admin tenant list — doesn't stay frozen at `ACTIVE` forever.
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

  const now = new Date();

  const trialExpired =
    tenant.subscriptionStatus === PrismaSubscriptionStatus.TRIAL &&
    tenant.subscriptionExpiresAt !== null &&
    tenant.subscriptionExpiresAt < now;

  // A paid subscription past its `subscriptionExpiresAt` with no renewal —
  // e.g. a Razorpay auto-renewal that failed — must not keep granting access
  // indefinitely just because nothing ever flipped `subscriptionStatus`
  // itself. `PAST_DUE` intentionally stays out of this check (and out of
  // `BLOCKED_SUBSCRIPTION_STATUSES` above) — a failed-payment retry is meant
  // to get a grace period, not an instant lockout the moment the date rolls
  // over; this only fires for a subscription still marked `ACTIVE`.
  const paidSubscriptionExpired =
    tenant.subscriptionStatus === PrismaSubscriptionStatus.ACTIVE &&
    tenant.subscriptionExpiresAt !== null &&
    tenant.subscriptionExpiresAt < now;

  if (trialExpired || paidSubscriptionExpired) {
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { subscriptionStatus: PrismaSubscriptionStatus.EXPIRED },
    });

    // Fires exactly once — the request that observes and persists the
    // transition. Every subsequent request instead takes the
    // `BLOCKED_SUBSCRIPTION_STATUSES` branch below (subscriptionStatus is
    // now EXPIRED), which never re-enters this block.
    await notifyOwnerOfExpiry(
      tenant.id,
      trialExpired ? 'Trial ended' : 'Subscription expired',
      trialExpired
        ? 'Your free trial has ended. Subscribe to a plan to continue using the platform.'
        : 'Your subscription has expired. Renew to continue using the platform.',
    );

    throw new ForbiddenError(trialExpired ? MESSAGES.TRIAL_EXPIRED : MESSAGES.SUBSCRIPTION_INACTIVE);
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
