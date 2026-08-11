import { PLAN_DEFINITIONS } from '../../../prisma/seeds/plan.seed';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Plan Seed Data — Storage Floor
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Every plan (any tier, any billing cycle) must guarantee at least 1 GB of
 * total storage. Guards the seed catalog directly so a future edit can't
 * silently drop a tier below the floor.
 * ─────────────────────────────────────────────────────────────────────────────
 */
describe('plan seed data', () => {
  it('gives every plan definition at least 1 GB of total storage', () => {
    for (const plan of PLAN_DEFINITIONS) {
      expect(plan.maxStorageGb).not.toBeNull();
      expect(plan.maxStorageGb as number).toBeGreaterThanOrEqual(1);
    }
  });

  it.each(['STARTER_MONTHLY', 'STARTER_QUARTERLY', 'STARTER_YEARLY'])('%s has the same storage allocation as its sibling cycles', (code) => {
    const plan = PLAN_DEFINITIONS.find((p) => p.code === code);
    const monthly = PLAN_DEFINITIONS.find((p) => p.code === 'STARTER_MONTHLY');
    expect(plan?.maxStorageGb).toBe(monthly?.maxStorageGb);
  });

  it('does not reduce Professional or Enterprise below their current allocation', () => {
    const professional = PLAN_DEFINITIONS.find((p) => p.code === 'PROFESSIONAL_MONTHLY');
    const enterprise = PLAN_DEFINITIONS.find((p) => p.code === 'ENTERPRISE_MONTHLY');
    expect(professional?.maxStorageGb).toBeGreaterThanOrEqual(50);
    expect(enterprise?.maxStorageGb).toBeGreaterThanOrEqual(250);
  });
});
