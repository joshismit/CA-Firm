import { ComplianceFilingStatus } from '@prisma/client';
import {
  createComplianceFilingSchema,
  updateComplianceFilingSchema,
  complianceFilingIdParamSchema,
  listComplianceFilingsQuerySchema,
} from '@modules/compliance/schemas/compliance-filing.schema';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Compliance Filing Zod Schemas — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the schemas directly (`.safeParse()`), independent of Express/
 * `validate()` middleware — pure input → success/failure assertions. Mirrors
 * `tests/unit/modules/roles/role.schema.spec.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const VALID_UUID_1 = '11111111-1111-4111-8111-111111111111';

describe('createComplianceFilingSchema', () => {
  it('accepts the minimal valid payload (reference + period only)', () => {
    const result = createComplianceFilingSchema.safeParse({ reference: 'GSTR-3B', period: 'Q1 FY26' });
    expect(result.success).toBe(true);
  });

  it('accepts a fully-populated valid payload', () => {
    const result = createComplianceFilingSchema.safeParse({
      reference: 'GSTR-3B',
      period: 'Q1 FY26',
      dueDate: '2026-04-20',
      notes: 'Filed via portal',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a missing reference', () => {
    const result = createComplianceFilingSchema.safeParse({ period: 'Q1 FY26' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing period', () => {
    const result = createComplianceFilingSchema.safeParse({ reference: 'GSTR-3B' });
    expect(result.success).toBe(false);
  });

  it('rejects a reference shorter than 2 characters', () => {
    const result = createComplianceFilingSchema.safeParse({ reference: 'A', period: 'Q1 FY26' });
    expect(result.success).toBe(false);
  });

  it('rejects a period shorter than 2 characters', () => {
    const result = createComplianceFilingSchema.safeParse({ reference: 'GSTR-3B', period: 'A' });
    expect(result.success).toBe(false);
  });

  it('rejects a reference longer than 100 characters', () => {
    const result = createComplianceFilingSchema.safeParse({ reference: 'A'.repeat(101), period: 'Q1 FY26' });
    expect(result.success).toBe(false);
  });

  it('rejects notes longer than 2000 characters', () => {
    const result = createComplianceFilingSchema.safeParse({ reference: 'GSTR-3B', period: 'Q1 FY26', notes: 'A'.repeat(2001) });
    expect(result.success).toBe(false);
  });

  it('rejects an unparseable dueDate', () => {
    const result = createComplianceFilingSchema.safeParse({ reference: 'GSTR-3B', period: 'Q1 FY26', dueDate: 'not-a-date' });
    expect(result.success).toBe(false);
  });

  it('coerces a valid ISO date string for dueDate into a Date', () => {
    const result = createComplianceFilingSchema.safeParse({ reference: 'GSTR-3B', period: 'Q1 FY26', dueDate: '2026-04-20' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dueDate).toBeInstanceOf(Date);
    }
  });
});

describe('updateComplianceFilingSchema', () => {
  it('accepts an empty object (every field optional)', () => {
    expect(updateComplianceFilingSchema.safeParse({}).success).toBe(true);
  });

  it('accepts a valid partial update', () => {
    const result = updateComplianceFilingSchema.safeParse({ notes: 'Updated notes' });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid reference when provided', () => {
    const result = updateComplianceFilingSchema.safeParse({ reference: 'A' });
    expect(result.success).toBe(false);
  });

  it('has no status field at all (not settable via this API)', () => {
    const result = updateComplianceFilingSchema.safeParse({ status: ComplianceFilingStatus.FILED });
    // Zod strips unknown keys by default rather than rejecting - assert the field never round-trips.
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('status');
    }
  });
});

describe('complianceFilingIdParamSchema', () => {
  it('accepts a valid UUID', () => {
    expect(complianceFilingIdParamSchema.safeParse({ id: VALID_UUID_1 }).success).toBe(true);
  });

  it('rejects a non-UUID id', () => {
    expect(complianceFilingIdParamSchema.safeParse({ id: 'not-a-uuid' }).success).toBe(false);
  });
});

describe('listComplianceFilingsQuerySchema', () => {
  it('applies pagination defaults when nothing is provided', () => {
    const result = listComplianceFilingsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({ page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' });
    }
  });

  it.each(Object.values(ComplianceFilingStatus))('accepts every valid status filter value (%s)', (status) => {
    expect(listComplianceFilingsQuerySchema.safeParse({ status }).success).toBe(true);
  });

  it('rejects an invalid status filter', () => {
    expect(listComplianceFilingsQuerySchema.safeParse({ status: 'NOT_A_STATUS' }).success).toBe(false);
  });

  it('rejects a limit above 100', () => {
    expect(listComplianceFilingsQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
  });
});
