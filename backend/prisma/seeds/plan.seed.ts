import { PrismaClient, BillingCycle } from '@prisma/client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Plan Seed
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `Plan` is a shared (cross-tenant) reference table with no seed data yet —
 * without it, the pricing/checkout pages have nothing to show. Placeholder
 * tiers and pricing (Starter/Professional/Enterprise, per PRD §12's
 * Monthly/Quarterly/Yearly cycles) — easy to rename/reprice later since this
 * is just seed data, not hardcoded business logic. One row per (tier, cycle)
 * combination with its own already-discounted price, rather than a
 * tier row plus a cycle multiplier computed at checkout time.
 *
 * `maxUploadSizeMb` (PRD §7.4) follows the same per-tier convention as
 * `maxStorageGb` — Starter 100 MB, Professional 250 MB, Enterprise 1024 MB (1 GB).
 * ─────────────────────────────────────────────────────────────────────────────
 */

interface PlanDefinition {
  code: string;
  name: string;
  billingCycle: BillingCycle;
  priceInPaise: number;
  maxUsers: number | null;
  maxClients: number | null;
  maxStorageGb: number | null;
  maxDocuments: number | null;
  maxUploadSizeMb: number | null;
  displayOrder: number;
}

const PLAN_DEFINITIONS: PlanDefinition[] = [
  // ─── Starter ────────────────────────────────────────────────────────────
  { code: 'STARTER_MONTHLY', name: 'Starter', billingCycle: BillingCycle.MONTHLY, priceInPaise: 99_900, maxUsers: 3, maxClients: 50, maxStorageGb: 5, maxDocuments: 1_000, maxUploadSizeMb: 100, displayOrder: 1 },
  { code: 'STARTER_QUARTERLY', name: 'Starter', billingCycle: BillingCycle.QUARTERLY, priceInPaise: 269_900, maxUsers: 3, maxClients: 50, maxStorageGb: 5, maxDocuments: 1_000, maxUploadSizeMb: 100, displayOrder: 1 },
  { code: 'STARTER_YEARLY', name: 'Starter', billingCycle: BillingCycle.YEARLY, priceInPaise: 999_900, maxUsers: 3, maxClients: 50, maxStorageGb: 5, maxDocuments: 1_000, maxUploadSizeMb: 100, displayOrder: 1 },

  // ─── Professional ───────────────────────────────────────────────────────
  { code: 'PROFESSIONAL_MONTHLY', name: 'Professional', billingCycle: BillingCycle.MONTHLY, priceInPaise: 249_900, maxUsers: 15, maxClients: 500, maxStorageGb: 50, maxDocuments: 10_000, maxUploadSizeMb: 250, displayOrder: 2 },
  { code: 'PROFESSIONAL_QUARTERLY', name: 'Professional', billingCycle: BillingCycle.QUARTERLY, priceInPaise: 699_900, maxUsers: 15, maxClients: 500, maxStorageGb: 50, maxDocuments: 10_000, maxUploadSizeMb: 250, displayOrder: 2 },
  { code: 'PROFESSIONAL_YEARLY', name: 'Professional', billingCycle: BillingCycle.YEARLY, priceInPaise: 2_499_900, maxUsers: 15, maxClients: 500, maxStorageGb: 50, maxDocuments: 10_000, maxUploadSizeMb: 250, displayOrder: 2 },

  // ─── Enterprise ─────────────────────────────────────────────────────────
  { code: 'ENTERPRISE_MONTHLY', name: 'Enterprise', billingCycle: BillingCycle.MONTHLY, priceInPaise: 599_900, maxUsers: null, maxClients: null, maxStorageGb: 250, maxDocuments: null, maxUploadSizeMb: 1024, displayOrder: 3 },
  { code: 'ENTERPRISE_QUARTERLY', name: 'Enterprise', billingCycle: BillingCycle.QUARTERLY, priceInPaise: 1_699_900, maxUsers: null, maxClients: null, maxStorageGb: 250, maxDocuments: null, maxUploadSizeMb: 1024, displayOrder: 3 },
  { code: 'ENTERPRISE_YEARLY', name: 'Enterprise', billingCycle: BillingCycle.YEARLY, priceInPaise: 5_999_900, maxUsers: null, maxClients: null, maxStorageGb: 250, maxDocuments: null, maxUploadSizeMb: 1024, displayOrder: 3 },
];

/**
 * Seeds every `Plan` row. Idempotent — upserts on the unique `code` column
 * instead of inserting duplicates.
 */
export async function seedPlans(prisma: PrismaClient): Promise<void> {
  for (const def of PLAN_DEFINITIONS) {
    await prisma.plan.upsert({
      where: { code: def.code },
      update: {
        name: def.name,
        billingCycle: def.billingCycle,
        priceInPaise: def.priceInPaise,
        maxUsers: def.maxUsers,
        maxClients: def.maxClients,
        maxStorageGb: def.maxStorageGb,
        maxDocuments: def.maxDocuments,
        maxUploadSizeMb: def.maxUploadSizeMb,
        displayOrder: def.displayOrder,
        isActive: true,
      },
      create: {
        code: def.code,
        name: def.name,
        billingCycle: def.billingCycle,
        priceInPaise: def.priceInPaise,
        maxUsers: def.maxUsers,
        maxClients: def.maxClients,
        maxStorageGb: def.maxStorageGb,
        maxDocuments: def.maxDocuments,
        maxUploadSizeMb: def.maxUploadSizeMb,
        displayOrder: def.displayOrder,
      },
    });
  }
}
