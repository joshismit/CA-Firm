import {
  reportTypeValues,
  reportGroupByValues,
  reportTypeParamSchema,
  reportFiltersQuerySchema,
  reportExportQuerySchema,
} from '@modules/reports/schemas/report.schema';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Report Zod Schemas — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 * Exercises the schemas directly (`.safeParse()`), independent of Express/
 * `validate()` middleware. Mirrors `tests/unit/modules/roles/role.schema.spec.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const VALID_UUID_1 = '11111111-1111-4111-8111-111111111111';

describe('reportTypeParamSchema', () => {
  it.each(reportTypeValues)('accepts the valid report type %s', (type) => {
    expect(reportTypeParamSchema.safeParse({ type }).success).toBe(true);
  });

  it('rejects an unknown report type', () => {
    expect(reportTypeParamSchema.safeParse({ type: 'REVENUE_FORECAST' }).success).toBe(false);
  });

  it('rejects a missing type', () => {
    expect(reportTypeParamSchema.safeParse({}).success).toBe(false);
  });
});

describe('reportFiltersQuerySchema', () => {
  it('accepts an empty object (every field optional)', () => {
    expect(reportFiltersQuerySchema.safeParse({}).success).toBe(true);
  });

  it('accepts a valid from/to/staffId combination', () => {
    const result = reportFiltersQuerySchema.safeParse({ from: '2026-01-01', to: '2026-01-31', staffId: VALID_UUID_1 });
    expect(result.success).toBe(true);
  });

  it('coerces from/to into Date instances', () => {
    const result = reportFiltersQuerySchema.safeParse({ from: '2026-01-01' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.from).toBeInstanceOf(Date);
  });

  it('rejects an unparseable from date', () => {
    expect(reportFiltersQuerySchema.safeParse({ from: 'not-a-date' }).success).toBe(false);
  });

  it('rejects a non-UUID staffId', () => {
    expect(reportFiltersQuerySchema.safeParse({ staffId: 'not-a-uuid' }).success).toBe(false);
  });

  it.each(reportGroupByValues)('accepts the valid groupBy value %s', (groupBy) => {
    expect(reportFiltersQuerySchema.safeParse({ groupBy }).success).toBe(true);
  });

  it('rejects an unknown groupBy value', () => {
    expect(reportFiltersQuerySchema.safeParse({ groupBy: 'REGION' }).success).toBe(false);
  });
});

describe('reportExportQuerySchema', () => {
  it('accepts a valid format alongside optional filters', () => {
    const result = reportExportQuerySchema.safeParse({ format: 'CSV', staffId: VALID_UUID_1 });
    expect(result.success).toBe(true);
  });

  it.each(['CSV', 'PDF', 'XLSX'])('accepts every valid export format (%s)', (format) => {
    expect(reportExportQuerySchema.safeParse({ format }).success).toBe(true);
  });

  it('rejects a missing format', () => {
    expect(reportExportQuerySchema.safeParse({}).success).toBe(false);
  });

  it('rejects an invalid format', () => {
    expect(reportExportQuerySchema.safeParse({ format: 'JSON' }).success).toBe(false);
  });
});
