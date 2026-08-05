import { PrismaClient, SubscriptionStatus, Tenant } from '@prisma/client';

export interface ApplyPlanData {
  planCode: string;
  subscriptionStatus: SubscriptionStatus;
  subscriptionExpiresAt: Date;
  maxUsers: number | null;
  maxClients: number | null;
  maxStorageGb: number | null;
  maxDocuments: number | null;
  /** PRD §7.4 — per-file upload size ceiling in MB, copied from the plan alongside `maxStorageGb`. */
  maxUploadSizeMb: number | null;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Tenant Billing Repository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The narrow slice of `Tenant` reads/writes the billing module needs —
 * deliberately NOT importing `modules/master-admin`'s own `TenantRepository`
 * (that would invert the intended dependency direction: master-admin sits
 * above billing/tenant-scoped modules, not the other way round). Mirrors
 * `modules/auth/repository/auth.repository.ts`'s `findTenantById` — a
 * bespoke, single-purpose read on `Tenant` from a module that isn't "the"
 * tenant module.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class TenantBillingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(tenantId: string): Promise<Tenant | null> {
    return this.prisma.tenant.findFirst({ where: { id: tenantId, deletedAt: null } });
  }

  /** Applies a successfully-paid plan's code/limits onto the tenant and marks the subscription ACTIVE. */
  async applyPlan(tenantId: string, data: ApplyPlanData): Promise<Tenant> {
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        planCode: data.planCode,
        subscriptionStatus: data.subscriptionStatus,
        subscriptionExpiresAt: data.subscriptionExpiresAt,
        maxUsers: data.maxUsers,
        maxClients: data.maxClients,
        maxStorageGb: data.maxStorageGb,
        maxDocuments: data.maxDocuments,
        maxUploadSizeMb: data.maxUploadSizeMb,
      },
    });
  }
}
